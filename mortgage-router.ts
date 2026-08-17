import { z } from "zod";
import { fmtMoney, fmtDateTime } from "./lib/format";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { createRouter, publicQuery, investorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { products, mortgagePlans, mortgages, mortgagePayments, investorNotifications } from "@db/schema";
import { quoteMortgage, addPeriod } from "./lib/mortgage";
import { debitWallet } from "./lib/wallet";
import { logInvestorActivity, notifyAdmin } from "./lib/activity";
import { notifyAdminEmail } from "./lib/notify";
import { generatePdfDocument } from "./lib/documents";
import { notifyUser } from "./lib/notify";
import { captureLead, leadEvent } from "./lib/crm";

// Payment receipt payload captured inside the transaction, read after commit.
type MortgageDocInfo = { propertyName: string; planName: string; reference: string; mortgageId: number; amount: number; paymentRef: string; receipt: string; completes: boolean; remaining: number; totalPayable: number; durationMonths: number };

function ref(prefix: string) {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

function parsePlanIds(raw: string | null): number[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function decorate(m: typeof mortgages.$inferSelect) {
  const total = Number(m.totalPayable) || 1;
  const paid = Number(m.amountPaid);
  return {
    ...m,
    progress: Math.min(Math.round((paid / total) * 100), 100),
    completionDate: m.startDate
      ? (() => {
          const d = new Date(m.startDate);
          d.setMonth(d.getMonth() + m.durationMonths);
          return d;
        })()
      : null,
  };
}

export const mortgageRouter = createRouter({
  // Public: active mortgage plans (mortgage info page + calculator)
  publicPlans: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(mortgagePlans).where(eq(mortgagePlans.status, "active")).orderBy(mortgagePlans.name);
  }),

  // Storefront: mortgage options for a catalog product
  mortgageOptions: publicQuery
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      const product = rows.at(0);
      if (!product || product.mortgageEnabled !== "yes") return { enabled: false as const };

      const ids = parsePlanIds(product.mortgagePlanIds);
      const plans = ids.length
        ? await db.select().from(mortgagePlans).where(and(inArray(mortgagePlans.id, ids), eq(mortgagePlans.status, "active")))
        : [];
      const price = Number(product.price);
      const minDown = product.minDownPaymentPercent ? Number(product.minDownPaymentPercent) : null;
      return {
        enabled: true as const,
        product: {
          id: product.id,
          name: product.name,
          price,
          image: Array.isArray(product.images) ? (product.images as string[])[0] : null,
          size: product.size,
          bedrooms: product.bedrooms,
          bathrooms: product.bathrooms,
        },
        conditions: product.mortgageConditions ?? null,
        plans: plans.map((p) => {
          const q = quoteMortgage(price, p, minDown);
          return {
            id: p.id,
            name: p.name,
            planType: p.planType,
            paymentFrequency: p.paymentFrequency,
            durationValue: p.durationValue,
            durationMonths: q.durationMonths,
            interestPercent: Number(p.interestPercent),
            downPaymentPercent: q.downPercent,
            downPayment: q.downPayment,
            totalPayable: q.totalPayable,
            installment: q.installment,
            periods: q.periods,
            gracePeriodDays: p.gracePeriodDays,
            lateFeePercent: p.lateFeePercent ? Number(p.lateFeePercent) : null,
          };
        }),
      };
    }),

  // Investor: submit a mortgage application
  applyForMortgage: investorQuery
    .input(z.object({ productId: z.number(), planId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const product = (await db.select().from(products).where(eq(products.id, input.productId)).limit(1)).at(0);
      if (!product || product.isActive !== "yes" || product.mortgageEnabled !== "yes") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This property is not available for mortgage purchase." });
      }
      const ids = parsePlanIds(product.mortgagePlanIds);
      if (!ids.includes(input.planId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This mortgage plan is not available for this property." });
      }
      const plan = (await db.select().from(mortgagePlans).where(eq(mortgagePlans.id, input.planId)).limit(1)).at(0);
      if (!plan || plan.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This mortgage plan is no longer available." });
      }

      // One open mortgage per property per investor
      const open = await db
        .select({ id: mortgages.id })
        .from(mortgages)
        .where(
          and(
            eq(mortgages.investorId, ctx.investor.id),
            eq(mortgages.productId, input.productId),
            notInArray(mortgages.status, ["rejected", "completed"]),
          ),
        )
        .limit(1);
      if (open.length) {
        throw new TRPCError({ code: "CONFLICT", message: "You already have an open mortgage application for this property." });
      }

      const price = Number(product.price);
      const minDown = product.minDownPaymentPercent ? Number(product.minDownPaymentPercent) : null;
      const q = quoteMortgage(price, plan, minDown);
      const reference = ref("MTG");

      const [row] = await db
        .insert(mortgages)
        .values({
          reference,
          investorId: ctx.investor.id,
          productId: product.id,
          planId: plan.id,
          propertyName: product.name,
          propertyImage: Array.isArray(product.images) ? String((product.images as string[])[0] ?? "") : null,
          propertyPrice: price.toFixed(2),
          planName: plan.name,
          planType: plan.planType,
          paymentFrequency: plan.paymentFrequency,
          durationMonths: q.durationMonths,
          installmentAmount: q.installment.toFixed(2),
          downPaymentAmount: q.downPayment.toFixed(2),
          totalPayable: q.totalPayable.toFixed(2),
          amountPaid: "0.00",
          remainingBalance: q.totalPayable.toFixed(2),
          status: "pending",
        })
        .$returningId();

      await db.insert(investorNotifications).values({
        investorId: ctx.investor.id,
        title: "Mortgage Application Submitted",
        message: `Your mortgage application ${reference} for ${product.name} (${plan.name}) was submitted and is awaiting review. Down payment on approval: ${fmtMoney(q.downPayment)}.`,
        type: "success",
        category: "mortgages",
        link: "/invest/dashboard?tab=mortgages",
        relatedRef: reference,
      });
      void notifyUser(ctx.investor.id, {
        type: "mortgage_application_submitted",
        category: "mortgages",
        title: "Mortgage Application Submitted",
        message: `Your mortgage application for ${product.name} (${plan.name}) was submitted and is awaiting review.`,
        severity: "success",
        link: "/invest/dashboard?tab=mortgages",
        relatedRef: reference,
        inApp: false,
        emailDetails: [
          { label: "Property", value: product.name },
          { label: "Plan", value: plan.name },
          { label: "Total Payable", value: fmtMoney(q.totalPayable) },
          { label: "Down Payment on Approval", value: fmtMoney(q.downPayment) },
        ],
      });
      await notifyAdmin(
        "New Mortgage Application",
        `${ctx.investor.name} applied for a mortgage on ${product.name} (${fmtMoney(price)}) — ${plan.name}, total payable ${fmtMoney(q.totalPayable)}. Ref ${reference}.`,
        "order",
      );
      void notifyAdminEmail({
        eyebrow: "Mortgage Application Requires Review",
        heading: `Financing Application — ${product.name}`,
        intro: `${ctx.investor.name} applied to finance ${product.name} with the ${plan.name} plan.`,
        details: [
          { label: "Customer", value: `${ctx.investor.name} · ${ctx.investor.email}` },
          { label: "Property", value: `${product.name} (${fmtMoney(price)})` },
          { label: "Plan", value: plan.name },
          { label: "Total Payable", value: fmtMoney(q.totalPayable) },
          { label: "Down Payment on Approval", value: fmtMoney(q.downPayment) },
          { label: "Reference", value: reference },
          { label: "Date / Time", value: fmtDateTime(new Date()) },
          { label: "Status", value: "Pending Review" },
        ],
        adminLink: "/admin/dashboard?section=mortgages",
        ctaLabel: "Review Financing",
        reqHeaders: ctx.req.headers,
      });
      await logInvestorActivity(ctx.investor.id, "mortgage_applied", `Applied for mortgage ${reference} on ${product.name} (${plan.name})`, ctx.req.headers);
      // CRM: capture the applicant as a lead and log the conversion event
      void (async () => {
        await captureLead({
          name: ctx.investor.name,
          email: ctx.investor.email,
          phone: ctx.investor.phone,
          country: ctx.investor.country,
          source: "mortgage_inquiry",
          interestedProperty: product.name,
          mortgageInterest: plan.name,
          notify: false,
        });
        await leadEvent({
          email: ctx.investor.email,
          type: "mortgage_applied",
          description: `Mortgage application ${reference} submitted for ${product.name} (${plan.name})`,
          stage: "mortgage_processing",
        });
      })();
      return { success: true, mortgageId: row.id, reference };
    }),

  // Investor: my mortgages
  myMortgages: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(mortgages)
      .where(eq(mortgages.investorId, ctx.investor.id))
      .orderBy(desc(mortgages.createdAt));
    return rows.map(decorate);
  }),

  // Investor: payment history
  paymentHistory: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const payments = await db
      .select()
      .from(mortgagePayments)
      .where(eq(mortgagePayments.investorId, ctx.investor.id))
      .orderBy(desc(mortgagePayments.createdAt))
      .limit(300);
    const myMortgages = await db.select().from(mortgages).where(eq(mortgages.investorId, ctx.investor.id));
    const byId = new Map(myMortgages.map((m) => [m.id, m]));
    return payments.map((p) => ({
      ...p,
      propertyName: byId.get(p.mortgageId)?.propertyName ?? "—",
      planName: byId.get(p.mortgageId)?.planName ?? "—",
    }));
  }),

  // Investor: make a payment from the wallet
  payMortgage: investorQuery
    .input(z.object({ mortgageId: z.number(), amount: z.number().positive().max(10_000_000) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      let mortgageDoc: MortgageDocInfo | null = null;
      const result = await db.transaction(async (tx) => {
        const rows = await tx.select().from(mortgages).where(eq(mortgages.id, input.mortgageId)).limit(1);
        const m = rows.at(0);
        if (!m || m.investorId !== ctx.investor.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Mortgage not found" });
        }
        if (m.status === "suspended") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This mortgage is suspended. Please contact support." });
        }
        if (m.status !== "approved" && m.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This mortgage is not accepting payments." });
        }

        const remaining = Number(m.remainingBalance);
        const amount = Math.round(input.amount * 100) / 100;
        if (m.status === "approved" && amount + 0.001 < Number(m.downPaymentAmount)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Your first payment must cover the down payment of ${fmtMoney(Number(m.downPaymentAmount))}.`,
          });
        }
        if (amount > remaining) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Amount exceeds the remaining balance of ${fmtMoney(remaining)}.`,
          });
        }

        const walletBefore = Number(ctx.investor.walletBalance);
        const paymentRef = ref("MP");
        const receipt = ref("RCP");

        // Wallet deduction first — throws on insufficient funds / frozen wallet
        await debitWallet(tx, {
          investorId: ctx.investor.id,
          amount,
          type: "mortgage_payment",
          description: `Mortgage payment — ${m.propertyName} (${m.reference})`,
          reference: paymentRef,
          notification: {
            title: "Mortgage Payment Received",
            message: `Your payment of ${fmtMoney(amount)} toward ${m.propertyName} was received.`,
          },
        });

        const newPaid = Math.round((Number(m.amountPaid) + amount) * 100) / 100;
        const newRemaining = Math.round((remaining - amount) * 100) / 100;
        const completes = newRemaining <= 0.009;

        const now = new Date();
        const update: Record<string, unknown> = {
          amountPaid: newPaid.toFixed(2),
          remainingBalance: Math.max(newRemaining, 0).toFixed(2),
        };
        if (m.status === "approved") {
          // Down payment activates the mortgage
          update.status = completes ? "completed" : "active";
          update.startDate = now;
          update.nextPaymentAt = completes ? null : addPeriod(now, m.paymentFrequency);
        }
        if (m.status === "active" && m.nextPaymentAt) {
          // Advance the schedule past any paid-due periods
          let next = new Date(m.nextPaymentAt);
          if (next <= now) {
            while (next <= now) next = addPeriod(next, m.paymentFrequency);
            update.nextPaymentAt = completes ? null : next;
          }
        }
        if (completes) {
          update.status = "completed";
          update.completedAt = now;
          update.nextPaymentAt = null;
        }
        await tx.update(mortgages).set(update).where(eq(mortgages.id, m.id));

        const [paymentRow] = await tx
          .insert(mortgagePayments)
          .values({
            mortgageId: m.id,
            investorId: ctx.investor.id,
            amount: amount.toFixed(2),
            walletBalanceBefore: walletBefore.toFixed(2),
            walletBalanceAfter: (walletBefore - amount).toFixed(2),
            remainingBalanceAfter: Math.max(newRemaining, 0).toFixed(2),
            reference: paymentRef,
            receiptNo: receipt,
            method: "wallet",
          })
          .$returningId();

        if (completes) {
          await tx.insert(investorNotifications).values({
            investorId: ctx.investor.id,
            title: "Mortgage Completed 🎉",
            message: `Congratulations! Your mortgage for ${m.propertyName} is fully paid. The property is now yours outright.`,
            type: "success",
          });
          await notifyAdmin("Mortgage Fully Paid", `Mortgage ${m.reference} (${m.propertyName}) is fully paid by ${ctx.investor.name}.`, "order");
        }

        await logInvestorActivity(
          ctx.investor.id,
          "mortgage_payment",
          `Paid ${fmtMoney(amount)} toward mortgage ${m.reference} (${m.propertyName})${completes ? " — mortgage completed" : ""}`,
          ctx.req.headers,
          tx,
        );

        mortgageDoc = {
          propertyName: m.propertyName,
          planName: m.planName,
          reference: m.reference,
          mortgageId: m.id,
          amount,
          paymentRef,
          receipt,
          completes,
          remaining: Math.max(newRemaining, 0),
          totalPayable: Number(m.totalPayable),
          durationMonths: m.durationMonths,
        };

        return {
          success: true,
          completed: completes,
          remainingBalance: Math.max(newRemaining, 0),
          paymentId: paymentRow.id,
          receiptNo: receipt,
        };
      });

      const mDoc = mortgageDoc as MortgageDocInfo | null;
      if (mDoc) {
        const d = mDoc;
        void generatePdfDocument({
          investorId: ctx.investor.id,
          ownerEmail: ctx.investor.email,
          ownerName: ctx.investor.name,
          category: "financial",
          docType: "Mortgage Payment Receipt",
          amount: d.amount,
          reference: d.receipt,
          propertyName: d.propertyName,
          links: { mortgageId: d.mortgageId },
          lines: [
            { label: "Property", value: d.propertyName },
            { label: "Mortgage Reference", value: d.reference },
            { label: "Payment Reference", value: d.paymentRef },
            { label: "Payment Method", value: "Wallet" },
            { label: "Remaining Balance", value: fmtMoney(d.remaining) },
            { label: "Status", value: d.completes ? "Final Payment — Completed" : "Payment Received" },
          ],
          note: d.completes
            ? "This was your final payment — the mortgage is now fully settled."
            : "Your mortgage payment has been received and applied to your balance.",
        });
        if (d.completes) {
          void generatePdfDocument({
            investorId: ctx.investor.id,
            ownerEmail: ctx.investor.email,
            ownerName: ctx.investor.name,
            category: "mortgage",
            docType: "Mortgage Completion Certificate",
            amount: d.totalPayable,
            reference: d.reference,
            propertyName: d.propertyName,
            links: { mortgageId: d.mortgageId },
            lines: [
              { label: "Property", value: d.propertyName },
              { label: "Mortgage Plan", value: d.planName },
              { label: "Total Paid", value: fmtMoney(d.totalPayable) },
              { label: "Duration", value: `${d.durationMonths} months` },
              { label: "Status", value: "Fully Paid — Completed" },
            ],
            note: "This certificate confirms that the mortgage for the property above has been fully settled. The property is now yours outright.",
          });
        }
      }
      return result;
    }),
});
