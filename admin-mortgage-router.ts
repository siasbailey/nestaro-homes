import { z } from "zod";
import { fmtMoney } from "./lib/format";
import { TRPCError } from "@trpc/server";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { createRouter, investAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { products, mortgagePlans, mortgages, mortgagePayments, investors, investorNotifications, orders } from "@db/schema";
import { logAudit } from "./lib/activity";
import { generatePdfDocument } from "./lib/documents";
import { sendSystemMessage } from "./lib/messaging";
import { notifyUser } from "./lib/notify";

function parsePlanIds(raw: string | null): number[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

const planInput = z.object({
  name: z.string().min(2).max(150),
  planType: z.enum(["monthly", "yearly"]),
  durationValue: z.number().int().min(1).max(360),
  downPaymentPercent: z.number().min(0).max(100),
  interestPercent: z.number().min(0).max(100),
  paymentFrequency: z.enum(["monthly", "yearly"]),
  gracePeriodDays: z.number().int().min(0).max(365).optional().nullable(),
  lateFeePercent: z.number().min(0).max(100).optional().nullable(),
});

export const adminMortgageRouter = createRouter({
  // ── Mortgage Plans ────────────────────────────────────────────
  plans: investAdminQuery.query(async () => {
    const db = getDb();
    const plans = await db.select().from(mortgagePlans).orderBy(mortgagePlans.planType, mortgagePlans.durationValue);
    const usage = await db.select({ planId: mortgages.planId, count: sql<number>`COUNT(*)` }).from(mortgages).groupBy(mortgages.planId);
    const usageMap = new Map(usage.map((u) => [u.planId, Number(u.count)]));
    return plans.map((p) => ({ ...p, usedBy: usageMap.get(p.id) ?? 0 }));
  }),

  createPlan: investAdminQuery.input(planInput).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const [row] = await db
      .insert(mortgagePlans)
      .values({
        name: input.name.trim(),
        planType: input.planType,
        durationValue: input.durationValue,
        downPaymentPercent: input.downPaymentPercent.toFixed(2),
        interestPercent: input.interestPercent.toFixed(2),
        paymentFrequency: input.paymentFrequency,
        gracePeriodDays: input.gracePeriodDays ?? null,
        lateFeePercent: input.lateFeePercent != null ? input.lateFeePercent.toFixed(2) : null,
        status: "active",
      })
      .$returningId();
    await logAudit(ctx.investor.id, ctx.investor.name, "mortgage_plan_created", `Created mortgage plan "${input.name}" (${input.durationValue} ${input.planType === "yearly" ? "years" : "months"})`, ctx.req.headers);
    return { success: true, planId: row.id };
  }),

  updatePlan: investAdminQuery
    .input(planInput.extend({ planId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db
        .update(mortgagePlans)
        .set({
          name: input.name.trim(),
          planType: input.planType,
          durationValue: input.durationValue,
          downPaymentPercent: input.downPaymentPercent.toFixed(2),
          interestPercent: input.interestPercent.toFixed(2),
          paymentFrequency: input.paymentFrequency,
          gracePeriodDays: input.gracePeriodDays ?? null,
          lateFeePercent: input.lateFeePercent != null ? input.lateFeePercent.toFixed(2) : null,
        })
        .where(eq(mortgagePlans.id, input.planId));
      await logAudit(ctx.investor.id, ctx.investor.name, "mortgage_plan_updated", `Updated mortgage plan #${input.planId} "${input.name}"`, ctx.req.headers);
      return { success: true };
    }),

  setPlanStatus: investAdminQuery
    .input(z.object({ planId: z.number(), status: z.enum(["active", "inactive"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.update(mortgagePlans).set({ status: input.status }).where(eq(mortgagePlans.id, input.planId));
      await logAudit(ctx.investor.id, ctx.investor.name, "mortgage_plan_status", `Plan #${input.planId} → ${input.status}`, ctx.req.headers);
      return { success: true };
    }),

  deletePlan: investAdminQuery
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const used = await db.select({ id: mortgages.id }).from(mortgages).where(eq(mortgages.planId, input.planId)).limit(1);
      if (used.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This plan is used by existing mortgages — deactivate it instead." });
      }
      await db.delete(mortgagePlans).where(eq(mortgagePlans.id, input.planId));
      await logAudit(ctx.investor.id, ctx.investor.name, "mortgage_plan_deleted", `Deleted mortgage plan #${input.planId}`, ctx.req.headers);
      return { success: true };
    }),

  // ── Property mortgage settings ────────────────────────────────
  mortgageProducts: investAdminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(products).orderBy(products.name);
    const plans = await db.select().from(mortgagePlans);
    const planMap = new Map(plans.map((p) => [p.id, p.name]));
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      isActive: p.isActive,
      mortgageEnabled: p.mortgageEnabled,
      planIds: parsePlanIds(p.mortgagePlanIds),
      planNames: parsePlanIds(p.mortgagePlanIds).map((id) => planMap.get(id) ?? `#${id}`),
      minDownPaymentPercent: p.minDownPaymentPercent,
      mortgageConditions: p.mortgageConditions,
    }));
  }),

  updateProductMortgage: investAdminQuery
    .input(
      z.object({
        productId: z.number(),
        enabled: z.boolean(),
        planIds: z.array(z.number()).default([]),
        minDownPaymentPercent: z.number().min(0).max(100).optional().nullable(),
        conditions: z.string().max(2000).optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const product = (await db.select().from(products).where(eq(products.id, input.productId)).limit(1)).at(0);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      if (input.enabled && input.planIds.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Assign at least one mortgage plan before enabling." });
      }
      await db
        .update(products)
        .set({
          mortgageEnabled: input.enabled ? "yes" : "no",
          mortgagePlanIds: JSON.stringify(input.planIds),
          minDownPaymentPercent: input.minDownPaymentPercent != null ? input.minDownPaymentPercent.toFixed(2) : null,
          mortgageConditions: input.conditions?.trim() || null,
        })
        .where(eq(products.id, input.productId));
      await logAudit(
        ctx.investor.id,
        ctx.investor.name,
        "product_mortgage_updated",
        `${product.name}: mortgage ${input.enabled ? `enabled with plans [${input.planIds.join(", ")}]` : "disabled"}`,
        ctx.req.headers,
      );
      return { success: true };
    }),

  // ── Mortgage management ───────────────────────────────────────
  mortgageStats: investAdminQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(mortgages);
    const payments = await db.select().from(mortgagePayments);
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      total: all.length,
      pending: all.filter((m) => m.status === "pending").length,
      approved: all.filter((m) => m.status === "approved").length,
      active: all.filter((m) => m.status === "active").length,
      completed: all.filter((m) => m.status === "completed").length,
      revenue: payments.reduce((s, p) => s + Number(p.amount), 0),
      outstanding: all
        .filter((m) => ["approved", "active", "suspended"].includes(m.status))
        .reduce((s, m) => s + Number(m.remainingBalance), 0),
      upcoming: all.filter((m) => m.status === "active" && m.nextPaymentAt && new Date(m.nextPaymentAt) < soon).length,
    };
  }),

  mortgageList: investAdminQuery
    .input(z.object({ status: z.string().optional(), search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(mortgages).orderBy(desc(mortgages.createdAt)).limit(300);
      const investorIds = [...new Set(rows.map((m) => m.investorId))];
      const investorRows = investorIds.length
        ? await db.select().from(investors).where(inArray(investors.id, investorIds))
        : [];
      const investorMap = new Map(investorRows.map((i) => [i.id, i]));
      const search = input?.search?.toLowerCase().trim();
      return rows
        .map((m) => {
          const inv = investorMap.get(m.investorId);
          return {
            ...m,
            progress: Math.min(Math.round((Number(m.amountPaid) / (Number(m.totalPayable) || 1)) * 100), 100),
            investorName: inv?.name ?? "—",
            investorEmail: inv?.email ?? "—",
            investorAvatar: inv?.avatar ?? null,
          };
        })
        .filter((m) => (input?.status && input.status !== "all" ? m.status === input.status : true))
        .filter((m) =>
          search
            ? `${m.reference} ${m.propertyName} ${m.planName} ${m.investorName} ${m.investorEmail}`.toLowerCase().includes(search)
            : true,
        );
    }),

  mortgageDetail: investAdminQuery
    .input(z.object({ mortgageId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const m = (await db.select().from(mortgages).where(eq(mortgages.id, input.mortgageId)).limit(1)).at(0);
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Mortgage not found" });
      const inv = (await db.select().from(investors).where(eq(investors.id, m.investorId)).limit(1)).at(0);
      const payments = await db.select().from(mortgagePayments).where(eq(mortgagePayments.mortgageId, m.id)).orderBy(desc(mortgagePayments.createdAt));
      return {
        ...m,
        investor: inv ? { name: inv.name, email: inv.email, phone: inv.phone, country: inv.country, avatar: inv.avatar ?? null } : null,
        payments,
      };
    }),

  reviewMortgage: investAdminQuery
    .input(
      z.object({
        mortgageId: z.number(),
        action: z.enum(["approve", "reject", "suspend", "resume", "complete"]),
        note: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const m = (await db.select().from(mortgages).where(eq(mortgages.id, input.mortgageId)).limit(1)).at(0);
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Mortgage not found" });

      const allowed: Record<string, string[]> = {
        approve: ["pending"],
        reject: ["pending"],
        suspend: ["approved", "active"],
        resume: ["suspended"],
        complete: ["approved", "active", "suspended"],
      };
      if (!allowed[input.action].includes(m.status)) {
        throw new TRPCError({ code: "CONFLICT", message: `Cannot ${input.action} a mortgage in status "${m.status}".` });
      }

      const now = new Date();
      const update: Record<string, unknown> = { adminNote: input.note?.trim() || m.adminNote };
      let title = "";
      let message = "";
      switch (input.action) {
        case "approve":
          update.status = "approved";
          update.approvedAt = now;
          title = "Mortgage Approved";
          message = `Great news! Your mortgage ${m.reference} for ${m.propertyName} was approved. Pay the down payment of ${fmtMoney(Number(m.downPaymentAmount))} from your wallet to activate it.`;
          break;
        case "reject":
          update.status = "rejected";
          title = "Mortgage Application Rejected";
          message = `Your mortgage application ${m.reference} for ${m.propertyName} was rejected.${input.note ? ` Reason: ${input.note}` : ""}`;
          break;
        case "suspend":
          update.status = "suspended";
          title = "Mortgage Suspended";
          message = `Your mortgage ${m.reference} for ${m.propertyName} was suspended.${input.note ? ` Reason: ${input.note}` : ""} Please contact support.`;
          break;
        case "resume":
          update.status = m.startDate ? "active" : "approved";
          title = "Mortgage Resumed";
          message = `Your mortgage ${m.reference} for ${m.propertyName} is active again.`;
          break;
        case "complete":
          update.status = "completed";
          update.completedAt = now;
          update.remainingBalance = "0.00";
          update.nextPaymentAt = null;
          title = "Mortgage Completed";
          message = `Your mortgage ${m.reference} for ${m.propertyName} was marked as completed.`;
          break;
      }
      await db.update(mortgages).set(update).where(eq(mortgages.id, m.id));
      await db.insert(investorNotifications).values({ investorId: m.investorId, title, message, type: input.action === "reject" || input.action === "suspend" ? "warning" : "success" });
      await logAudit(ctx.investor.id, ctx.investor.name, `mortgage_${input.action}d`, `${m.reference} (${m.propertyName})${input.note ? ` — ${input.note}` : ""}`, ctx.req.headers);
      if (input.action === "approve" || input.action === "reject") {
        void sendSystemMessage(m.investorId, {
          subject: input.action === "approve" ? "Mortgage Approved" : "Mortgage Application Rejected",
          category: "mortgage_support",
          body: message,
          propertyName: m.propertyName,
          notify: false,
        });
        void notifyUser(m.investorId, {
          type: input.action === "approve" ? "mortgage_approved" : "mortgage_rejected",
          category: "mortgages",
          title: input.action === "approve" ? "Mortgage Approved" : "Mortgage Application Rejected",
          message,
          severity: input.action === "approve" ? "success" : "error",
          link: "/invest/dashboard?tab=mortgages",
          relatedRef: m.reference,
          inApp: false,
          emailDetails: [
            { label: "Property", value: m.propertyName },
            { label: "Plan", value: m.planName },
            { label: "Installment", value: fmtMoney(m.installmentAmount) },
          ],
        });
      }

      // ── Auto-generated mortgage documents ──
      if (input.action === "approve" || input.action === "complete") {
        const invRows = await db.select().from(investors).where(eq(investors.id, m.investorId)).limit(1);
        const inv = invRows.at(0);
        if (inv) {
          if (input.action === "approve") {
            void generatePdfDocument({
              investorId: inv.id,
              ownerEmail: inv.email,
              ownerName: inv.name,
              category: "mortgage",
              docType: "Mortgage Approval Letter",
              amount: Number(m.totalPayable),
              reference: m.reference,
              propertyName: m.propertyName,
              links: { mortgageId: m.id },
              lines: [
                { label: "Property", value: m.propertyName },
                { label: "Property Price", value: fmtMoney(Number(m.propertyPrice)) },
                { label: "Mortgage Plan", value: m.planName },
                { label: "Down Payment", value: fmtMoney(Number(m.downPaymentAmount)) },
                { label: "Monthly Payment", value: fmtMoney(Number(m.installmentAmount)) },
                { label: "Duration", value: `${m.durationMonths} months` },
                { label: "Status", value: "Approved — Awaiting Down Payment" },
              ],
              note: "Congratulations — your mortgage application has been approved. Pay the down payment from your wallet to activate the payment schedule.",
            });
            void generatePdfDocument({
              investorId: inv.id,
              ownerEmail: inv.email,
              ownerName: inv.name,
              category: "mortgage",
              docType: "Mortgage Agreement",
              amount: Number(m.totalPayable),
              reference: m.reference,
              propertyName: m.propertyName,
              links: { mortgageId: m.id },
              lines: [
                { label: "Property", value: m.propertyName },
                { label: "Buyer", value: inv.name },
                { label: "Property Price", value: fmtMoney(Number(m.propertyPrice)) },
                { label: "Down Payment", value: fmtMoney(Number(m.downPaymentAmount)) },
                { label: "Financed Amount", value: fmtMoney(Number(m.totalPayable) - Number(m.downPaymentAmount)) },
                { label: "Monthly Payment", value: fmtMoney(Number(m.installmentAmount)) },
                { label: "Duration", value: `${m.durationMonths} months` },
                { label: "Total Payable", value: fmtMoney(Number(m.totalPayable)) },
              ],
              note: "This agreement sets out the mortgage terms between you and Nestaro Homes LLC for the property described above.",
            });
          } else {
            void generatePdfDocument({
              investorId: inv.id,
              ownerEmail: inv.email,
              ownerName: inv.name,
              category: "mortgage",
              docType: "Mortgage Completion Certificate",
              amount: Number(m.totalPayable),
              reference: m.reference,
              propertyName: m.propertyName,
              links: { mortgageId: m.id },
              lines: [
                { label: "Property", value: m.propertyName },
                { label: "Mortgage Plan", value: m.planName },
                { label: "Total Paid", value: fmtMoney(Number(m.totalPayable)) },
                { label: "Duration", value: `${m.durationMonths} months` },
                { label: "Status", value: "Fully Paid — Completed" },
              ],
              note: "This certificate confirms that the mortgage for the property above has been fully settled. Ownership documentation will now be finalized.",
            });
          }
        }
      }
      return { success: true };
    }),

  // Manual payment adjustment (does not touch the investor's wallet)
  adjustMortgage: investAdminQuery
    .input(z.object({ mortgageId: z.number(), amount: z.number().positive().max(10_000_000), note: z.string().min(3).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const m = (await tx.select().from(mortgages).where(eq(mortgages.id, input.mortgageId)).limit(1)).at(0);
        if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Mortgage not found" });
        if (!["approved", "active", "suspended"].includes(m.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Adjustments are only allowed on open mortgages." });
        }
        const remaining = Number(m.remainingBalance);
        const amount = Math.min(Math.round(input.amount * 100) / 100, remaining);
        const newRemaining = Math.round((remaining - amount) * 100) / 100;
        const completes = newRemaining <= 0.009;
        const now = new Date();

        await tx
          .update(mortgages)
          .set({
            amountPaid: (Number(m.amountPaid) + amount).toFixed(2),
            remainingBalance: Math.max(newRemaining, 0).toFixed(2),
            ...(completes ? { status: "completed" as const, completedAt: now, nextPaymentAt: null } : {}),
          })
          .where(eq(mortgages.id, m.id));

        await tx.insert(mortgagePayments).values({
          mortgageId: m.id,
          investorId: m.investorId,
          amount: amount.toFixed(2),
          walletBalanceBefore: null,
          walletBalanceAfter: null,
          remainingBalanceAfter: Math.max(newRemaining, 0).toFixed(2),
          reference: `ADJ-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
          receiptNo: `RCP-ADJ-${Date.now().toString(36).toUpperCase()}`,
          method: "manual_adjustment",
          note: input.note.trim(),
        });

        await tx.insert(investorNotifications).values({
          investorId: m.investorId,
          title: "Mortgage Adjustment Posted",
          message: `A manual adjustment of ${fmtMoney(amount)} was posted to your mortgage ${m.reference} (${m.propertyName}). ${completes ? "Your mortgage is now completed." : `Remaining balance: ${fmtMoney(newRemaining)}.`}`,
          type: "info",
        });
        await logAudit(ctx.investor.id, ctx.investor.name, "mortgage_adjustment", `${m.reference}: +${fmtMoney(amount)} — ${input.note}`, ctx.req.headers, tx);
        return { success: true, completed: completes, remainingBalance: Math.max(newRemaining, 0) };
      });
    }),

  // ── Reports & analytics ───────────────────────────────────────
  mortgageReport: investAdminQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(mortgages);
    const payments = await db.select().from(mortgagePayments).orderBy(mortgagePayments.createdAt);
    const outrightOrders = await db.select({ count: sql<number>`COUNT(*)` }).from(orders);

    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    const monthlyCollections = payments
      .filter((p) => {
        const d = new Date(p.createdAt);
        return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
      })
      .reduce((s, p) => s + Number(p.amount), 0);
    const yearlyCollections = payments
      .filter((p) => new Date(p.createdAt).getFullYear() === thisYear)
      .reduce((s, p) => s + Number(p.amount), 0);

    // Last 12 months series for charts/exports
    const series: { month: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const y = d.getFullYear();
      const mo = d.getMonth();
      series.push({
        month: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
        total: payments
          .filter((p) => {
            const pd = new Date(p.createdAt);
            return pd.getFullYear() === y && pd.getMonth() === mo;
          })
          .reduce((s, p) => s + Number(p.amount), 0),
      });
    }

    return {
      totalOutright: Number(outrightOrders[0]?.count ?? 0),
      totalMortgagePurchases: all.length,
      activeMortgages: all.filter((m) => m.status === "active").length,
      completedMortgages: all.filter((m) => m.status === "completed").length,
      mortgageRevenue: payments.reduce((s, p) => s + Number(p.amount), 0),
      outstandingBalances: all
        .filter((m) => ["approved", "active", "suspended"].includes(m.status))
        .reduce((s, m) => s + Number(m.remainingBalance), 0),
      monthlyCollections,
      yearlyCollections,
      series,
    };
  }),
});
