import { z } from "zod";
import * as cookie from "cookie";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { TRPCError } from "@trpc/server";
import { eq, and, gt, gte, isNull } from "drizzle-orm";
import { createRouter, publicQuery, investorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { investors, investorTokens, referrals, investorNotifications, investorDevices, investorActivityLogs } from "@db/schema";
import { notifyUser, notifyAdminEmail } from "./lib/notify";
import { InvestorSession } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { signInvestorToken } from "./lib/investor-session";
import { logInvestorActivity, notifyAdmin, logAudit } from "./lib/activity";
import { checkRateLimit, resetRateLimit } from "./lib/rate-limit";
import { sendVerificationEmail, sendPasswordResetEmail, appBaseUrl, sendEmail, buildInvestorEmailChangeEmail, buildInvestorEmailChangedEmail } from "./lib/email";
import { linkLeadToInvestor } from "./lib/crm";

function generateReferralCode(name: string) {
  const base = name.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "FLEX";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${base}${rand}`;
}

function createTokenValue() {
  return randomBytes(32).toString("hex");
}

/** Human-friendly "Chrome on Windows" label from a user-agent string. */
function deviceLabel(ua: string): string {
  const browser = /edg/i.test(ua)
    ? "Microsoft Edge"
    : /firefox/i.test(ua)
      ? "Firefox"
      : /chrome/i.test(ua)
        ? "Chrome"
        : /safari/i.test(ua)
          ? "Safari"
          : "a web browser";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /android/i.test(ua)
      ? "Android"
      : /iphone|ipad/i.test(ua)
        ? "iOS"
        : /mac os/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "an unknown device";
  return `${browser} on ${os}`;
}

function deviceFingerprint(ua: string): string {
  return createHash("sha256").update(ua).digest("hex").slice(0, 32);
}

function setInvestorCookie(resHeaders: Headers, reqHeaders: Headers, token: string, remember = true) {
  const opts = getSessionCookieOptions(reqHeaders);
  resHeaders.append(
    "set-cookie",
    cookie.serialize(InvestorSession.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      // "Remember me" unchecked → session cookie (expires when the browser closes)
      ...(remember ? { maxAge: InvestorSession.maxAgeMs / 1000 } : {}),
    }),
  );
}

export function clearInvestorCookie(resHeaders: Headers, reqHeaders: Headers) {
  const opts = getSessionCookieOptions(reqHeaders);
  resHeaders.append(
    "set-cookie",
    cookie.serialize(InvestorSession.cookieName, "", {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: 0,
    }),
  );
}

async function issueToken(investorId: number, type: "email_verification" | "password_reset") {
  const db = getDb();
  const token = createTokenValue();
  const expiresAt = new Date(Date.now() + (type === "password_reset" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
  await db.insert(investorTokens).values({ investorId, token, type, expiresAt });
  return token;
}

// Strip sensitive fields before returning an investor to the client
export function sanitizeInvestor<T extends { passwordHash?: string }>(investor: T) {
  const { passwordHash: _ignored, ...rest } = investor;
  return rest;
}

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-zA-Z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

export const investorAuthRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        name: z.string().min(2).max(255),
        email: z.string().email().max(320),
        password: passwordSchema,
        phone: z.string().max(50).optional(),
        country: z.string().max(100).optional(),
        referralCode: z.string().max(20).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const email = input.email.toLowerCase().trim();

      const existing = await db.select().from(investors).where(eq(investors.email, email)).limit(1);
      if (existing.length) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
      }

      // Resolve referral code
      let referrerId: number | null = null;
      if (input.referralCode) {
        const referrer = await db
          .select()
          .from(investors)
          .where(eq(investors.referralCode, input.referralCode.trim().toUpperCase()))
          .limit(1);
        if (referrer.length) referrerId = referrer[0].id;
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      const [row] = await db
        .insert(investors)
        .values({
          name: input.name.trim(),
          email,
          passwordHash,
          phone: input.phone || null,
          country: input.country || null,
          referralCode: generateReferralCode(input.name),
          referredById: referrerId,
        })
        .$returningId();

      const investorId = row.id;

      if (referrerId) {
        await db.insert(referrals).values({
          referrerId,
          referredId: investorId,
          referredName: input.name.trim(),
          bonusAmount: "0.00",
          status: "pending",
        });
        await db.insert(investorNotifications).values({
          investorId: referrerId,
          title: "New Referral Joined",
          message: `${input.name.trim()} joined Nestaro Homes with your referral code. Your bonus is credited once their first deposit is approved.`,
          type: "success",
        });
      }

      await db.insert(investorNotifications).values({
        investorId,
        title: "Welcome to Nestaro Homes",
        message: "Your investor account is ready. Verify your email, make your first deposit, and start building wealth with real estate.",
        type: "info",
      });

      const verificationToken = await issueToken(investorId, "email_verification");
      const emailed = await sendVerificationEmail({
        to: email,
        name: input.name.trim(),
        token: verificationToken,
        reqHeaders: ctx.req.headers,
      });

      // Welcome email (in-app record was inserted above)
      void notifyUser(investorId, {
        type: "welcome",
        category: "system",
        title: "Welcome to Nestaro Homes",
        message: "Your investor account is ready. Verify your email, make your first deposit, and start building wealth with real estate.",
        emailIntro: `Welcome to Nestaro Homes, ${input.name.trim()}! Your account has been created successfully. Verify your email, complete your profile, make your first deposit and start building wealth with real estate.`,
        link: "/invest/dashboard",
        inApp: false,
        reqHeaders: ctx.req.headers,
      });
      // Referrer: referral-registered email (in-app record was inserted above)
      if (referrerId) {
        void notifyUser(referrerId, {
          type: "referral_registered",
          category: "referrals",
          title: "New Referral Joined",
          message: `${input.name.trim()} joined Nestaro Homes with your referral code.`,
          severity: "success",
          link: "/invest/dashboard?tab=referrals",
          inApp: false,
          emailDetails: [{ label: "Referred User", value: input.name.trim() }],
        });
      }

      const created = await db.select().from(investors).where(eq(investors.id, investorId)).limit(1);
      await logInvestorActivity(investorId, "register", "Investor account created", ctx.req.headers);
      await logAudit(null, "System", "user_registered", `New user registered: ${input.name.trim()} (${email})`, ctx.req.headers);
      // CRM: link any existing lead to this registered account
      await linkLeadToInvestor(email, investorId, input.name.trim());
      const jwt = await signInvestorToken({ investorId, email });
      setInvestorCookie(ctx.resHeaders, ctx.req.headers, jwt);

      return {
        investor: sanitizeInvestor(created[0]),
        // Surfaced only when no SMTP service is configured so the UI can complete the flow
        devVerificationToken: emailed ? null : verificationToken,
      };
    }),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
        remember: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const email = input.email.toLowerCase().trim();
      const ip =
        ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        ctx.req.headers.get("x-real-ip") ??
        "unknown";
      const rlKey = `login:${email}:${ip}`;

      // Rate limit: 5 attempts per 10 minutes per email+IP
      if (!checkRateLimit(rlKey, 5, 10 * 60 * 1000)) {
        await notifyAdmin(
          "Suspicious Login Activity",
          `Repeated failed login attempts for investor account ${email} from IP ${ip}. The account has been temporarily rate-limited.`,
          "security",
        );
        void notifyAdminEmail({
          eyebrow: "Security Alert — Account Login Attempts",
          heading: "Suspicious Customer Login Activity",
          intro: `Repeated failed login attempts for a customer account were detected and temporarily rate-limited.`,
          details: [
            { label: "Account", value: email },
            { label: "IP Address", value: ip },
            { label: "Action Taken", value: "Rate-limited for 10 minutes" },
          ],
          adminLink: "/admin/dashboard?section=audit",
          ctaLabel: "View Audit Log",
          reqHeaders: ctx.req.headers,
        });
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many failed attempts. Please try again in 10 minutes.",
        });
      }

      const rows = await db.select().from(investors).where(eq(investors.email, email)).limit(1);
      const investor = rows.at(0);
      if (!investor) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      const ok = await bcrypt.compare(input.password, investor.passwordHash);
      if (!ok) {
        await logInvestorActivity(investor.id, "login_failed", `Failed login from IP ${ip}`, ctx.req.headers);
        // Security email after 3 failed attempts within 15 minutes
        try {
          const since = new Date(Date.now() - 15 * 60 * 1000);
          const fails = await db
            .select({ id: investorActivityLogs.id })
            .from(investorActivityLogs)
            .where(
              and(
                eq(investorActivityLogs.investorId, investor.id),
                eq(investorActivityLogs.action, "login_failed"),
                gte(investorActivityLogs.createdAt, since),
              ),
            );
          if (fails.length === 3) {
            void notifyUser(investor.id, {
              type: "failed_login_attempts",
              category: "account_security",
              title: "Multiple Failed Sign-In Attempts",
              message: `We detected ${fails.length} failed sign-in attempts on your account within the last 15 minutes (IP ${ip}). If this wasn't you, reset your password immediately.`,
              severity: "warning",
              security: true,
              link: "/invest/dashboard?tab=settings",
              emailDetails: [
                { label: "IP Address", value: ip },
                { label: "Attempts", value: String(fails.length) },
              ],
              reqHeaders: ctx.req.headers,
            });
          }
        } catch (err) {
          console.error("failed-login alert failed:", err);
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      if (investor.status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This account has been suspended. Contact support." });
      }

      resetRateLimit(rlKey);
      await db.update(investors).set({ lastSignInAt: new Date() }).where(eq(investors.id, investor.id));
      await logInvestorActivity(investor.id, "login", `Successful login from IP ${ip}`, ctx.req.headers);

      // Device tracking: known devices get a quiet in-app record; new devices get a security email
      try {
        const ua = ctx.req.headers.get("user-agent") ?? "Unknown device";
        const fp = deviceFingerprint(ua);
        const known = await db
          .select()
          .from(investorDevices)
          .where(and(eq(investorDevices.investorId, investor.id), eq(investorDevices.fingerprint, fp)))
          .limit(1);
        if (known.length) {
          await db
            .update(investorDevices)
            .set({ lastSeenAt: new Date(), ipAddress: ip })
            .where(eq(investorDevices.id, known[0].id));
          void notifyUser(investor.id, {
            type: "login",
            category: "account_security",
            title: "Successful Sign-In",
            message: `Your account was signed in from ${deviceLabel(ua)} (IP ${ip}).`,
            email: false,
            reqHeaders: ctx.req.headers,
          });
        } else {
          await db.insert(investorDevices).values({
            investorId: investor.id,
            fingerprint: fp,
            label: deviceLabel(ua),
            ipAddress: ip,
          });
          void notifyUser(investor.id, {
            type: "new_device_login",
            category: "account_security",
            title: "New Device Sign-In",
            message: `Your account was just signed in from a new device: ${deviceLabel(ua)} (IP ${ip}). If this wasn't you, reset your password immediately and contact support.`,
            severity: "warning",
            security: true,
            link: "/invest/dashboard?tab=settings",
            emailDetails: [
              { label: "Device", value: deviceLabel(ua) },
              { label: "IP Address", value: ip },
            ],
            reqHeaders: ctx.req.headers,
          });
        }
      } catch (err) {
        console.error("device tracking failed:", err);
      }

      const jwt = await signInvestorToken({ investorId: investor.id, email: investor.email });
      setInvestorCookie(ctx.resHeaders, ctx.req.headers, jwt, input.remember ?? true);

      return { investor: sanitizeInvestor(investor) };
    }),

  logout: investorQuery.mutation(async ({ ctx }) => {
    clearInvestorCookie(ctx.resHeaders, ctx.req.headers);
    return { success: true };
    }),

  me: investorQuery.query(({ ctx }) => sanitizeInvestor(ctx.investor)),

  verifyEmail: publicQuery
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(investorTokens)
        .where(
          and(
            eq(investorTokens.token, input.token),
            eq(investorTokens.type, "email_verification"),
            isNull(investorTokens.usedAt),
            gt(investorTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);
      const tokenRow = rows.at(0);
      if (!tokenRow) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This verification link is invalid or has expired" });
      }

      await db.update(investorTokens).set({ usedAt: new Date() }).where(eq(investorTokens.id, tokenRow.id));
      await db.update(investors).set({ emailVerified: "yes" }).where(eq(investors.id, tokenRow.investorId));
      await db.insert(investorNotifications).values({
        investorId: tokenRow.investorId,
        title: "Email Verified",
        message: "Your email address has been verified successfully.",
        type: "success",
      });

      return { success: true };
    }),

  resendVerification: investorQuery.mutation(async ({ ctx }) => {
    if (ctx.investor.emailVerified === "yes") {
      return { success: true, devVerificationToken: null };
    }
    const token = await issueToken(ctx.investor.id, "email_verification");
    const emailed = await sendVerificationEmail({
      to: ctx.investor.email,
      name: ctx.investor.name,
      token,
      reqHeaders: ctx.req.headers,
    });
    return { success: true, devVerificationToken: emailed ? null : token };
  }),

  forgotPassword: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const email = input.email.toLowerCase().trim();
      const rows = await db.select().from(investors).where(eq(investors.email, email)).limit(1);
      // Always succeed to avoid leaking which emails are registered
      if (!rows.length) {
        return { success: true, devResetToken: null };
      }
      const token = await issueToken(rows[0].id, "password_reset");
      const emailed = await sendPasswordResetEmail({
        to: email,
        name: rows[0].name,
        token,
      });
      return { success: true, devResetToken: emailed ? null : token };
    }),

  resetPassword: publicQuery
    .input(
      z.object({
        token: z.string().min(1),
        password: passwordSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(investorTokens)
        .where(
          and(
            eq(investorTokens.token, input.token),
            eq(investorTokens.type, "password_reset"),
            isNull(investorTokens.usedAt),
            gt(investorTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);
      const tokenRow = rows.at(0);
      if (!tokenRow) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link is invalid or has expired" });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      await db.update(investors).set({ passwordHash }).where(eq(investors.id, tokenRow.investorId));
      await db.update(investorTokens).set({ usedAt: new Date() }).where(eq(investorTokens.id, tokenRow.id));

      void notifyUser(tokenRow.investorId, {
        type: "password_reset_completed",
        category: "account_security",
        title: "Password Reset Completed",
        message: "Your password was reset successfully using a password reset link. If you did not request this, contact support immediately.",
        severity: "warning",
        security: true,
        link: "/invest/dashboard?tab=settings",
      });

      return { success: true };
    }),

  changePassword: investorQuery
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: passwordSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const ok = await bcrypt.compare(input.currentPassword, ctx.investor.passwordHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect" });
      }
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await db.update(investors).set({ passwordHash }).where(eq(investors.id, ctx.investor.id));
      void notifyUser(ctx.investor.id, {
        type: "password_changed",
        category: "account_security",
        title: "Password Changed",
        message: "Your account password was changed successfully. If you did not make this change, reset your password and contact support immediately.",
        severity: "warning",
        security: true,
        link: "/invest/dashboard?tab=settings",
        reqHeaders: ctx.req.headers,
      });
      return { success: true };
    }),

  // ── Email Change (verified, two-step) ─────────────────────────
  // The current verified email stays active until the new address is
  // verified via a single-use, 24-hour link sent to the NEW address.
  requestEmailChange: investorQuery
    .input(
      z.object({
        newEmail: z.string().email("Enter a valid email address").max(320),
        password: z.string().min(1, "Password is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const ok = await bcrypt.compare(input.password, ctx.investor.passwordHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Password is incorrect" });
      }
      const newEmail = input.newEmail.toLowerCase().trim();
      if (newEmail === ctx.investor.email.toLowerCase()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This is already your current email address" });
      }
      const taken = await db
        .select({ id: investors.id })
        .from(investors)
        .where(eq(investors.email, newEmail))
        .limit(1);
      if (taken.length) {
        throw new TRPCError({ code: "CONFLICT", message: "That email address is already registered to another account" });
      }

      // Invalidate any previous pending email-change tokens
      await db
        .update(investorTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(investorTokens.investorId, ctx.investor.id),
            eq(investorTokens.type, "email_change"),
            isNull(investorTokens.usedAt),
          ),
        );

      const token = createTokenValue();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.insert(investorTokens).values({
        investorId: ctx.investor.id,
        token,
        type: "email_change",
        newEmail,
        expiresAt,
      });
      await db.update(investors).set({ pendingEmail: newEmail }).where(eq(investors.id, ctx.investor.id));

      const baseUrl = appBaseUrl(ctx.req.headers);
      const verifyUrl = `${baseUrl}/invest/verify-email-change?token=${token}`;
      const message = buildInvestorEmailChangeEmail({ name: ctx.investor.name, newEmail, verifyUrl, baseUrl });
      const sent = await sendEmail({ to: newEmail, ...message });
      if (!sent.sent) console.log(`[email:dev] investor email change link for ${newEmail}: ${verifyUrl}`);

      // Security alert to the CURRENT verified email (in-app + email, always on)
      void notifyUser(ctx.investor.id, {
        type: "email_change_requested",
        category: "account_security",
        title: "Email Change Requested",
        message: `A request was made to change your account email to ${newEmail}. Your current email remains active until the new address is verified. If this wasn't you, secure your account immediately.`,
        severity: "warning",
        security: true,
        link: "/invest/dashboard?tab=settings",
        ctaLabel: "Review Account Settings",
        emailHeading: "Email Change Requested",
        emailIntro: `A request was made to change the email address on your Nestaro Homes account to ${newEmail}. Your current email remains active until the new address is verified.`,
        emailNote: "If you did not make this request, change your password and contact support immediately — your account may be at risk.",
        reqHeaders: ctx.req.headers,
      });

      await logInvestorActivity(
        ctx.investor.id,
        "email_change_requested",
        `Email change requested: ${ctx.investor.email} → ${newEmail}`,
        ctx.req.headers,
      );
      // Surfaced only when no SMTP is configured so the flow can complete in dev
      return { success: true, emailed: sent.sent, devToken: sent.sent ? null : token };
    }),

  confirmEmailChange: publicQuery
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(investorTokens)
        .where(
          and(
            eq(investorTokens.token, input.token),
            eq(investorTokens.type, "email_change"),
            isNull(investorTokens.usedAt),
            gt(investorTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);
      const tokenRow = rows.at(0);
      if (!tokenRow || !tokenRow.newEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This verification link is invalid, already used, or has expired" });
      }
      const investorRows = await db
        .select()
        .from(investors)
        .where(eq(investors.id, tokenRow.investorId))
        .limit(1);
      const investor = investorRows.at(0);
      if (!investor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }
      // Re-check uniqueness in case the address was registered meanwhile
      const taken = await db
        .select({ id: investors.id })
        .from(investors)
        .where(eq(investors.email, tokenRow.newEmail))
        .limit(1);
      if (taken.length) {
        throw new TRPCError({ code: "CONFLICT", message: "That email address is now registered to another account" });
      }

      const oldEmail = investor.email;
      const newEmail = tokenRow.newEmail;
      await db
        .update(investors)
        .set({ email: newEmail, emailVerified: "yes", pendingEmail: null })
        .where(eq(investors.id, investor.id));
      await db.update(investorTokens).set({ usedAt: new Date() }).where(eq(investorTokens.id, tokenRow.id));
      await logInvestorActivity(investor.id, "email_changed", `Email changed: ${oldEmail} → ${newEmail}`, ctx.req.headers);

      // Confirmation email to the new address + security notice to the old one
      const baseUrl = appBaseUrl(ctx.req.headers);
      const confirmation = buildInvestorEmailChangedEmail({ name: investor.name, oldEmail, newEmail, baseUrl });
      await sendEmail({ to: newEmail, ...confirmation });
      await sendEmail({ to: oldEmail, ...confirmation });

      // In-app security record (no duplicate email — the confirmation above covers it)
      void notifyUser(investor.id, {
        type: "email_changed",
        category: "account_security",
        title: "Email Address Changed",
        message: `Your account email was changed from ${oldEmail} to ${newEmail}. The new address is verified and is now your sign-in email.`,
        severity: "warning",
        security: true,
        email: false,
        link: "/invest/dashboard?tab=settings",
        ctaLabel: "Review Account Settings",
        reqHeaders: ctx.req.headers,
      });
      return { success: true };
    }),

  updateProfile: investorQuery
    .input(
      z.object({
        name: z.string().min(2).max(255).optional(),
        phone: z.string().max(50).optional(),
        country: z.string().max(100).optional(),
        avatar: z
          .string()
          .max(2_000_000, "Image is too large — please choose one under 5 MB")
          .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/i, "Avatar must be a JPG, PNG or WEBP image")
          .nullable()
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const data: Record<string, string | null> = {};
      if (input.name !== undefined) data.name = input.name.trim();
      if (input.phone !== undefined) data.phone = input.phone;
      if (input.country !== undefined) data.country = input.country;
      if (input.avatar !== undefined) data.avatar = input.avatar; // null removes the photo
      if (Object.keys(data).length) {
        await db.update(investors).set(data).where(eq(investors.id, ctx.investor.id));
        const changed = Object.keys(data)
          .filter((k) => k !== "avatar")
          .map((k) => (k === "name" ? "name" : k === "phone" ? "phone number" : "country"));
        void notifyUser(ctx.investor.id, {
          type: "profile_updated",
          category: "account_security",
          title: "Profile Updated",
          message: `Your profile ${changed.length ? `(${[...changed, ...(data.avatar !== undefined ? ["profile photo"] : [])].join(", ")})` : "photo"} was updated successfully. If you did not make this change, contact support.`,
          email: false,
          link: "/invest/dashboard?tab=settings",
        });
      }
      const updated = await db.select().from(investors).where(eq(investors.id, ctx.investor.id)).limit(1);
      return { investor: sanitizeInvestor(updated[0]) };
    }),

  submitKyc: investorQuery
    .input(
      z.object({
        fullName: z.string().min(2).max(255),
        documentType: z.enum(["passport", "drivers_license", "national_id"]),
        idNumber: z.string().min(3).max(100),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db
        .update(investors)
        .set({
          kycStatus: "pending",
          kycFullName: input.fullName.trim(),
          kycDocumentType: input.documentType,
          kycIdNumber: input.idNumber.trim(),
        })
        .where(eq(investors.id, ctx.investor.id));
      await db.insert(investorNotifications).values({
        investorId: ctx.investor.id,
        title: "Verification Submitted",
        message: "Your identity verification has been submitted and is under review. This usually takes 1-2 business days.",
        type: "info",
      });
      return { success: true };
    }),
});
