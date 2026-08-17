import { z } from "zod";
import { desc } from "drizzle-orm";
import { createRouter, investAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { adminUsers, auditLogs } from "@db/schema";
import { ACTIVITY_MODULES, activityModuleFor } from "@contracts/messaging";

/**
 * Admin Activity Timeline — a live, filterable feed over the audit log,
 * enriched with module classification and admin directory data.
 * Primary admin only (matches the Audit Log section).
 */
export const activityRouter = createRouter({
  timeline: investAdminQuery
    .input(
      z
        .object({
          search: z.string().optional(),
          adminId: z.number().optional(),
          module: z.string().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          quick: z.enum(["today", "yesterday", "this_week", "this_month", "financial", "users", "property", "security"]).optional(),
          limit: z.number().int().min(50).max(1000).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const [rows, admins] = await Promise.all([
        db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(1500),
        db.select({ id: adminUsers.id, displayName: adminUsers.displayName }).from(adminUsers),
      ]);
      const adminMap = new Map(admins.map((a) => [a.id, a.displayName]));

      let list = rows.map((r) => {
        const module = activityModuleFor(r.action);
        return {
          id: r.id,
          adminId: r.adminId,
          adminName: r.adminId != null ? (adminMap.get(r.adminId) ?? r.adminName) : r.adminName,
          action: r.action,
          details: r.details,
          module,
          createdAt: r.createdAt,
        };
      });

      const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
      const now = new Date();
      const todayStart = startOfDay(now);
      const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const q = input?.search?.trim().toLowerCase();
      if (q) {
        list = list.filter((r) => [r.adminName, r.action, r.details ?? ""].join(" ").toLowerCase().includes(q));
      }
      if (input?.adminId) list = list.filter((r) => r.adminId === input.adminId);
      if (input?.module) list = list.filter((r) => r.module === input.module);
      if (input?.dateFrom) list = list.filter((r) => new Date(r.createdAt) >= new Date(`${input.dateFrom}T00:00:00`));
      if (input?.dateTo) list = list.filter((r) => new Date(r.createdAt) <= new Date(`${input.dateTo}T23:59:59`));

      switch (input?.quick) {
        case "today":
          list = list.filter((r) => new Date(r.createdAt) >= todayStart);
          break;
        case "yesterday":
          list = list.filter((r) => { const t = new Date(r.createdAt); return t >= yesterdayStart && t < todayStart; });
          break;
        case "this_week":
          list = list.filter((r) => new Date(r.createdAt) >= weekStart);
          break;
        case "this_month":
          list = list.filter((r) => new Date(r.createdAt) >= monthStart);
          break;
        case "financial":
          list = list.filter((r) => r.module === "financial" || r.module === "investments");
          break;
        case "users":
          list = list.filter((r) => r.module === "users");
          break;
        case "property":
          list = list.filter((r) => r.module === "property");
          break;
        case "security":
          list = list.filter((r) => r.module === "security");
          break;
      }

      const limited = list.slice(0, input?.limit ?? 300);
      return {
        activities: limited,
        total: list.length,
        admins: admins.map((a) => ({ id: a.id, displayName: a.displayName })),
        modules: Object.values(ACTIVITY_MODULES),
      };
    }),
});
