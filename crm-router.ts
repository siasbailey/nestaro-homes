import { z } from "zod";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminPermQuery, adminSessionQuery, createRouter, primaryAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  adminNotifications,
  adminUsers,
  appointments,
  crmStages,
  investments,
  investmentPlans,
  leadActivities,
  leadFollowUps,
  leads,
  mortgages,
} from "@db/schema";
import { leadSourceLabel, LEAD_SOURCES } from "@contracts/crm";
import { addLeadActivity, leadRefFor, listStages } from "./lib/crm";
import { combineDateTime, fmtWhen } from "./lib/appointments";
import { logAudit, notifyAdmin } from "./lib/activity";

const crmQuery = () => adminPermQuery("crm");

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

export const crmRouter = createRouter({
  // ── Pipeline stages ───────────────────────────────────────────
  stages: crmQuery().query(async () => {
    return listStages();
  }),

  saveStage: primaryAdminQuery
    .input(
      z.object({
        id: z.number().optional(),
        label: z.string().min(1).max(120),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #3b82f6"),
        kind: z.enum(["open", "won", "lost"]).default("open"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (input.id) {
        const existing = (await db.select().from(crmStages).where(eq(crmStages.id, input.id)).limit(1))[0];
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found" });
        await db
          .update(crmStages)
          .set({ label: input.label.trim(), color: input.color, kind: input.kind })
          .where(eq(crmStages.id, input.id));
        await logAudit(ctx.admin.id, ctx.admin.displayName, "crm_stage_updated", `Pipeline stage "${existing.label}" updated to "${input.label.trim()}" (${input.color}, ${input.kind})`, ctx.req.headers);
        return { success: true };
      }
      const key = input.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `stage_${Date.now()}`;
      let stageKey = key;
      let n = 2;
      while ((await db.select().from(crmStages).where(eq(crmStages.stageKey, stageKey)).limit(1)).length) {
        stageKey = `${key}_${n++}`;
      }
      const all = await db.select().from(crmStages);
      const maxOrder = all.reduce((m, s) => Math.max(m, s.sortOrder), 0);
      await db.insert(crmStages).values({
        stageKey,
        label: input.label.trim(),
        color: input.color,
        kind: input.kind,
        sortOrder: maxOrder + 1,
      });
      await logAudit(ctx.admin.id, ctx.admin.displayName, "crm_stage_created", `Pipeline stage "${input.label.trim()}" created (${input.color}, ${input.kind})`, ctx.req.headers);
      return { success: true };
    }),

  deleteStage: primaryAdminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const stage = (await db.select().from(crmStages).where(eq(crmStages.id, input.id)).limit(1))[0];
      if (!stage) throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found" });
      const all = await db.select().from(crmStages);
      if (all.length <= 1) throw new TRPCError({ code: "BAD_REQUEST", message: "At least one pipeline stage is required." });
      const inUse = await db.select({ id: leads.id }).from(leads).where(eq(leads.stage, stage.stageKey)).limit(1);
      if (inUse.length) {
        throw new TRPCError({ code: "CONFLICT", message: `Cannot delete "${stage.label}" — leads are currently in this stage. Move them first.` });
      }
      await db.delete(crmStages).where(eq(crmStages.id, input.id));
      await logAudit(ctx.admin.id, ctx.admin.displayName, "crm_stage_deleted", `Pipeline stage "${stage.label}" deleted`, ctx.req.headers);
      return { success: true };
    }),

  reorderStages: primaryAdminQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      for (let i = 0; i < input.ids.length; i++) {
        await db.update(crmStages).set({ sortOrder: i + 1 }).where(eq(crmStages.id, input.ids[i]));
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "crm_stages_reordered", `Pipeline stages reordered (${input.ids.length} stages)`, ctx.req.headers);
      return { success: true };
    }),

  // ── Admin directory (assignment dropdowns) ────────────────────
  assignableAdmins: adminSessionQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({ id: adminUsers.id, displayName: adminUsers.displayName, role: adminUsers.role })
      .from(adminUsers)
      .where(eq(adminUsers.status, "active"));
    return rows;
  }),

  // ── Leads ─────────────────────────────────────────────────────
  leads: crmQuery()
    .input(
      z
        .object({
          search: z.string().optional(),
          stage: z.string().optional(),
          source: z.string().optional(),
          assignedAdminId: z.number().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          budget: z.string().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          quick: z.enum(["new", "today", "followups", "high_priority", "lost", "closed"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const [allLeads, stageRows, followUpRows] = await Promise.all([
        db.select().from(leads).orderBy(desc(leads.createdAt)),
        listStages(db),
        db.select().from(leadFollowUps).where(eq(leadFollowUps.status, "pending")),
      ]);

      const wonKeys = new Set(stageRows.filter((s) => s.kind === "won").map((s) => s.stageKey));
      const lostKeys = new Set(stageRows.filter((s) => s.kind === "lost").map((s) => s.stageKey));
      const firstKey = stageRows[0]?.stageKey ?? "new";
      const todayStart = startOfToday();
      const todayEnd = endOfToday();

      const dueTodayLeadIds = new Set(
        followUpRows.filter((f) => new Date(f.dueAt) < todayEnd).map((f) => f.leadId),
      );
      const highPriorityLeadIds = new Set(
        followUpRows.filter((f) => f.priority === "high" || f.priority === "urgent").map((f) => f.leadId),
      );

      let rows = allLeads;
      const q = input?.search?.trim().toLowerCase();
      if (q) {
        rows = rows.filter((l) =>
          [l.fullName, l.email, l.phone ?? "", l.leadRef, l.interestedProperty ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q),
        );
      }
      if (input?.stage) rows = rows.filter((l) => l.stage === input.stage);
      if (input?.source) rows = rows.filter((l) => l.source === input.source);
      if (input?.assignedAdminId) rows = rows.filter((l) => l.assignedAdminId === input.assignedAdminId);
      if (input?.city) rows = rows.filter((l) => (l.city ?? "").toLowerCase().includes(input.city!.toLowerCase()));
      if (input?.state) rows = rows.filter((l) => (l.state ?? "").toLowerCase().includes(input.state!.toLowerCase()));
      if (input?.budget) rows = rows.filter((l) => l.budgetRange === input.budget);
      if (input?.dateFrom) rows = rows.filter((l) => new Date(l.createdAt) >= new Date(`${input.dateFrom}T00:00:00`));
      if (input?.dateTo) rows = rows.filter((l) => new Date(l.createdAt) <= new Date(`${input.dateTo}T23:59:59`));

      switch (input?.quick) {
        case "new":
          rows = rows.filter((l) => l.stage === firstKey);
          break;
        case "today":
          rows = rows.filter((l) => new Date(l.createdAt) >= todayStart);
          break;
        case "followups":
          rows = rows.filter((l) => dueTodayLeadIds.has(l.id));
          break;
        case "high_priority":
          rows = rows.filter((l) => highPriorityLeadIds.has(l.id));
          break;
        case "lost":
          rows = rows.filter((l) => lostKeys.has(l.stage));
          break;
        case "closed":
          rows = rows.filter((l) => wonKeys.has(l.stage));
          break;
      }

      return { leads: rows.slice(0, 500), total: rows.length, stages: stageRows };
    }),

  lead: crmQuery()
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const lead = (await db.select().from(leads).where(eq(leads.id, input.id)).limit(1))[0];
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      const [timeline, followUps, appts, stageRows] = await Promise.all([
        db.select().from(leadActivities).where(eq(leadActivities.leadId, lead.id)).orderBy(desc(leadActivities.createdAt)),
        db.select().from(leadFollowUps).where(eq(leadFollowUps.leadId, lead.id)).orderBy(desc(leadFollowUps.createdAt)),
        db.select().from(appointments).where(eq(appointments.leadId, lead.id)).orderBy(desc(appointments.createdAt)),
        listStages(db),
      ]);
      return { lead, timeline, followUps, appointments: appts, stages: stageRows };
    }),

  createLead: crmQuery()
    .input(
      z.object({
        fullName: z.string().min(2).max(255),
        email: z.string().email().max(320),
        phone: z.string().max(50).optional(),
        whatsapp: z.string().max(50).optional(),
        country: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        city: z.string().max(100).optional(),
        source: z.enum(Object.keys(LEAD_SOURCES) as [string, ...string[]]).default("manual"),
        stage: z.string().optional(),
        interestedProperty: z.string().max(255).optional(),
        investmentInterest: z.string().max(255).optional(),
        mortgageInterest: z.string().max(255).optional(),
        budgetRange: z.string().max(100).optional(),
        preferredContact: z.string().max(20).optional(),
        notes: z.string().optional(),
        assignedAdminId: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const email = input.email.toLowerCase().trim();
      const dup = await db.select({ id: leads.id }).from(leads).where(eq(leads.email, email)).limit(1);
      if (dup.length) {
        throw new TRPCError({ code: "CONFLICT", message: "A lead with this email address already exists." });
      }

      let assignedAdminName: string | null = null;
      if (input.assignedAdminId) {
        const adm = (await db.select().from(adminUsers).where(eq(adminUsers.id, input.assignedAdminId)).limit(1))[0];
        if (!adm) throw new TRPCError({ code: "NOT_FOUND", message: "Assigned administrator not found" });
        assignedAdminName = adm.displayName;
      }

      const stageRows = await listStages(db);
      const stage = input.stage && stageRows.some((s) => s.stageKey === input.stage) ? input.stage : (stageRows[0]?.stageKey ?? "new");

      const [row] = await db
        .insert(leads)
        .values({
          leadRef: leadRefFor(),
          fullName: input.fullName.trim(),
          email,
          phone: input.phone || null,
          whatsapp: input.whatsapp || null,
          country: input.country || null,
          state: input.state || null,
          city: input.city || null,
          source: input.source as never,
          stage,
          interestedProperty: input.interestedProperty || null,
          investmentInterest: input.investmentInterest || null,
          mortgageInterest: input.mortgageInterest || null,
          budgetRange: input.budgetRange || null,
          preferredContact: input.preferredContact || null,
          notes: input.notes || null,
          assignedAdminId: input.assignedAdminId ?? null,
          assignedAdminName,
          lastContactAt: new Date(),
        })
        .$returningId();

      await addLeadActivity(row.id, "created", `Lead created manually by ${ctx.admin.displayName}`, {
        notes: input.notes || null,
        adminId: ctx.admin.id,
        adminName: ctx.admin.displayName,
      });
      if (input.assignedAdminId && assignedAdminName) {
        await notifyAdmin(
          "New Lead Assigned",
          `${ctx.admin.displayName} assigned lead ${input.fullName.trim()} (${email}) to you.`,
          "system",
          undefined,
          input.assignedAdminId,
        );
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "crm_lead_created", `Lead ${input.fullName.trim()} (${email}) created manually`, ctx.req.headers);
      return { success: true, id: row.id };
    }),

  updateLead: crmQuery()
    .input(
      z.object({
        id: z.number(),
        fullName: z.string().min(2).max(255).optional(),
        phone: z.string().max(50).nullable().optional(),
        whatsapp: z.string().max(50).nullable().optional(),
        country: z.string().max(100).nullable().optional(),
        state: z.string().max(100).nullable().optional(),
        city: z.string().max(100).nullable().optional(),
        interestedProperty: z.string().max(255).nullable().optional(),
        investmentInterest: z.string().max(255).nullable().optional(),
        mortgageInterest: z.string().max(255).nullable().optional(),
        budgetRange: z.string().max(100).nullable().optional(),
        preferredContact: z.string().max(20).nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const lead = (await db.select().from(leads).where(eq(leads.id, input.id)).limit(1))[0];
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });

      const { id, ...fields } = input;
      const patch: Record<string, string | null> = {};
      const changes: string[] = [];
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue;
        const prev = (lead as unknown as Record<string, unknown>)[k] as string | null;
        const next = v === "" ? null : v;
        if ((prev ?? null) !== (next ?? null)) {
          patch[k] = next;
          changes.push(`${k}: "${prev ?? "—"}" → "${next ?? "—"}"`);
        }
      }
      if (!Object.keys(patch).length) return { success: true };

      await db.update(leads).set(patch).where(eq(leads.id, id));
      await addLeadActivity(id, "system", `Profile updated by ${ctx.admin.displayName}`, {
        notes: changes.join("; ").slice(0, 2000),
        adminId: ctx.admin.id,
        adminName: ctx.admin.displayName,
      });
      await logAudit(ctx.admin.id, ctx.admin.displayName, "crm_lead_updated", `Lead ${lead.leadRef} (${lead.fullName}) updated — ${changes.join("; ")}`, ctx.req.headers);
      return { success: true };
    }),

  changeStage: crmQuery()
    .input(z.object({ id: z.number(), stage: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [lead, stageRows] = await Promise.all([
        db.select().from(leads).where(eq(leads.id, input.id)).limit(1).then((r) => r[0]),
        listStages(db),
      ]);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      const target = stageRows.find((s) => s.stageKey === input.stage);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline stage not found" });
      if (lead.stage === input.stage) return { success: true };

      const fromLabel = stageRows.find((s) => s.stageKey === lead.stage)?.label ?? lead.stage;
      await db.update(leads).set({ stage: input.stage }).where(eq(leads.id, input.id));
      await addLeadActivity(input.id, "stage_change", `Stage changed: ${fromLabel} → ${target.label}`, {
        adminId: ctx.admin.id,
        adminName: ctx.admin.displayName,
      });
      await logAudit(ctx.admin.id, ctx.admin.displayName, "crm_stage_changed", `Lead ${lead.leadRef} (${lead.fullName}) stage: "${fromLabel}" → "${target.label}"`, ctx.req.headers);
      return { success: true };
    }),

  assignLead: crmQuery()
    .input(z.object({ id: z.number(), adminId: z.number().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const lead = (await db.select().from(leads).where(eq(leads.id, input.id)).limit(1))[0];
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });

      let name: string | null = null;
      if (input.adminId) {
        const adm = (await db.select().from(adminUsers).where(eq(adminUsers.id, input.adminId)).limit(1))[0];
        if (!adm || adm.status !== "active") throw new TRPCError({ code: "NOT_FOUND", message: "Administrator not found" });
        name = adm.displayName;
      }

      const prev = lead.assignedAdminName ?? "Unassigned";
      await db.update(leads).set({ assignedAdminId: input.adminId, assignedAdminName: name }).where(eq(leads.id, input.id));
      await addLeadActivity(input.id, "assignment", name ? `Lead assigned to ${name}` : "Lead unassigned", {
        adminId: ctx.admin.id,
        adminName: ctx.admin.displayName,
      });
      if (input.adminId && name && input.adminId !== ctx.admin.id) {
        await notifyAdmin(
          "New Lead Assigned",
          `${ctx.admin.displayName} assigned lead ${lead.fullName} (${lead.email}) to you.`,
          "system",
          undefined,
          input.adminId,
        );
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "crm_lead_assigned", `Lead ${lead.leadRef} (${lead.fullName}) assignment: "${prev}" → "${name ?? "Unassigned"}"`, ctx.req.headers);
      return { success: true };
    }),

  addActivity: crmQuery()
    .input(
      z.object({
        leadId: z.number(),
        type: z.enum(["note", "email", "call", "whatsapp", "meeting"]),
        description: z.string().min(1).max(500),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const lead = (await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1))[0];
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });

      await addLeadActivity(input.leadId, input.type, input.description, {
        notes: input.notes || null,
        adminId: ctx.admin.id,
        adminName: ctx.admin.displayName,
      });
      await db.update(leads).set({ lastContactAt: new Date() }).where(eq(leads.id, input.leadId));
      await logAudit(ctx.admin.id, ctx.admin.displayName, "crm_activity_logged", `Lead ${lead.leadRef} (${lead.fullName}) — ${input.type}: ${input.description}`, ctx.req.headers);
      return { success: true };
    }),

  // ── Follow-ups ────────────────────────────────────────────────
  followUps: crmQuery()
    .input(z.object({ filter: z.enum(["today", "overdue", "upcoming", "pending", "all"]).default("pending") }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const [rows, leadRows] = await Promise.all([
        db.select().from(leadFollowUps).orderBy(desc(leadFollowUps.dueAt)),
        db.select({ id: leads.id, fullName: leads.fullName, leadRef: leads.leadRef }).from(leads),
      ]);
      const leadMap = new Map(leadRows.map((l) => [l.id, l]));
      const now = new Date();
      const todayEnd = endOfToday();
      const filter = input?.filter ?? "pending";

      let list = rows.map((f) => ({ ...f, lead: leadMap.get(f.leadId) ?? null }));
      switch (filter) {
        case "today":
          list = list.filter((f) => f.status === "pending" && new Date(f.dueAt) < todayEnd);
          break;
        case "overdue":
          list = list.filter((f) => f.status === "pending" && new Date(f.dueAt) < now);
          break;
        case "upcoming":
          list = list.filter((f) => f.status === "pending" && new Date(f.dueAt) >= now);
          break;
        case "pending":
          list = list.filter((f) => f.status === "pending");
          break;
        case "all":
          break;
      }
      return list.slice(0, 300);
    }),

  createFollowUp: crmQuery()
    .input(
      z.object({
        leadId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
        dueTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm"),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        assignedAdminId: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const lead = (await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1))[0];
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });

      const dueAt = combineDateTime(input.dueDate, input.dueTime);
      let assignedName: string | null = null;
      const assignee = input.assignedAdminId ?? ctx.admin.id;
      const adm = (await db.select().from(adminUsers).where(eq(adminUsers.id, assignee)).limit(1))[0];
      if (!adm) throw new TRPCError({ code: "NOT_FOUND", message: "Assigned administrator not found" });
      assignedName = adm.displayName;

      await db.insert(leadFollowUps).values({
        leadId: input.leadId,
        title: input.title.trim(),
        description: input.description || null,
        dueAt,
        priority: input.priority,
        assignedAdminId: assignee,
        assignedAdminName: assignedName,
      });

      await addLeadActivity(input.leadId, "follow_up", `Follow-up scheduled: ${input.title.trim()} — ${fmtWhen(dueAt)}`, {
        notes: input.description || null,
        adminId: ctx.admin.id,
        adminName: ctx.admin.displayName,
      });
      if (assignee !== ctx.admin.id) {
        await notifyAdmin(
          "Follow-up Assigned",
          `${ctx.admin.displayName} scheduled "${input.title.trim()}" for lead ${lead.fullName} — due ${fmtWhen(dueAt)}.`,
          "system",
          undefined,
          assignee,
        );
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "crm_followup_created", `Lead ${lead.leadRef} (${lead.fullName}) — follow-up "${input.title.trim()}" due ${fmtWhen(dueAt)}, priority ${input.priority}, assigned to ${assignedName}`, ctx.req.headers);
      return { success: true };
    }),

  setFollowUpStatus: crmQuery()
    .input(z.object({ id: z.number(), status: z.enum(["pending", "completed", "cancelled"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const fu = (await db.select().from(leadFollowUps).where(eq(leadFollowUps.id, input.id)).limit(1))[0];
      if (!fu) throw new TRPCError({ code: "NOT_FOUND", message: "Follow-up not found" });

      await db
        .update(leadFollowUps)
        .set({
          status: input.status,
          completedAt: input.status === "completed" ? new Date() : null,
          completedByName: input.status === "completed" ? ctx.admin.displayName : null,
        })
        .where(eq(leadFollowUps.id, input.id));

      const lead = (await db.select().from(leads).where(eq(leads.id, fu.leadId)).limit(1))[0];
      if (lead) {
        const verb = input.status === "completed" ? "completed" : input.status === "cancelled" ? "cancelled" : "reopened";
        await addLeadActivity(fu.leadId, "follow_up", `Follow-up ${verb}: ${fu.title}`, {
          adminId: ctx.admin.id,
          adminName: ctx.admin.displayName,
        });
        await logAudit(ctx.admin.id, ctx.admin.displayName, "crm_followup_updated", `Lead ${lead.leadRef} (${lead.fullName}) — follow-up "${fu.title}" marked ${input.status} (was ${fu.status})`, ctx.req.headers);
      }
      return { success: true };
    }),

  // ── Analytics ─────────────────────────────────────────────────
  analytics: crmQuery().query(async () => {
    const db = getDb();
    const [allLeads, stageRows, followUpRows, activityRows, allInvestments, allMortgages, planRows] = await Promise.all([
      db.select().from(leads),
      listStages(db),
      db.select().from(leadFollowUps),
      db.select().from(leadActivities),
      db.select().from(investments),
      db.select().from(mortgages),
      db.select().from(investmentPlans),
    ]);

    const wonKeys = new Set(stageRows.filter((s) => s.kind === "won").map((s) => s.stageKey));
    const lostKeys = new Set(stageRows.filter((s) => s.kind === "lost").map((s) => s.stageKey));
    const todayStart = startOfToday();
    const todayEnd = endOfToday();
    const now = new Date();

    const total = allLeads.length;
    const newToday = allLeads.filter((l) => new Date(l.createdAt) >= todayStart).length;
    const closed = allLeads.filter((l) => wonKeys.has(l.stage)).length;
    const lost = allLeads.filter((l) => lostKeys.has(l.stage)).length;
    const active = total - closed - lost;
    const followUpsDue = followUpRows.filter((f) => f.status === "pending" && new Date(f.dueAt) < todayEnd).length;
    const conversionRate = total ? Math.round((closed / total) * 1000) / 10 : 0;

    // Average first-response time (created → first human contact activity)
    const byLead = new Map<number, Date>();
    for (const a of activityRows) {
      if (a.type === "created" || a.type === "system" || a.type === "stage_change" || a.type === "assignment") continue;
      const t = new Date(a.createdAt);
      const prev = byLead.get(a.leadId);
      if (!prev || t < prev) byLead.set(a.leadId, t);
    }
    let responseSum = 0;
    let responseCount = 0;
    for (const l of allLeads) {
      const first = byLead.get(l.id);
      if (!first) continue;
      const hours = (first.getTime() - new Date(l.createdAt).getTime()) / 3_600_000;
      if (hours >= 0 && hours < 24 * 365) {
        responseSum += hours;
        responseCount++;
      }
    }
    const avgResponseHours = responseCount ? Math.round((responseSum / responseCount) * 10) / 10 : null;

    const topOf = (values: (string | null)[]): string | null => {
      const counts = new Map<string, number>();
      for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
      let best: string | null = null;
      let bestN = 0;
      for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
      return best;
    };

    const planNames = new Map(planRows.map((p) => [p.id, p.name]));
    const mostPopularInvestmentPlan =
      topOf(allInvestments.map((i) => planNames.get(i.planId) ?? null)) ?? topOf(allLeads.map((l) => l.investmentInterest));
    const mostPopularMortgagePlan =
      topOf(allMortgages.map((m) => m.planName)) ?? topOf(allLeads.map((l) => l.mortgageInterest));

    // Charts
    const months: { key: string; label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        count: 0,
      });
    }
    const monthIndex = new Map(months.map((m, i) => [m.key, i]));
    for (const l of allLeads) {
      const d = new Date(l.createdAt);
      const idx = monthIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (idx !== undefined) months[idx].count++;
    }

    const bySource = new Map<string, number>();
    for (const l of allLeads) bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);

    const funnel = stageRows.map((s) => ({
      key: s.stageKey,
      label: s.label,
      color: s.color,
      kind: s.kind,
      count: allLeads.filter((l) => l.stage === s.stageKey).length,
    }));

    const perfMap = new Map<string, { name: string; assigned: number; closed: number }>();
    for (const l of allLeads) {
      if (!l.assignedAdminName) continue;
      const entry = perfMap.get(l.assignedAdminName) ?? { name: l.assignedAdminName, assigned: 0, closed: 0 };
      entry.assigned++;
      if (wonKeys.has(l.stage)) entry.closed++;
      perfMap.set(l.assignedAdminName, entry);
    }

    const propCounts = new Map<string, number>();
    for (const l of allLeads) {
      if (!l.interestedProperty) continue;
      propCounts.set(l.interestedProperty, (propCounts.get(l.interestedProperty) ?? 0) + 1);
    }
    const propertyInterest = [...propCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    return {
      cards: {
        total,
        newToday,
        active,
        followUpsDue,
        closed,
        lost,
        conversionRate,
        avgResponseHours,
        mostRequestedProperty: topOf(allLeads.map((l) => l.interestedProperty)),
        mostPopularInvestmentPlan,
        mostPopularMortgagePlan,
      },
      charts: {
        leadsByMonth: months.map((m) => ({ month: m.label, count: m.count })),
        leadsBySource: [...bySource.entries()].map(([source, count]) => ({ source: leadSourceLabel(source), count })),
        funnel,
        salesPerformance: [...perfMap.values()],
        propertyInterest,
      },
    };
  }),

  // ── My notifications (any signed-in admin) ────────────────────
  myNotifications: adminSessionQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(adminNotifications)
      .where(or(isNull(adminNotifications.adminId), eq(adminNotifications.adminId, ctx.admin.id)))
      .orderBy(desc(adminNotifications.createdAt))
      .limit(100);
  }),

  myUnreadCount: adminSessionQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({ id: adminNotifications.id })
      .from(adminNotifications)
      .where(
        and(
          or(isNull(adminNotifications.adminId), eq(adminNotifications.adminId, ctx.admin.id)),
          eq(adminNotifications.isRead, "no"),
        ),
      );
    return { count: rows.length };
  }),

  markMyNotificationRead: adminSessionQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db
        .update(adminNotifications)
        .set({ isRead: "yes" })
        .where(
          and(
            eq(adminNotifications.id, input.id),
            or(isNull(adminNotifications.adminId), eq(adminNotifications.adminId, ctx.admin.id)),
          ),
        );
      return { success: true };
    }),

  markAllMyNotificationsRead: adminSessionQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .update(adminNotifications)
      .set({ isRead: "yes" })
      .where(
        and(
          or(isNull(adminNotifications.adminId), eq(adminNotifications.adminId, ctx.admin.id)),
          eq(adminNotifications.isRead, "no"),
        ),
      );
    return { success: true };
  }),
});
