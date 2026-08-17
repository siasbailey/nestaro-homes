import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { eq, and, gt, isNull, desc, ne } from "drizzle-orm";
import { createRouter, publicQuery, adminSessionQuery, primaryAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { adminUsers, adminTokens, auditLogs, accountDeletionFeedback } from "@db/schema";
import { AdminPermissions, type AdminPermissionKey } from "@contracts/constants";
import { parsePermissions } from "./lib/admin-session";
import { logAudit } from "./lib/activity";
import { appBaseUrl, sendEmail, buildAdminEmailChangeEmail, buildAdminEmailChangeNoticeEmail, buildAdminEmailChangedEmail, buildAdminPasswordChangedEmail } from "./lib/email";
import type { AdminUser } from "@db/schema";

const permissionKeys = AdminPermissions.map((p) => p.key) as AdminPermissionKey[];

function sanitizeAdmin(admin: AdminUser) {
  const { passwordHash: _ignored, ...rest } = admin;
  return { ...rest, permissions: parsePermissions(admin) };
}

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[a-zA-Z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

async function countOtherPrimaries(excludeId: number): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(and(eq(adminUsers.role, "primary"), ne(adminUsers.id, excludeId)));
  return rows.length;
}

export const adminManagementRouter = createRouter({
  // ── Multi-admin management (Primary Admin only) ───────────────
  listAdmins: primaryAdminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(adminUsers).orderBy(adminUsers.createdAt);
    return rows.map(sanitizeAdmin);
  }),

  createAdmin: primaryAdminQuery
    .input(
      z.object({
        firstName: z.string().max(100).optional(),
        lastName: z.string().max(100).optional(),
        displayName: z.string().min(2).max(255),
        email: z.string().email().max(320),
        password: passwordSchema,
        permissions: z.array(z.enum(permissionKeys as [AdminPermissionKey, ...AdminPermissionKey[]])).default([]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const email = input.email.toLowerCase().trim();
      const existing = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
      if (existing.length) {
        throw new TRPCError({ code: "CONFLICT", message: "An administrator with this email already exists" });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const [row] = await db
        .insert(adminUsers)
        .values({
          firstName: input.firstName?.trim() || null,
          lastName: input.lastName?.trim() || null,
          displayName: input.displayName.trim(),
          email,
          passwordHash,
          role: "secondary",
          permissions: JSON.stringify(input.permissions),
          status: "active",
        })
        .$returningId();
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        "admin_created",
        `Created secondary administrator ${input.displayName} (${email}) with permissions: ${input.permissions.join(", ") || "none"}`,
        ctx.req.headers,
      );
      return { success: true, adminId: row.id };
    }),

  updateAdmin: primaryAdminQuery
    .input(
      z.object({
        adminId: z.number(),
        firstName: z.string().max(100).optional(),
        lastName: z.string().max(100).optional(),
        displayName: z.string().min(2).max(255).optional(),
        phone: z.string().max(50).optional(),
        role: z.enum(["primary", "secondary"]).optional(),
        permissions: z.array(z.enum(permissionKeys as [AdminPermissionKey, ...AdminPermissionKey[]])).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, input.adminId)).limit(1);
      const target = rows.at(0);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Administrator not found" });

      // Protect the last Primary Admin from demotion
      if (input.role === "secondary" && target.role === "primary") {
        if ((await countOtherPrimaries(target.id)) === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot demote the only Primary Administrator" });
        }
      }

      const data: Record<string, unknown> = {};
      if (input.firstName !== undefined) data.firstName = input.firstName.trim() || null;
      if (input.lastName !== undefined) data.lastName = input.lastName.trim() || null;
      if (input.displayName !== undefined) data.displayName = input.displayName.trim();
      if (input.phone !== undefined) data.phone = input.phone || null;
      if (input.role !== undefined) data.role = input.role;
      if (input.permissions !== undefined) data.permissions = JSON.stringify(input.permissions);
      if (Object.keys(data).length) {
        await db.update(adminUsers).set(data).where(eq(adminUsers.id, target.id));
      }

      const changes: string[] = [];
      if (input.permissions !== undefined) changes.push(`permissions → ${input.permissions.join(", ") || "none"}`);
      if (input.role !== undefined && input.role !== target.role) changes.push(`role → ${input.role}`);
      if (input.displayName !== undefined) changes.push("name updated");
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        input.permissions !== undefined || input.role !== undefined ? "permission_changed" : "admin_updated",
        `Updated administrator ${target.displayName} (${target.email}): ${changes.join("; ") || "profile fields"}`,
        ctx.req.headers,
      );
      return { success: true };
    }),

  setAdminStatus: primaryAdminQuery
    .input(z.object({ adminId: z.number(), status: z.enum(["active", "suspended"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (input.adminId === ctx.admin.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot suspend your own account" });
      }
      const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, input.adminId)).limit(1);
      const target = rows.at(0);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Administrator not found" });
      if (input.status === "suspended" && target.role === "primary" && (await countOtherPrimaries(target.id)) === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot suspend the only Primary Administrator" });
      }
      await db
        .update(adminUsers)
        .set({ status: input.status, sessionsInvalidatedAt: input.status === "suspended" ? new Date() : undefined })
        .where(eq(adminUsers.id, target.id));
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        input.status === "suspended" ? "admin_suspended" : "admin_reactivated",
        `${input.status === "suspended" ? "Suspended" : "Reactivated"} administrator ${target.displayName} (${target.email})`,
        ctx.req.headers,
      );
      return { success: true };
    }),

  resetAdminPassword: primaryAdminQuery
    .input(z.object({ adminId: z.number(), newPassword: passwordSchema }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, input.adminId)).limit(1);
      const target = rows.at(0);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Administrator not found" });
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(adminUsers)
        .set({ passwordHash, sessionsInvalidatedAt: new Date() })
        .where(eq(adminUsers.id, target.id));
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        "admin_password_reset",
        `Reset password for administrator ${target.displayName} (${target.email}) — all sessions invalidated`,
        ctx.req.headers,
      );
      return { success: true };
    }),

  deleteAdmin: primaryAdminQuery
    .input(z.object({ adminId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (input.adminId === ctx.admin.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account" });
      }
      const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, input.adminId)).limit(1);
      const target = rows.at(0);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Administrator not found" });
      if (target.role === "primary" && (await countOtherPrimaries(target.id)) === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete the only Primary Administrator" });
      }
      await db.delete(adminTokens).where(eq(adminTokens.adminId, target.id));
      await db.delete(adminUsers).where(eq(adminUsers.id, target.id));
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        "admin_deleted",
        `Removed administrator ${target.displayName} (${target.email})`,
        ctx.req.headers,
      );
      return { success: true };
    }),

  adminActivity: primaryAdminQuery
    .input(z.object({ adminId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(auditLogs)
        .where(input?.adminId ? eq(auditLogs.adminId, input.adminId) : undefined)
        .orderBy(desc(auditLogs.createdAt))
        .limit(300);
      return rows;
    }),

  // Deletion feedback is visible only to the Primary Admin
  deletionFeedback: primaryAdminQuery.query(async () => {
    const db = getDb();
    return db.select().from(accountDeletionFeedback).orderBy(desc(accountDeletionFeedback.createdAt)).limit(300);
  }),

  // ── Admin profile settings (any active admin) ─────────────────
  updateProfile: adminSessionQuery
    .input(
      z.object({
        firstName: z.string().max(100).optional(),
        lastName: z.string().max(100).optional(),
        displayName: z.string().min(2).max(255).optional(),
        phone: z.string().max(50).optional(),
        avatar: z.string().max(2_000_000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const data: Record<string, unknown> = {};
      if (input.firstName !== undefined) data.firstName = input.firstName.trim() || null;
      if (input.lastName !== undefined) data.lastName = input.lastName.trim() || null;
      if (input.displayName !== undefined) data.displayName = input.displayName.trim();
      if (input.phone !== undefined) data.phone = input.phone || null;
      if (input.avatar !== undefined) data.avatar = input.avatar || null;
      if (Object.keys(data).length) {
        await db.update(adminUsers).set(data).where(eq(adminUsers.id, ctx.admin.id));
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "profile_updated", "Administrator profile updated", ctx.req.headers);
      const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, ctx.admin.id)).limit(1);
      return { success: true, admin: sanitizeAdmin(rows[0]) };
    }),

  requestEmailChange: adminSessionQuery
    .input(z.object({ newEmail: z.string().email().max(320), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const ok = await bcrypt.compare(input.password, ctx.admin.passwordHash);
      if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Password is incorrect" });

      const newEmail = input.newEmail.toLowerCase().trim();
      if (newEmail === ctx.admin.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This is already your current email address" });
      }
      const taken = await db.select().from(adminUsers).where(eq(adminUsers.email, newEmail)).limit(1);
      if (taken.length) {
        throw new TRPCError({ code: "CONFLICT", message: "That email address is already in use" });
      }

      // Invalidate any previous pending email-change tokens
      await db
        .update(adminTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(adminTokens.adminId, ctx.admin.id),
            eq(adminTokens.type, "email_change"),
            isNull(adminTokens.usedAt),
          ),
        );

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.insert(adminTokens).values({ adminId: ctx.admin.id, token, type: "email_change", newEmail, expiresAt });
      await db.update(adminUsers).set({ pendingEmail: newEmail }).where(eq(adminUsers.id, ctx.admin.id));

      const baseUrl = appBaseUrl(ctx.req.headers);
      const verifyUrl = `${baseUrl}/admin/verify-email?token=${token}`;
      const message = buildAdminEmailChangeEmail({ name: ctx.admin.displayName, newEmail, verifyUrl, baseUrl });
      const sent = await sendEmail({ to: newEmail, ...message });
      if (!sent.sent) console.log(`[email:dev] admin email change link for ${newEmail}: ${verifyUrl}`);

      // Notify the old (current) address about the request
      const notice = buildAdminEmailChangeNoticeEmail({ name: ctx.admin.displayName, newEmail, baseUrl });
      await sendEmail({ to: ctx.admin.email, ...notice });

      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        "email_change_requested",
        `Email change requested: ${ctx.admin.email} → ${newEmail}`,
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
        .from(adminTokens)
        .where(
          and(
            eq(adminTokens.token, input.token),
            eq(adminTokens.type, "email_change"),
            isNull(adminTokens.usedAt),
            gt(adminTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);
      const tokenRow = rows.at(0);
      if (!tokenRow || !tokenRow.newEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This verification link is invalid or has expired" });
      }
      const adminRows = await db.select().from(adminUsers).where(eq(adminUsers.id, tokenRow.adminId)).limit(1);
      const admin = adminRows.at(0);
      if (!admin) throw new TRPCError({ code: "NOT_FOUND", message: "Administrator not found" });

      // Re-check uniqueness in case the address was taken meanwhile
      const taken = await db
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(eq(adminUsers.email, tokenRow.newEmail))
        .limit(1);
      if (taken.length) {
        throw new TRPCError({ code: "CONFLICT", message: "That email address is now in use by another account" });
      }

      const oldEmail = admin.email;
      await db.update(adminUsers).set({ email: tokenRow.newEmail, pendingEmail: null }).where(eq(adminUsers.id, admin.id));
      await db.update(adminTokens).set({ usedAt: new Date() }).where(eq(adminTokens.id, tokenRow.id));
      await logAudit(admin.id, admin.displayName, "email_changed", `Admin email changed: ${oldEmail} → ${tokenRow.newEmail}`);

      // Confirmation email to the new address + security notice to the old one
      const baseUrl = appBaseUrl(ctx.req.headers);
      const confirmation = buildAdminEmailChangedEmail({
        name: admin.displayName,
        oldEmail,
        newEmail: tokenRow.newEmail,
        baseUrl,
      });
      await sendEmail({ to: tokenRow.newEmail, ...confirmation });
      await sendEmail({ to: oldEmail, ...confirmation });
      return { success: true };
    }),

  changePassword: adminSessionQuery
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: passwordSchema,
        confirmPassword: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.newPassword !== input.confirmPassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "New passwords do not match" });
      }
      const ok = await bcrypt.compare(input.currentPassword, ctx.admin.passwordHash);
      if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect" });

      const db = getDb();
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      // Invalidate every session — the user must sign back in
      await db
        .update(adminUsers)
        .set({ passwordHash, sessionsInvalidatedAt: new Date() })
        .where(eq(adminUsers.id, ctx.admin.id));

      const message = buildAdminPasswordChangedEmail({ name: ctx.admin.displayName, baseUrl: appBaseUrl(ctx.req.headers) });
      await sendEmail({ to: ctx.admin.email, ...message });

      await logAudit(ctx.admin.id, ctx.admin.displayName, "password_changed", "Administrator changed their password — all sessions invalidated", ctx.req.headers);
      return { success: true };
    }),
});
