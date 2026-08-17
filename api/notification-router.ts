import { z } from "zod";
import { and, desc, eq, gte, isNull, like, or, sql, inArray, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, investorQuery, primaryAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  broadcasts,
  customers,
  emailLogs,
  investments,
  investorNotifications,
  investors,
  mortgages,
  notificationPreferences,
} from "@db/schema";
import {
  BROADCAST_AUDIENCES,
  BROADCAST_KINDS,
  NOTIFICATION_CATEGORIES,
  broadcastAudienceLabel,
  broadcastKindLabel,
  type BroadcastAudience,
  type BroadcastKind,
  type NotificationCategory,
} from "@contracts/notifications";
import { getNotificationPrefs, notifyUsersBulk } from "./lib/notify";
import { logAudit } from "./lib/activity";

const categoryKeys = NOTIFICATION_CATEGORIES.map((c) => c.key) as [string, ...string[]];
const kindKeys = BROADCAST_KINDS.map((k) => k.key) as [BroadcastKind, ...BroadcastKind[]];
const audienceKeys = BROADCAST_AUDIENCES.map((a) => a.key) as [BroadcastAudience, ...BroadcastAudience[]];

const prefKeys = [
  "emailNotifications",
  "inAppNotifications",
  "walletUpdates",
  "investmentUpdates",
  "propertyUpdates",
  "mortgageUpdates",
  "meetingReminders",
  "documentUpdates",
  "referralUpdates",
  "marketingEmails",
  "weeklySummary",
  "monthlyStatement",
  "smsNotifications",
] as const;

const yesNo = z.enum(["yes", "no"]).optional();
const prefInput = z.object({
  emailNotifications: yesNo,
  inAppNotifications: yesNo,
  walletUpdates: yesNo,
  investmentUpdates: yesNo,
  propertyUpdates: yesNo,
  mortgageUpdates: yesNo,
  meetingReminders: yesNo,
  documentUpdates: yesNo,
  referralUpdates: yesNo,
  marketingEmails: yesNo,
  weeklySummary: yesNo,
  monthlyStatement: yesNo,
  smsNotifications: yesNo,
});

export const notificationRouter = createRouter({
  // ── User: Notification Center ─────────────────────────────────
  center: investorQuery
    .input(
      z.object({
        filter: z.enum(["all", "unread", "read", "archived"]).default("all"),
        category: z.enum(categoryKeys).optional(),
        search: z.string().max(200).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(50).default(15),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const mine = or(
        eq(investorNotifications.investorId, ctx.investor.id),
        sql`${investorNotifications.investorId} IS NULL`,
      );
      const conds: SQL[] = [mine!, isNull(investorNotifications.deletedAt)];
      if (input.filter === "archived") conds.push(eq(investorNotifications.archived, "yes"));
      else {
        conds.push(eq(investorNotifications.archived, "no"));
        if (input.filter === "unread") conds.push(eq(investorNotifications.isRead, "no"));
        if (input.filter === "read") conds.push(eq(investorNotifications.isRead, "yes"));
      }
      if (input.category) conds.push(eq(investorNotifications.category, input.category));
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conds.push(
          or(like(investorNotifications.title, q), like(investorNotifications.message, q))!,
        );
      }
      const where = and(...conds);
      const [countRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(investorNotifications)
        .where(where);
      const total = Number(countRow?.count ?? 0);
      const items = await db
        .select()
        .from(investorNotifications)
        .where(where)
        .orderBy(desc(investorNotifications.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return { items, total, page: input.page, pageSize: input.pageSize };
    }),

  centerUnreadCount: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(investorNotifications)
      .where(
        and(
          or(
            eq(investorNotifications.investorId, ctx.investor.id),
            sql`${investorNotifications.investorId} IS NULL`,
          ),
          eq(investorNotifications.isRead, "no"),
          eq(investorNotifications.archived, "no"),
          isNull(investorNotifications.deletedAt),
        ),
      );
    return Number(row?.count ?? 0);
  }),

  markRead: investorQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(investorNotifications)
        .set({ isRead: "yes" })
        .where(
          and(
            eq(investorNotifications.id, input.id),
            eq(investorNotifications.investorId, ctx.investor.id),
          ),
        );
      return { success: true };
    }),

  markAllRead: investorQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .update(investorNotifications)
      .set({ isRead: "yes" })
      .where(
        and(
          eq(investorNotifications.investorId, ctx.investor.id),
          eq(investorNotifications.isRead, "no"),
        ),
      );
    return { success: true };
    }),

  archive: investorQuery
    .input(z.object({ id: z.number().int().positive(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(investorNotifications)
        .set({ archived: input.archived ? "yes" : "no" })
        .where(
          and(
            eq(investorNotifications.id, input.id),
            eq(investorNotifications.investorId, ctx.investor.id),
          ),
        );
      return { success: true };
    }),

  remove: investorQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(investorNotifications)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(investorNotifications.id, input.id),
            eq(investorNotifications.investorId, ctx.investor.id),
          ),
        );
      return { success: true };
    }),

  // ── User: preferences ─────────────────────────────────────────
  getPreferences: investorQuery.query(async ({ ctx }) => {
    const prefs = await getNotificationPrefs(ctx.investor.id);
    const out: Record<string, string> = {};
    for (const k of prefKeys) out[k] = prefs[k] as string;
    return out;
  }),

  updatePreferences: investorQuery.input(prefInput).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const existing = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.investorId, ctx.investor.id))
      .limit(1);
    if (!existing.length) {
      await db.insert(notificationPreferences).values({
        investorId: ctx.investor.id,
        ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
      });
    } else {
      const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
      if (Object.keys(patch).length) {
        await db
          .update(notificationPreferences)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(notificationPreferences.investorId, ctx.investor.id));
      }
    }
    return { success: true };
  }),

  // ── Admin: broadcasts ─────────────────────────────────────────
  broadcasts: primaryAdminQuery.query(async () => {
    const db = getDb();
    return db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(100);
  }),

  sendBroadcast: primaryAdminQuery
    .input(
      z.object({
        title: z.string().min(3).max(255),
        message: z.string().min(10).max(5000),
        kind: z.enum(kindKeys),
        audience: z.enum(audienceKeys),
        customEmails: z.string().max(5000).optional(),
        sendEmail: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Resolve audience → investor ids
      let ids: number[] = [];
      if (input.audience === "all") {
        const rows = await db.select({ id: investors.id }).from(investors).where(eq(investors.status, "active"));
        ids = rows.map((r) => r.id);
      } else if (input.audience === "verified") {
        const rows = await db
          .select({ id: investors.id })
          .from(investors)
          .where(and(eq(investors.status, "active"), eq(investors.emailVerified, "yes")));
        ids = rows.map((r) => r.id);
      } else if (input.audience === "investors") {
        const rows = await db
          .selectDistinct({ id: investments.investorId })
          .from(investments)
          .where(inArray(investments.status, ["pending", "active", "matured"]));
        ids = rows.map((r) => r.id);
      } else if (input.audience === "mortgage_clients") {
        const rows = await db
          .selectDistinct({ id: mortgages.investorId })
          .from(mortgages)
          .where(inArray(mortgages.status, ["pending", "approved", "active"]));
        ids = rows.map((r) => r.id);
      } else if (input.audience === "property_buyers") {
        const rows = await db.selectDistinct({ email: customers.email }).from(customers);
        const emails = rows.map((r) => (r.email ?? "").toLowerCase()).filter(Boolean);
        if (emails.length) {
          const inv = await db
            .select({ id: investors.id, email: investors.email })
            .from(investors)
            .where(eq(investors.status, "active"));
          ids = inv.filter((i) => emails.includes(i.email.toLowerCase())).map((i) => i.id);
        }
      } else {
        // custom — comma/space separated emails
        const emails = (input.customEmails ?? "")
          .split(/[\s,;]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes("@"));
        if (!emails.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Provide at least one valid email address for the custom audience." });
        }
        const inv = await db
          .select({ id: investors.id, email: investors.email })
          .from(investors)
          .where(eq(investors.status, "active"));
        ids = inv.filter((i) => emails.includes(i.email.toLowerCase())).map((i) => i.id);
        if (!ids.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "None of those emails match registered investor accounts." });
        }
      }

      if (!ids.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No users match this audience." });
      }

      const emergency = input.kind === "emergency";
      const promotional = input.kind === "promotional";
      const category: NotificationCategory = promotional
        ? "marketing"
        : input.kind === "investment_opportunity"
          ? "investments"
          : input.kind === "property_announcement"
            ? "property"
            : "system";

      const result = await notifyUsersBulk(ids, {
        type: `broadcast_${input.kind}`,
        category,
        title: input.title,
        message: input.message,
        severity: emergency ? "warning" : "info",
        email: input.sendEmail,
        security: emergency, // emergency alerts bypass preferences
        link: "/invest/dashboard?tab=notifications",
        reqHeaders: ctx.req.headers,
      });

      await db.insert(broadcasts).values({
        title: input.title,
        message: input.message,
        kind: input.kind,
        audience: input.audience,
        customEmails: input.audience === "custom" ? (input.customEmails ?? null) : null,
        recipientCount: ids.length,
        emailsSent: result.emailed,
        emailsFailed: input.sendEmail ? result.failed : 0,
        sentByName: ctx.admin.displayName,
      });

      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        "broadcast_sent",
        `Broadcast "${input.title}" (${broadcastKindLabel(input.kind)}) to ${broadcastAudienceLabel(input.audience)}: ${ids.length} recipients, ${result.emailed} emails sent.`,
        ctx.req.headers,
      );

      return { success: true, recipients: ids.length, emailsSent: result.emailed };
    }),

  // ── Admin: analytics ──────────────────────────────────────────
  analytics: primaryAdminQuery.query(async () => {
    const db = getDb();
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60_000);

    const [notifTotal] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(investorNotifications)
      .where(gte(investorNotifications.createdAt, since30));
    const [notifRead] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(investorNotifications)
      .where(and(gte(investorNotifications.createdAt, since30), eq(investorNotifications.isRead, "yes")));
    const emailRows = await db
      .select({ status: emailLogs.status, count: sql<number>`COUNT(*)` })
      .from(emailLogs)
      .where(gte(emailLogs.createdAt, since30))
      .groupBy(emailLogs.status);
    const emailsSent = Number(emailRows.find((r) => r.status === "sent")?.count ?? 0);
    const emailsFailed = Number(emailRows.find((r) => r.status === "failed")?.count ?? 0);
    const emailsSkipped = Number(emailRows.find((r) => r.status === "skipped")?.count ?? 0);

    const byCategory = await db
      .select({ category: investorNotifications.category, count: sql<number>`COUNT(*)` })
      .from(investorNotifications)
      .where(gte(investorNotifications.createdAt, since30))
      .groupBy(investorNotifications.category);

    const recentFailures = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.status, "failed"))
      .orderBy(desc(emailLogs.createdAt))
      .limit(10);

    const [broadcastCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(broadcasts);

    const total = Number(notifTotal?.count ?? 0);
    const read = Number(notifRead?.count ?? 0);
    return {
      notificationsSent30d: total,
      readRate: total > 0 ? Math.round((read / total) * 100) : 0,
      emailsSent,
      emailsFailed,
      emailsSkipped,
      deliveryRate: emailsSent + emailsFailed > 0 ? Math.round((emailsSent / (emailsSent + emailsFailed)) * 100) : 100,
      byCategory: byCategory.map((r) => ({ category: r.category, count: Number(r.count) })),
      recentFailures,
      broadcastCount: Number(broadcastCount?.count ?? 0),
    };
  }),
});
