import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  investors,
  investorNotifications,
  notificationPreferences,
  emailLogs,
} from "@db/schema";
import { CATEGORY_PREF_FIELD, ctaForNotification, type NotificationCategory } from "@contracts/notifications";
import { appBaseUrl, buildEventEmail, buildAdminActionEmail, sendEmail, adminNotificationEmail, Company, type EventEmailDetail } from "./email";

/**
 * Centralized notification service.
 *
 * One entry point for every user-facing notification: writes the in-app
 * record and (optionally) sends the branded email, honoring the user's
 * notification preferences. Security alerts bypass preferences.
 * Never throws — notification failures must not break business logic.
 */

export type NotifySeverity = "info" | "success" | "warning" | "error";

export interface NotifyInput {
  /** Machine key, e.g. "deposit_approved". */
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  severity?: NotifySeverity;
  /** Dashboard path for the email CTA, e.g. "/invest/dashboard?tab=portfolio". */
  link?: string;
  /** Transaction / reference id shown in the email details table. */
  relatedRef?: string;
  /** Extra rows for the email details table. */
  emailDetails?: EventEmailDetail[];
  /** Email body intro (defaults to the in-app message). */
  emailIntro?: string;
  /** Email heading (defaults to the title). */
  emailHeading?: string;
  emailNote?: string;
  /** Send the email too (default true). */
  email?: boolean;
  /** Write the in-app record (default true). */
  inApp?: boolean;
  /** Security alert: always in-app + email, ignores preferences. */
  security?: boolean;
  /** Email CTA button label (defaults to the type/category map). */
  ctaLabel?: string;
  reqHeaders?: Headers;
}

type Prefs = typeof notificationPreferences.$inferSelect;

const DEFAULT_PREFS: Omit<Prefs, "id" | "investorId" | "updatedAt"> = {
  emailNotifications: "yes",
  inAppNotifications: "yes",
  walletUpdates: "yes",
  investmentUpdates: "yes",
  propertyUpdates: "yes",
  mortgageUpdates: "yes",
  meetingReminders: "yes",
  documentUpdates: "yes",
  referralUpdates: "yes",
  marketingEmails: "no",
  weeklySummary: "no",
  monthlyStatement: "no",
  smsNotifications: "no",
};

export async function getNotificationPrefs(investorId: number): Promise<Prefs> {
  const db = getDb();
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.investorId, investorId))
    .limit(1);
  const row = rows.at(0);
  if (row) return row;
  return {
    id: 0,
    investorId,
    updatedAt: new Date(),
    ...DEFAULT_PREFS,
  } as Prefs;
}

function emailAllowedByPrefs(prefs: Prefs, category: NotificationCategory, security: boolean): boolean {
  if (security) return true;
  if (prefs.emailNotifications !== "yes") return false;
  const field = CATEGORY_PREF_FIELD[category] as keyof Prefs | undefined;
  if (field && (prefs[field] as string) !== "yes") return false;
  return true;
}

function inAppAllowedByPrefs(prefs: Prefs, security: boolean): boolean {
  if (security) return true;
  return prefs.inAppNotifications === "yes";
}

// Naira formatting is centralized in ./format — re-exported here so existing
// imports from the notification service keep working.
export { fmtMoney } from "./format";

export function fmtDateTime(d: Date): string {
  return `${d.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} (PT)`;
}

export async function notifyUser(
  investorId: number,
  input: NotifyInput,
): Promise<{ notificationId: number | null; emailed: boolean }> {
  try {
    const db = getDb();
    const rows = await db.select().from(investors).where(eq(investors.id, investorId)).limit(1);
    const investor = rows.at(0);
    if (!investor || investor.status === "deleted") return { notificationId: null, emailed: false };
    // Suspended accounts still receive security alerts (e.g. the suspension notice itself)
    if (investor.status === "suspended" && !input.security) return { notificationId: null, emailed: false };

    const prefs = await getNotificationPrefs(investorId);
    const security = input.security ?? false;
    const wantInApp = (input.inApp ?? true) && inAppAllowedByPrefs(prefs, security);
    const wantEmail = (input.email ?? true) && emailAllowedByPrefs(prefs, input.category, security);

    // ── In-app record ──
    let notificationId: number | null = null;
    if (wantInApp) {
      const [ins] = await db
        .insert(investorNotifications)
        .values({
          investorId,
          title: input.title,
          message: input.message,
          type: input.severity ?? "info",
          category: input.category,
          notifType: input.type,
          link: input.link ?? ctaForNotification(input.type, input.category).link,
          relatedRef: input.relatedRef ?? null,
          emailStatus: wantEmail ? "sent" : "not_applicable", // corrected below after send
        })
        .$returningId();
      notificationId = ins.id;
    }

    // ── Email ──
    let emailed = false;
    let emailStatus: "sent" | "failed" | "skipped" | "not_applicable" = "not_applicable";
    if (wantEmail) {
      const baseUrl = appBaseUrl(input.reqHeaders);
      const cta = ctaForNotification(input.type, input.category);
      const link = input.link ?? cta.link;
      const msg = buildEventEmail({
        name: investor.name,
        eyebrow: input.title,
        heading: input.emailHeading ?? input.title,
        intro: input.emailIntro ?? input.message,
        details: [
          { label: "Date", value: fmtDateTime(new Date()) },
          ...(input.relatedRef ? [{ label: "Reference", value: input.relatedRef }] : []),
          ...(input.emailDetails ?? []),
          { label: "Status", value: input.severity === "error" || input.severity === "warning" ? "Attention Required" : "Completed" },
        ],
        note: input.emailNote ?? null,
        ctaLabel: input.ctaLabel ?? cta.label,
        ctaUrl: `${baseUrl}${link}`,
        baseUrl,
      });
      const result = await sendEmail({ to: investor.email, ...msg });
      emailed = result.sent;
      emailStatus = result.sent ? "sent" : "failed";
      await db.insert(emailLogs).values({
        investorId,
        notificationId,
        toEmail: investor.email,
        subject: msg.subject,
        notifType: input.type,
        status: emailStatus,
        error: result.sent ? null : (result.reason ?? "unknown"),
      });
      if (notificationId) {
        await db
          .update(investorNotifications)
          .set({ emailStatus })
          .where(eq(investorNotifications.id, notificationId));
      }
      if (!result.sent) {
        console.log(`[notify] email to ${investor.email} (${input.type}) not sent: ${result.reason}`);
      }
    } else if ((input.email ?? true) && !security) {
      // Preference-driven skip is still recorded for analytics.
      emailStatus = "skipped";
      if (notificationId) {
        await db
          .update(investorNotifications)
          .set({ emailStatus })
          .where(eq(investorNotifications.id, notificationId));
      }
      await db.insert(emailLogs).values({
        investorId,
        notificationId,
        toEmail: investor.email,
        subject: `${input.title} — ${Company.name}`,
        notifType: input.type,
        status: "skipped",
        error: "disabled-by-preferences",
      });
    }

    return { notificationId, emailed };
  } catch (err) {
    console.error(`notifyUser(${input.type}) failed:`, err);
    return { notificationId: null, emailed: false };
  }
}

/** Fan out one notification to many investors (used by admin broadcasts). */
export async function notifyUsersBulk(
  investorIds: number[],
  input: NotifyInput,
): Promise<{ sent: number; emailed: number; failed: number }> {
  let sent = 0;
  let emailedCount = 0;
  let failed = 0;
  for (const id of investorIds) {
    const r = await notifyUser(id, input);
    if (r.notificationId) sent += 1;
    if (r.emailed) emailedCount += 1;
    else failed += 1;
  }
  return { sent, emailed: emailedCount, failed };
}

export interface NotifyAdminEmailInput {
  /** Short action phrase, e.g. "Deposit Requires Review" (subject = "NESTARO HOMES — <eyebrow>"). */
  eyebrow: string;
  heading: string;
  intro: string;
  details: Array<{ label: string; value: string }>;
  /** Admin dashboard path for the CTA, e.g. "/admin/dashboard?section=deposits". */
  adminLink: string;
  ctaLabel?: string;
  reqHeaders?: Headers;
}

/**
 * Staff-facing transactional email to ADMIN_NOTIFICATION_EMAIL.
 * Fire-and-forget by callers (void) — never throws, never blocks business logic.
 */
export async function notifyAdminEmail(input: NotifyAdminEmailInput): Promise<{ sent: boolean; reason?: string }> {
  try {
    const baseUrl = appBaseUrl(input.reqHeaders);
    const msg = buildAdminActionEmail({
      eyebrow: input.eyebrow,
      heading: input.heading,
      intro: input.intro,
      details: input.details,
      ctaLabel: input.ctaLabel ?? "Open Admin Dashboard",
      ctaUrl: `${baseUrl}${input.adminLink}`,
      baseUrl,
    });
    const result = await sendEmail({ to: adminNotificationEmail(), ...msg });
    if (!result.sent) {
      console.log(`[notify] admin email (${input.eyebrow}) not sent: ${result.reason}`);
    }
    return result;
  } catch (err) {
    console.error("[notify] admin email failed:", err instanceof Error ? err.message : err);
    return { sent: false, reason: "send-failed" };
  }
}
