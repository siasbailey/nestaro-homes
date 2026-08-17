import { z } from "zod";
import { fmtMoney, fmtDateTime } from "./lib/format";
import { assertTierAllows } from "./lib/kyc";
import { generatePdfDocument } from "./lib/documents";
import { captureLead, leadEvent } from "./lib/crm";
import { sendSystemMessage } from "./lib/messaging";
import { notifyUser, notifyAdminEmail } from "./lib/notify";
import { LARGE_TRANSACTION_THRESHOLD } from "@contracts/notifications";
import { TRPCError } from "@trpc/server";
import { eq, desc, or, and, sql, inArray, isNull, gte, lte, like } from "drizzle-orm";
import { createRouter, publicQuery, investorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  investmentPlans,
  investmentProjects,
  investments,
  deposits,
  withdrawals,
  withdrawalAccounts,
  investmentTransactions,
  referrals,
  investorNotifications,
  investorActivityLogs,
  investorTokens,
  liquidationRequests,
  accountDeletionFeedback,
  customers,
  orders,
  orderItems,
  orderDocuments,
  trackingHistory,
} from "@db/schema";
import { computeLiquidationEstimate } from "./lib/liquidation";
import { sanitizeInvestor, clearInvestorCookie } from "./investor-auth-router";
import { logInvestorActivity, notifyAdmin, logAudit } from "./lib/activity";
import { sendAccountDeletedEmail } from "./lib/email";
import { PAYMENT_METHOD_LABELS, ReferralBonus, DepositRules } from "@contracts/constants";
import { monthlyProfitFor, payoutCountFor, effectiveDurationDays, durationConfigFor, validateDurationDays, addDays } from "./lib/roi";
import { debitWallet } from "./lib/wallet";
import { profitPayments, investors as investorTableForUpdate, platformSettings } from "@db/schema";

function generateReference(prefix: string) {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

// Recompute derived investment values (value, earnings, ROI, progress) from elapsed time
export function computeInvestmentState(inv: {
  amount: string;
  startDate: Date;
  maturityDate: Date;
  status: string;
}) {
  const principal = Number(inv.amount);
  const start = new Date(inv.startDate).getTime();
  const maturity = new Date(inv.maturityDate).getTime();
  const total = Math.max(maturity - start, 1);
  const now = Date.now();
  const elapsed = Math.min(Math.max(now - start, 0), total);
  const progress = Math.round((elapsed / total) * 100);
  return { principal, progress, matured: now >= maturity };
}

export const investorRouter = createRouter({
  // ── Public: active plans for the landing page ─────────────────
  plans: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(investmentPlans)
      .where(eq(investmentPlans.isActive, "yes"))
      .orderBy(investmentPlans.sortOrder);
    return rows;
  }),

  // ── Public: open/funding projects ─────────────────────────────
  projects: publicQuery.query(async () => {
    const db = getDb();
    return db
      .select()
      .from(investmentProjects)
      .where(or(eq(investmentProjects.status, "open"), eq(investmentProjects.status, "funding")))
      .orderBy(desc(investmentProjects.createdAt));
  }),

  // ── Dashboard aggregate ───────────────────────────────────────
  dashboard: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const investorId = ctx.investor.id;

    const myInvestments = await db
      .select()
      .from(investments)
      .where(eq(investments.investorId, investorId))
      .orderBy(desc(investments.createdAt));

    const plans = await db.select().from(investmentPlans);
    const planMap = new Map(plans.map((p) => [p.id, p]));

    // Compute live values + monthly ROI fields for each investment
    const pendingLiquidations = await db
      .select({ investmentId: liquidationRequests.investmentId })
      .from(liquidationRequests)
      .where(and(eq(liquidationRequests.investorId, investorId), eq(liquidationRequests.status, "pending")));
    const pendingLiquidationIds = new Set(pendingLiquidations.map((r) => r.investmentId));

    const portfolio = myInvestments.map((inv) => {
      const plan = planMap.get(inv.planId);
      const returnRate = inv.customReturnRate ?? plan?.targetReturn ?? Number(inv.roi);
      const durationMonths = plan?.durationMonths ?? 0;
      const payoutCount = plan ? payoutCountFor(inv, plan) : durationMonths || 1;
      const { principal, progress, matured } = computeInvestmentState(inv);
      const { monthlyProfit, monthlyRate } = monthlyProfitFor(principal, returnRate, payoutCount);
      const projectedEarnings = (principal * returnRate) / 100;
      const totalProfitPaid = Number(inv.totalProfitPaid);
      const currentValue =
        inv.status === "active" || inv.status === "suspended"
          ? principal + totalProfitPaid
          : Number(inv.currentValue);
      const remainingDays = Math.max(
        0,
        Math.ceil((new Date(inv.maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );
      return {
        ...inv,
        planName: plan?.name ?? "Plan",
        targetReturn: returnRate,
        durationMonths,
        durationDaysEffective: plan ? effectiveDurationDays(inv, plan) : inv.durationDays ?? durationMonths * 30,
        payoutCount,
        progress: inv.status === "active" ? progress : inv.progress,
        computedCurrentValue: currentValue,
        computedEstimatedEarnings: inv.status === "active" || inv.status === "suspended" ? totalProfitPaid : Number(inv.estimatedEarnings),
        projectedEarnings,
        computedRoi: principal > 0 ? ((totalProfitPaid / principal) * 100) : 0,
        monthlyProfit,
        monthlyRate,
        remainingDays,
        matured,
        pendingLiquidation: pendingLiquidationIds.has(inv.id),
      };
    });

    const activeInvestments = portfolio.filter((i) => i.status === "active" || i.status === "suspended");
    const portfolioValue = activeInvestments.reduce((s, i) => s + i.computedCurrentValue, 0);
    const totalInvested = myInvestments
      .filter((i) => i.status !== "cancelled")
      .reduce((s, i) => s + Number(i.amount), 0);
    const estimatedEarnings = activeInvestments.reduce((s, i) => s + i.computedEstimatedEarnings, 0);
    const totalMonthlyProfitEarned = portfolio.reduce((s, i) => s + Number(i.totalProfitPaid), 0);
    const monthlyIncome = portfolio
      .filter((i) => i.status === "active" && i.profitPaused === "no")
      .reduce((s, i) => s + i.monthlyProfit, 0);

    const unreadNotifications = await db
      .select({ count: sql<number>`count(*)` })
      .from(investorNotifications)
      .where(
        and(
          or(eq(investorNotifications.investorId, investorId), sql`${investorNotifications.investorId} IS NULL`),
          eq(investorNotifications.isRead, "no"),
          eq(investorNotifications.archived, "no"),
          isNull(investorNotifications.deletedAt),
        ),
      );

    const pendingDeposits = await db
      .select({ count: sql<number>`count(*)`, total: sql<string>`coalesce(sum(${deposits.amount}), 0)` })
      .from(deposits)
      .where(and(eq(deposits.investorId, investorId), eq(deposits.status, "pending")));
    const pendingWithdrawals = await db
      .select({ count: sql<number>`count(*)`, total: sql<string>`coalesce(sum(${withdrawals.amount}), 0)` })
      .from(withdrawals)
      .where(and(eq(withdrawals.investorId, investorId), eq(withdrawals.status, "pending")));

    // Earnings credited during the current calendar month (realized ROI)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthProfits = await db
      .select({ total: sql<string>`coalesce(sum(${profitPayments.amount}), 0)` })
      .from(profitPayments)
      .where(
        and(
          eq(profitPayments.investorId, investorId),
          eq(profitPayments.status, "paid"),
          gte(profitPayments.paidAt, monthStart),
        ),
      );

    return {
      investor: sanitizeInvestor(ctx.investor),
      stats: {
        portfolioValue,
        totalInvested,
        estimatedEarnings,
        activeInvestments: activeInvestments.length,
        walletBalance: Number(ctx.investor.walletBalance),
        totalEarnings: Number(ctx.investor.totalEarnings),
        referralEarnings: Number(ctx.investor.referralEarnings),
        unreadNotifications: Number(unreadNotifications[0]?.count ?? 0),
        totalMonthlyProfitEarned,
        monthlyIncome,
        monthlyEarnings: Number(monthProfits[0]?.total ?? 0),
        pendingInvestments: portfolio.filter((i) => i.status === "pending").length,
        availableWithdrawalBalance: Number(ctx.investor.walletBalance),
        totalDeposited: Number(ctx.investor.totalDeposited),
        totalWithdrawn: Number(ctx.investor.totalWithdrawn),
        withdrawalCount: Number(ctx.investor.withdrawalCount ?? 0),
        walletFrozen: ctx.investor.walletFrozen === "yes",
        pendingDepositsCount: Number(pendingDeposits[0]?.count ?? 0),
        pendingDepositsAmount: Number(pendingDeposits[0]?.total ?? 0),
        pendingWithdrawalsCount: Number(pendingWithdrawals[0]?.count ?? 0),
        pendingWithdrawalsAmount: Number(pendingWithdrawals[0]?.total ?? 0),
        nextPaymentDate: (() => {
          const dates = portfolio
            .filter((i) => i.status === "active" && i.profitPaused === "no" && i.nextProfitAt)
            .map((i) => new Date(i.nextProfitAt!).getTime());
          return dates.length ? new Date(Math.min(...dates)).toISOString() : null;
        })(),
      },
      portfolio,
    };
  }),

  // ── Portfolio (investments + plan info) ───────────────────────
  portfolio: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(investments)
      .where(eq(investments.investorId, ctx.investor.id))
      .orderBy(desc(investments.createdAt));
    const plans = await db.select().from(investmentPlans);
    const planMap = new Map(plans.map((p) => [p.id, p]));
    return rows.map((inv) => {
      const plan = planMap.get(inv.planId);
      const returnRate = inv.customReturnRate ?? plan?.targetReturn ?? Number(inv.roi);
      const durationMonths = plan?.durationMonths ?? 0;
      const payoutCount = plan ? payoutCountFor(inv, plan) : durationMonths || 1;
      const { principal, progress, matured } = computeInvestmentState(inv);
      const { monthlyProfit, monthlyRate } = monthlyProfitFor(principal, returnRate, payoutCount);
      const totalProfitPaid = Number(inv.totalProfitPaid);
      const projectedEarnings = (principal * returnRate) / 100;
      const remainingDays = Math.max(
        0,
        Math.ceil((new Date(inv.maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );
      return {
        ...inv,
        planName: plan?.name ?? "Plan",
        durationMonths,
        durationDaysEffective: plan ? effectiveDurationDays(inv, plan) : inv.durationDays ?? durationMonths * 30,
        payoutCount,
        targetReturn: returnRate,
        progress: inv.status === "active" ? progress : inv.progress,
        computedCurrentValue: inv.status === "active" || inv.status === "suspended" ? principal + totalProfitPaid : Number(inv.currentValue),
        computedEstimatedEarnings: inv.status === "active" || inv.status === "suspended" ? totalProfitPaid : Number(inv.estimatedEarnings),
        projectedEarnings,
        monthlyProfit,
        monthlyRate,
        remainingDays,
        matured,
      };
    });
  }),

  // ── Monthly profit payment history ────────────────────────────
  profits: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(profitPayments)
      .where(eq(profitPayments.investorId, ctx.investor.id))
      .orderBy(desc(profitPayments.paidAt))
      .limit(300);
    const myInvestments = await db
      .select()
      .from(investments)
      .where(eq(investments.investorId, ctx.investor.id));
    const invMap = new Map(myInvestments.map((i) => [i.id, i]));
    return rows.map((p) => ({
      ...p,
      projectName: invMap.get(p.investmentId)?.projectName ?? "Investment",
    }));
  }),

  // ── Investment liquidation (early exit) ───────────────────────
  liquidationEstimate: investorQuery
    .input(z.object({ investmentId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(investments)
        .where(and(eq(investments.id, input.investmentId), eq(investments.investorId, ctx.investor.id)))
        .limit(1);
      const inv = rows.at(0);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investment not found" });
      if (inv.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only active investments can be liquidated" });
      }
      const plans = await db.select().from(investmentPlans).where(eq(investmentPlans.id, inv.planId)).limit(1);
      const plan = plans.at(0);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      const pending = await db
        .select({ id: liquidationRequests.id })
        .from(liquidationRequests)
        .where(and(eq(liquidationRequests.investmentId, inv.id), eq(liquidationRequests.status, "pending")))
        .limit(1);

      return {
        investmentId: inv.id,
        projectName: inv.projectName,
        planName: plan.name,
        startDate: inv.startDate,
        maturityDate: inv.maturityDate,
        alreadyPending: pending.length > 0,
        ...computeLiquidationEstimate(inv, plan),
      };
    }),

  requestLiquidation: investorQuery
    .input(z.object({ investmentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(investments)
          .where(and(eq(investments.id, input.investmentId), eq(investments.investorId, ctx.investor.id)))
          .limit(1);
        const inv = rows.at(0);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investment not found" });
        if (inv.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only active investments can be liquidated" });
        }

        // No duplicate pending requests
        const pending = await tx
          .select({ id: liquidationRequests.id })
          .from(liquidationRequests)
          .where(and(eq(liquidationRequests.investmentId, inv.id), eq(liquidationRequests.status, "pending")))
          .limit(1);
        if (pending.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "A liquidation request for this investment is already pending review" });
        }

        const plans = await tx.select().from(investmentPlans).where(eq(investmentPlans.id, inv.planId)).limit(1);
        const plan = plans.at(0);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

        const est = computeLiquidationEstimate(inv, plan);

        const [req] = await tx
          .insert(liquidationRequests)
          .values({
            investmentId: inv.id,
            investorId: ctx.investor.id,
            principalAmount: est.principal.toFixed(2),
            profitEarned: est.profitEarned.toFixed(2),
            penaltyPercent: est.penaltyPercent,
            penaltyAmount: est.penaltyAmount.toFixed(2),
            accruedProfit: est.accruedProfit.toFixed(2),
            estimatedValue: est.estimatedValue.toFixed(2),
            status: "pending",
          })
          .$returningId();

        // Freeze ROI while the request is under review
        await tx
          .update(investments)
          .set({ profitPaused: "yes" })
          .where(eq(investments.id, inv.id));

        await tx.insert(investorNotifications).values({
          investorId: ctx.investor.id,
          title: "Liquidation Request Submitted",
          message: `Your liquidation request for ${inv.projectName} (estimated payout ${fmtMoney(est.estimatedValue)}) has been submitted for review.`,
          type: "info",
        });
        await notifyAdmin(
          "Liquidation Request Submitted",
          `${ctx.investor.name} requested liquidation of investment #${inv.id} (${inv.projectName}) — estimated payout ${fmtMoney(est.estimatedValue)}.`,
          "investment",
          tx,
        );
        await logInvestorActivity(
          ctx.investor.id,
          "liquidation_requested",
          `Investment #${inv.id} (${inv.projectName}), estimated ${fmtMoney(est.estimatedValue)}`,
          ctx.req.headers,
          tx,
        );

        return { success: true, requestId: req.id, estimatedValue: est.estimatedValue };
      });
    }),

  liquidations: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(liquidationRequests)
      .where(eq(liquidationRequests.investorId, ctx.investor.id))
      .orderBy(desc(liquidationRequests.requestedAt))
      .limit(100);
    const myInvestments = await db
      .select()
      .from(investments)
      .where(eq(investments.investorId, ctx.investor.id));
    const invMap = new Map(myInvestments.map((i) => [i.id, i]));
    return rows.map((r) => ({
      ...r,
      projectName: invMap.get(r.investmentId)?.projectName ?? "Investment",
    }));
  }),

  // ── Start a new investment from wallet balance ────────────────
  invest: investorQuery
    .input(
      z.object({
        planId: z.number(),
        amount: z.number().positive(),
        projectId: z.number().optional(),
        durationDays: z.number().int().min(1).max(365).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const investorId = ctx.investor.id;

      if (ctx.investor.walletFrozen === "yes") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your wallet is currently frozen. Please contact support." });
      }

      assertTierAllows(ctx.investor, "investment", input.amount);

      const planRows = await db
        .select()
        .from(investmentPlans)
        .where(and(eq(investmentPlans.id, input.planId), eq(investmentPlans.isActive, "yes")))
        .limit(1);
      const plan = planRows.at(0);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Investment plan not found" });

      const minAmount = Number(plan.minAmount);
      if (input.amount < minAmount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Minimum investment for the ${plan.name} plan is ${fmtMoney(minAmount)}`,
        });
      }

      let projectName = `${plan.name} Plan Portfolio`;
      let project: (typeof investmentProjects.$inferSelect) | null = null;
      if (input.projectId) {
        const projectRows = await db
          .select()
          .from(investmentProjects)
          .where(eq(investmentProjects.id, input.projectId))
          .limit(1);
        if (projectRows.length) {
          project = projectRows[0];
          projectName = project.name;
        }
      }

      // ── Flexible duration ─────────────────────────────────────
      // Backend enforcement: the selected duration must satisfy the
      // admin's configured rules — API callers can't bypass the limits.
      const durationCfg = durationConfigFor(plan, project);
      let durationDays: number | null = null;
      if (durationCfg.legacy) {
        if (input.durationDays != null && input.durationDays !== durationCfg.minDays) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `The ${plan.name} plan has a fixed duration of ${durationCfg.minDays} days`,
          });
        }
      } else {
        if (input.durationDays == null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Please select an investment duration" });
        }
        const err = validateDurationDays(durationCfg, input.durationDays);
        if (err) throw new TRPCError({ code: "BAD_REQUEST", message: err });
        durationDays = input.durationDays;
      }
      const effectiveDays = durationDays ?? durationCfg.minDays;

      const maturityDate = addDays(new Date(), effectiveDays);

      const reference = generateReference("INV");
      const result = await db.transaction(async (tx) => {
        // Debit the wallet atomically (insufficient funds / frozen → clean error)
        await debitWallet(tx, {
          investorId,
          amount: input.amount,
          type: "investment",
          description: `Invested in ${plan.name} plan — ${projectName}`,
          reference,
          skipLedger: true, // ledger row inserted below with full detail
        });

        const [row] = await tx
          .insert(investments)
          .values({
            investorId,
            planId: plan.id,
            projectId: input.projectId ?? null,
            projectName,
            amount: input.amount.toFixed(2),
            currentValue: input.amount.toFixed(2),
            estimatedEarnings: "0.00",
            roi: "0.00",
            status: "pending", // activates after admin approval
            progress: 0,
            maturityDate,
            durationDays,
          })
          .$returningId();

        await tx.insert(investmentTransactions).values({
          investorId,
          type: "investment",
          direction: "debit",
          amount: input.amount.toFixed(2),
          description: `Invested in ${plan.name} plan — ${projectName}`,
          reference,
          status: "completed",
        });

        await tx.insert(investorNotifications).values({
          investorId,
          title: "Investment Submitted",
          message: `Your ${fmtMoney(input.amount)} investment in the ${plan.name} plan has been submitted and will be activated after review. Estimated maturity: ${maturityDate.toDateString()}.`,
          type: "info",
        });

        await notifyAdmin(
          "New Investment Created",
          `${ctx.investor.name} invested ${fmtMoney(input.amount)} in the ${plan.name} plan (${projectName}). Pending approval.`,
          "investment",
          tx,
        );
        void notifyAdminEmail({
          eyebrow: "Investment Requires Review",
          heading: `New Home Plan — ${fmtMoney(input.amount)}`,
          intro: `${ctx.investor.name} invested ${fmtMoney(input.amount)} in the ${plan.name} plan (${projectName}). It is waiting for approval.`,
          details: [
            { label: "Customer", value: `${ctx.investor.name} · ${ctx.investor.email}` },
            { label: "Amount", value: fmtMoney(input.amount) },
            { label: "Plan", value: `${plan.name} — ${projectName}` },
            { label: "Reference", value: reference },
            { label: "Date / Time", value: fmtDateTime(new Date()) },
            { label: "Status", value: "Pending Approval" },
          ],
          adminLink: "/admin/dashboard?section=investments",
          ctaLabel: "Review Home Plans",
          reqHeaders: ctx.req.headers,
        });
        await logInvestorActivity(
          ctx.investor.id,
          "investment_created",
          `${fmtMoney(input.amount)} into ${plan.name} plan (${projectName})`,
          ctx.req.headers,
          tx,
        );

        return { success: true, investmentId: row.id };
      });
      // CRM: capture the investor as a lead and log the conversion event
      void (async () => {
        await captureLead({
          name: ctx.investor.name,
          email: ctx.investor.email,
          phone: ctx.investor.phone,
          country: ctx.investor.country,
          source: "investment_inquiry",
          investmentInterest: plan.name,
          notify: false,
        });
        await leadEvent({
          email: ctx.investor.email,
          type: "investment_started",
          description: `Investment started: ${fmtMoney(input.amount)} in the ${plan.name} plan (${projectName})`,
          stage: "investment_processing",
          notes: `Reference: ${reference}`,
        });
        await sendSystemMessage(ctx.investor.id, {
          subject: "Investment Created",
          category: "investment_support",
          body: `Your investment of ${fmtMoney(input.amount)} in the ${plan.name} plan (${projectName}) has been created successfully. Reference: ${reference}. Monthly profits are credited to your wallet automatically.`,
          propertyName: projectName,
        });
        await notifyUser(ctx.investor.id, {
          type: "investment_created",
          category: "investments",
          title: "Investment Created",
          message: `Your investment of ${fmtMoney(input.amount)} in the ${plan.name} plan (${projectName}) has been created and will be activated after review.`,
          severity: "success",
          link: "/invest/dashboard?tab=portfolio",
          relatedRef: reference,
          inApp: false,
          emailDetails: [
            { label: "Plan", value: plan.name },
            { label: "Project", value: projectName },
            { label: "Amount Invested", value: fmtMoney(input.amount) },
            { label: "Duration", value: `${effectiveDays} days` },
          ],
        });
        await logAudit(null, ctx.investor.name, "investment_created", `Investment created: ${fmtMoney(input.amount)} in ${plan.name} (${projectName}) by ${ctx.investor.name} (${ctx.investor.email}) — Ref ${reference}`, ctx.req.headers);
      })();
      void generatePdfDocument({
        investorId: ctx.investor.id,
        ownerEmail: ctx.investor.email,
        ownerName: ctx.investor.name,
        category: "investment",
        docType: "Investment Agreement",
        name: `Investment Agreement — ${plan.name} Plan (${reference})`,
        amount: input.amount,
        reference,
        links: { investmentId: result.investmentId },
        lines: [
          { label: "Investment Plan", value: plan.name },
          { label: "Project", value: projectName },
          { label: "Amount Invested", value: fmtMoney(input.amount) },
          { label: "Expected ROI", value: `Up to ${plan.targetReturn}% monthly` },
          { label: "Duration", value: `${effectiveDays} days` },
          { label: "Maturity Date", value: maturityDate.toDateString() },
          { label: "Status", value: "Pending Activation" },
        ],
        note: "This agreement confirms your investment with Nestaro Homes LLC under the terms of the selected plan.",
      });
      void generatePdfDocument({
        investorId: ctx.investor.id,
        ownerEmail: ctx.investor.email,
        ownerName: ctx.investor.name,
        category: "financial",
        docType: "Investment Receipt",
        amount: input.amount,
        reference,
        links: { investmentId: result.investmentId },
        lines: [
          { label: "Transaction Type", value: "Investment (Wallet Debit)" },
          { label: "Investment Plan", value: plan.name },
          { label: "Project", value: projectName },
          { label: "Reference", value: reference },
          { label: "Status", value: "Submitted — Pending Activation" },
        ],
        note: "Your investment amount has been debited from your Nestaro Homes wallet and allocated to the selected plan.",
      });
      return result;
    }),

  // ── Deposits ──────────────────────────────────────────────────
  deposit: investorQuery
    .input(
      z.object({
        amount: z.number().positive(),
        // US market methods only: Bank Transfer, Zelle, Cryptocurrency.
        // Legacy values (paypal/card/opay) are rejected for new deposits —
        // they remain in the DB enum for historical records only.
        method: z.enum(["bank", "zelle", "crypto"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const methodLabel = PAYMENT_METHOD_LABELS[input.method] ?? input.method;
      if (input.amount < DepositRules.minAmount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Minimum deposit is ${fmtMoney(DepositRules.minAmount)}` });
      }
      assertTierAllows(ctx.investor, "deposit", input.amount);
      const reference = generateReference("DEP");
      const [row] = await db
        .insert(deposits)
        .values({
          investorId: ctx.investor.id,
          amount: input.amount.toFixed(2),
          method: input.method,
          reference,
          status: "pending",
        })
        .$returningId();

      await db.insert(investmentTransactions).values({
        investorId: ctx.investor.id,
        type: "deposit",
        direction: "credit",
        amount: input.amount.toFixed(2),
        description: `Deposit via ${methodLabel} (pending approval)`,
        reference,
        status: "pending",
      });

      void notifyUser(ctx.investor.id, {
        type: "deposit_submitted",
        category: "wallet_payments",
        title: "Deposit Submitted",
        message: `Your deposit of ${fmtMoney(input.amount)} via ${methodLabel} has been submitted and is pending approval.`,
        link: "/invest/dashboard?tab=transactions",
        relatedRef: reference,
        emailDetails: [
          { label: "Amount", value: fmtMoney(input.amount) },
          { label: "Payment Method", value: methodLabel },
        ],
      });

      // Staff notification: a deposit is waiting for review.
      void notifyAdminEmail({
        eyebrow: "Deposit Requires Review",
        heading: `Pending Deposit — ${fmtMoney(input.amount)}`,
        intro: `${ctx.investor.name} submitted a deposit of ${fmtMoney(input.amount)} via ${methodLabel}. It is waiting for review.`,
        details: [
          { label: "Customer", value: `${ctx.investor.name} · ${ctx.investor.email}` },
          { label: "Amount", value: fmtMoney(input.amount) },
          { label: "Payment Method", value: methodLabel },
          { label: "Reference", value: reference },
          { label: "Date / Time", value: fmtDateTime(new Date()) },
          { label: "Status", value: "Pending Review" },
        ],
        adminLink: "/admin/dashboard?section=deposits",
        ctaLabel: "Review Deposit",
        reqHeaders: ctx.req.headers,
      });

      return { success: true, depositId: row.id, reference };
    }),

  deposits: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(deposits)
      .where(eq(deposits.investorId, ctx.investor.id))
      .orderBy(desc(deposits.createdAt));
  }),

  // ── Withdrawals ───────────────────────────────────────────────
  withdraw: investorQuery
    .input(
      z.object({
        amount: z.number().positive(),
        // US market methods only: Bank Transfer, Zelle, Cryptocurrency.
        // Legacy values (paypal/opay) are rejected for new withdrawals.
        method: z.enum(["bank", "zelle", "crypto"]),
        destination: z.string().min(4).max(500).optional(),
        // Optional saved withdrawal account — when provided, its details become the
        // authoritative destination snapshot so the admin sees exactly where to pay.
        withdrawalAccountId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (input.amount < 50) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Minimum withdrawal is ${fmtMoney(50)}` });
      }
      if (ctx.investor.walletFrozen === "yes") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your wallet is currently frozen. Please contact support." });
      }
      if (ctx.investor.kycStatus !== "verified" && input.amount > 5000) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account verification is required for withdrawals above $5,000",
        });
      }

      // Referral earnings unlock for withdrawal only after the customer has
      // made their own qualifying deposit. Until then, referral-bonus funds
      // stay in the wallet but cannot be withdrawn.
      const [{ approvedTotal }] = await db
        .select({ approvedTotal: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
        .from(deposits)
        .where(and(eq(deposits.investorId, ctx.investor.id), eq(deposits.status, "approved")));
      const approvedDepositsTotal = Number(approvedTotal);
      if (approvedDepositsTotal < ReferralBonus.qualifyingDeposit) {
        const [{ referralTotal }] = await db
          .select({ referralTotal: sql<string>`COALESCE(SUM(${investmentTransactions.amount}), 0)` })
          .from(investmentTransactions)
          .where(
            and(
              eq(investmentTransactions.investorId, ctx.investor.id),
              eq(investmentTransactions.type, "referral_bonus"),
              eq(investmentTransactions.direction, "credit"),
              eq(investmentTransactions.status, "completed"),
            ),
          );
        const lockedReferral = Number(referralTotal);
        if (lockedReferral > 0) {
          const maxWithdrawable = Math.max(0, Number(ctx.investor.walletBalance) - lockedReferral);
          if (input.amount > maxWithdrawable) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Referral earnings become withdrawable after your first qualifying deposit of ${fmtMoney(ReferralBonus.qualifyingDeposit)} or more. You can currently withdraw up to ${fmtMoney(maxWithdrawable)}.`,
            });
          }
        }
      }

      // Resolve the destination: a saved account owned by this investor takes
      // precedence; otherwise a manually-entered destination is required.
      let destination = input.destination?.trim() ?? "";
      let withdrawalAccountId: number | null = null;
      if (input.withdrawalAccountId != null) {
        const [account] = await db
          .select()
          .from(withdrawalAccounts)
          .where(and(eq(withdrawalAccounts.id, input.withdrawalAccountId), eq(withdrawalAccounts.investorId, ctx.investor.id)))
          .limit(1);
        if (!account) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Selected withdrawal account was not found. Please choose another account." });
        }
        if (account.method !== input.method) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The selected account does not match the chosen withdrawal method." });
        }
        withdrawalAccountId = account.id;
        destination =
          account.method === "bank"
            ? `Bank: ${account.bankName ?? ""} • Acct: ${account.accountNumber ?? ""} • Name: ${account.accountName ?? ""}`
            : account.method === "zelle"
              ? `Zelle: ${account.accountNumber ?? ""} • Name: ${account.accountName ?? ""}`
              : `${account.cryptoNetwork ?? "Crypto"}: ${account.walletAddress ?? ""}`;
      }
      if (!destination || destination.length < 4) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Please select a saved account or enter the destination details for this withdrawal." });
      }

      const methodLabel = PAYMENT_METHOD_LABELS[input.method] ?? input.method;
      const reference = generateReference("WDR");
      const wdResult = await db.transaction(async (tx) => {
        // Hold funds atomically — fails cleanly on insufficient balance or frozen wallet
        await debitWallet(tx, {
          investorId: ctx.investor.id,
          amount: input.amount,
          type: "withdrawal",
          description: `Withdrawal via ${methodLabel} (pending approval)`,
          reference,
          skipLedger: true, // pending ledger row inserted below
        });

        const [row] = await tx
          .insert(withdrawals)
          .values({
            investorId: ctx.investor.id,
            amount: input.amount.toFixed(2),
            method: input.method,
            destination,
            withdrawalAccountId,
            reference,
            status: "pending",
          })
          .$returningId();

        await tx.insert(investmentTransactions).values({
          investorId: ctx.investor.id,
          type: "withdrawal",
          direction: "debit",
          amount: input.amount.toFixed(2),
          description: `Withdrawal via ${methodLabel} (pending approval)`,
          reference,
          status: "pending",
        });

        await notifyAdmin(
          "Withdrawal Request Submitted",
          `${ctx.investor.name} requested a withdrawal of ${fmtMoney(input.amount)} via ${methodLabel}. Destination: ${destination}`,
          "withdrawal",
          tx,
        );
        await logInvestorActivity(
          ctx.investor.id,
          "withdrawal_requested",
          `${fmtMoney(input.amount)} via ${methodLabel} (${reference})`,
          ctx.req.headers,
          tx,
        );

        return { success: true, withdrawalId: row.id, reference };
      });
      void notifyUser(ctx.investor.id, {
        type: "withdrawal_requested",
        category: "wallet_payments",
        title: "Withdrawal Requested",
        message: `Your withdrawal request of ${fmtMoney(input.amount)} via ${methodLabel} has been received and is pending approval. The funds are held from your wallet while it is processed.`,
        link: "/invest/dashboard?tab=transactions",
        relatedRef: reference,
        emailDetails: [
          { label: "Amount", value: fmtMoney(input.amount) },
          { label: "Method", value: methodLabel },
          { label: "Destination", value: destination },
        ],
      });
      // Staff notification: a withdrawal is waiting for review.
      void notifyAdminEmail({
        eyebrow: "Withdrawal Requires Review",
        heading: `Pending Withdrawal — ${fmtMoney(input.amount)}`,
        intro: `${ctx.investor.name} requested a withdrawal of ${fmtMoney(input.amount)} via ${methodLabel}. It is waiting for review.`,
        details: [
          { label: "Customer", value: `${ctx.investor.name} · ${ctx.investor.email}` },
          { label: "Amount", value: fmtMoney(input.amount) },
          { label: "Withdrawal Method", value: methodLabel },
          { label: "Destination", value: destination },
          { label: "Reference", value: reference },
          { label: "Date / Time", value: fmtDateTime(new Date()) },
          { label: "Status", value: "Pending Review" },
        ],
        adminLink: "/admin/dashboard?section=withdrawals",
        ctaLabel: "Review Withdrawal",
        reqHeaders: ctx.req.headers,
      });
      if (input.amount >= LARGE_TRANSACTION_THRESHOLD) {
        void notifyUser(ctx.investor.id, {
          type: "large_transaction",
          category: "wallet_payments",
          title: "Large Transaction Alert",
          message: `A large withdrawal of ${fmtMoney(input.amount)} was requested from your wallet. If you did not authorize this transaction, contact support immediately.`,
          severity: "warning",
          security: true,
          link: "/invest/dashboard?tab=transactions",
          relatedRef: reference,
          emailDetails: [{ label: "Amount", value: fmtMoney(input.amount) }],
        });
      }
      return wdResult;
    }),

  withdrawals: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.investorId, ctx.investor.id))
      .orderBy(desc(withdrawals.createdAt));
  }),

  // ── Saved Withdrawal Accounts ─────────────────────────────────
  withdrawalAccounts: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(withdrawalAccounts)
      .where(eq(withdrawalAccounts.investorId, ctx.investor.id))
      .orderBy(desc(withdrawalAccounts.isDefault), desc(withdrawalAccounts.createdAt));
    return rows;
  }),

  saveWithdrawalAccount: investorQuery
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        method: z.enum(["bank", "zelle", "crypto"]),
        label: z.string().trim().max(100).optional(),
        bankName: z.string().trim().max(150).optional(),
        accountName: z.string().trim().max(150).optional(),
        accountNumber: z.string().trim().max(40).optional(),
        cryptoNetwork: z.string().trim().max(80).optional(),
        walletAddress: z.string().trim().max(255).optional(),
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // Per-method required fields
      if (input.method === "bank") {
        if (!input.bankName || !input.accountName || !input.accountNumber) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Bank name, account name and account number are required for a bank account." });
        }
      } else if (input.method === "zelle") {
        if (!input.accountName || !input.accountNumber) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Account name and Zelle email / phone number are required." });
        }
      } else if (!input.cryptoNetwork || !input.walletAddress) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Network and wallet address are required for a crypto account." });
      }

      const defaultLabel =
        input.method === "bank" ? input.bankName!.trim() : input.method === "zelle" ? "Zelle" : input.cryptoNetwork!.trim();
      const values = {
        method: input.method,
        label: (input.label?.trim() || defaultLabel).slice(0, 100),
        bankName: input.method === "bank" ? input.bankName!.trim() : null,
        accountName: input.method !== "crypto" ? input.accountName!.trim() : null,
        accountNumber: input.method !== "crypto" ? input.accountNumber!.trim() : null,
        cryptoNetwork: input.method === "crypto" ? input.cryptoNetwork!.trim() : null,
        walletAddress: input.method === "crypto" ? input.walletAddress!.trim() : null,
      };

      let accountId: number;
      if (input.id != null) {
        const [existing] = await db
          .select({ id: withdrawalAccounts.id })
          .from(withdrawalAccounts)
          .where(and(eq(withdrawalAccounts.id, input.id), eq(withdrawalAccounts.investorId, ctx.investor.id)))
          .limit(1);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Withdrawal account not found." });
        }
        await db
          .update(withdrawalAccounts)
          .set(values)
          .where(and(eq(withdrawalAccounts.id, input.id), eq(withdrawalAccounts.investorId, ctx.investor.id)));
        accountId = input.id;
      } else {
        const [row] = await db
          .insert(withdrawalAccounts)
          .values({ investorId: ctx.investor.id, ...values })
          .$returningId();
        accountId = row.id;
      }

      // Default handling: explicit default request, or the very first account
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(withdrawalAccounts)
        .where(eq(withdrawalAccounts.investorId, ctx.investor.id));
      if (input.isDefault || count === 1) {
        await db
          .update(withdrawalAccounts)
          .set({ isDefault: "no" })
          .where(eq(withdrawalAccounts.investorId, ctx.investor.id));
        await db
          .update(withdrawalAccounts)
          .set({ isDefault: "yes" })
          .where(and(eq(withdrawalAccounts.id, accountId), eq(withdrawalAccounts.investorId, ctx.investor.id)));
      }

      void logInvestorActivity(
        ctx.investor.id,
        input.id != null ? "withdrawal_account_updated" : "withdrawal_account_added",
        `${PAYMENT_METHOD_LABELS[input.method] ?? input.method} account saved`,
        ctx.req.headers,
      );
      return { success: true, accountId };
    }),

  removeWithdrawalAccount: investorQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db
        .delete(withdrawalAccounts)
        .where(and(eq(withdrawalAccounts.id, input.id), eq(withdrawalAccounts.investorId, ctx.investor.id)));
      void logInvestorActivity(ctx.investor.id, "withdrawal_account_removed", `Withdrawal account #${input.id} removed`, ctx.req.headers);
      return { success: true };
    }),

  setDefaultWithdrawalAccount: investorQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [existing] = await db
        .select({ id: withdrawalAccounts.id })
        .from(withdrawalAccounts)
        .where(and(eq(withdrawalAccounts.id, input.id), eq(withdrawalAccounts.investorId, ctx.investor.id)))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Withdrawal account not found." });
      }
      await db
        .update(withdrawalAccounts)
        .set({ isDefault: "no" })
        .where(eq(withdrawalAccounts.investorId, ctx.investor.id));
      await db
        .update(withdrawalAccounts)
        .set({ isDefault: "yes" })
        .where(and(eq(withdrawalAccounts.id, input.id), eq(withdrawalAccounts.investorId, ctx.investor.id)));
      return { success: true };
    }),

  // ── Deposit payment instructions (admin-configured) ───────────
  paymentInstructions: investorQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(platformSettings)
      .where(
        inArray(platformSettings.key, [
          "deposit_instructions_bank",
          "deposit_instructions_zelle",
          "deposit_instructions_opay",
          "deposit_instructions_crypto",
        ]),
      );
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value ?? "";
    return {
      bank: map["deposit_instructions_bank"] ?? "",
      // Prefer the current Zelle key; fall back to the legacy opay key so
      // instructions configured before the migration still show up.
      zelle: map["deposit_instructions_zelle"] ?? map["deposit_instructions_opay"] ?? "",
      crypto: map["deposit_instructions_crypto"] ?? "",
    };
  }),

  // ── Transactions ──────────────────────────────────────────────
  transactions: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(investmentTransactions)
      .where(eq(investmentTransactions.investorId, ctx.investor.id))
      .orderBy(desc(investmentTransactions.createdAt))
      .limit(200);
  }),

  // ── Wallet Activity (unified financial history) ───────────────
  // One wallet, many transaction types. Groups:
  //   deposits / withdrawals / funding (investment) / earnings (ROI)
  //   liquidations (refund rows with a LIQ- reference or liquidation description)
  //   refunds (all other refund rows) / mortgage / referral / other (adjustments)
  //   property — reserved: property purchases on this platform are paid via bank
  //   transfer proofs, not wallet debits, so this group currently matches nothing.
  walletActivity: investorQuery
    .input(
      z
        .object({
          group: z
            .enum([
              "all",
              "deposits",
              "withdrawals",
              "funding",
              "earnings",
              "liquidations",
              "property",
              "mortgage",
              "referral",
              "refunds",
              "other",
            ])
            .default("all"),
          status: z.enum(["all", "completed", "pending", "failed"]).default("all"),
          search: z.string().trim().max(120).optional(),
          dateFrom: z.string().trim().max(20).optional(),
          dateTo: z.string().trim().max(20).optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(5).max(50).default(15),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const group = input?.group ?? "all";
      const status = input?.status ?? "all";
      const search = input?.search?.trim() || "";
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 15;

      const conds: any[] = [eq(investmentTransactions.investorId, ctx.investor.id)];

      const liqMatch = sql`(${investmentTransactions.reference} LIKE 'LIQ-%' OR ${investmentTransactions.description} LIKE '%liquidation%')`;
      switch (group) {
        case "deposits":
          conds.push(eq(investmentTransactions.type, "deposit"));
          break;
        case "withdrawals":
          conds.push(eq(investmentTransactions.type, "withdrawal"));
          break;
        case "funding":
          conds.push(eq(investmentTransactions.type, "investment"));
          break;
        case "earnings":
          conds.push(eq(investmentTransactions.type, "earning"));
          break;
        case "liquidations":
          conds.push(eq(investmentTransactions.type, "refund"), liqMatch);
          break;
        case "refunds":
          conds.push(
            eq(investmentTransactions.type, "refund"),
            sql`(${investmentTransactions.reference} IS NULL OR ${investmentTransactions.reference} NOT LIKE 'LIQ-%') AND ${investmentTransactions.description} NOT LIKE '%liquidation%'`,
          );
          break;
        case "mortgage":
          conds.push(eq(investmentTransactions.type, "mortgage_payment"));
          break;
        case "referral":
          conds.push(eq(investmentTransactions.type, "referral_bonus"));
          break;
        case "other":
          conds.push(eq(investmentTransactions.type, "adjustment"));
          break;
        case "property":
          // No wallet-based property payments exist; kept for future use.
          conds.push(sql`1 = 0`);
          break;
        case "all":
        default:
          break;
      }

      if (status !== "all") conds.push(eq(investmentTransactions.status, status));
      if (search) {
        const term = `%${search.replace(/[%_]/g, "")}%`;
        conds.push(
          or(
            like(investmentTransactions.description, term),
            like(investmentTransactions.reference, term),
          ),
        );
      }
      if (input?.dateFrom) {
        const from = new Date(input.dateFrom);
        if (!Number.isNaN(from.getTime())) conds.push(gte(investmentTransactions.createdAt, from));
      }
      if (input?.dateTo) {
        const to = new Date(input.dateTo);
        if (!Number.isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          conds.push(lte(investmentTransactions.createdAt, to));
        }
      }

      const where = and(...conds);
      const [{ total }] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(investmentTransactions)
        .where(where);
      const items = await db
        .select()
        .from(investmentTransactions)
        .where(where)
        .orderBy(desc(investmentTransactions.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return { items, total: Number(total ?? 0), page, pageSize };
    }),

  // ── Referrals ─────────────────────────────────────────────────
  referrals: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerId, ctx.investor.id))
      .orderBy(desc(referrals.createdAt));
    // Qualifying-deposit status for referral withdrawal eligibility
    const [{ approvedTotal }] = await db
      .select({ approvedTotal: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
      .from(deposits)
      .where(and(eq(deposits.investorId, ctx.investor.id), eq(deposits.status, "approved")));
    const approvedDepositsTotal = Number(approvedTotal);
    return {
      referralCode: ctx.investor.referralCode,
      referralEarnings: Number(ctx.investor.referralEarnings),
      referrals: rows,
      referralBonusAmount: ReferralBonus.amount,
      qualifyingDepositRequired: ReferralBonus.qualifyingDeposit,
      approvedDepositsTotal,
      referralUnlocked: approvedDepositsTotal >= ReferralBonus.qualifyingDeposit,
    };
  }),

  // ── Notifications ─────────────────────────────────────────────
  notifications: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(investorNotifications)
      .where(
        or(
          eq(investorNotifications.investorId, ctx.investor.id),
          sql`${investorNotifications.investorId} IS NULL`,
        ),
      )
      .orderBy(desc(investorNotifications.createdAt))
      .limit(100);
  }),

  markNotificationRead: investorQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
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

  markAllNotificationsRead: investorQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .update(investorNotifications)
      .set({ isRead: "yes" })
      .where(eq(investorNotifications.investorId, ctx.investor.id));
    return { success: true };
  }),

  // ── My Property Purchases (outright orders placed with the account email) ──
  myPurchases: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const cust = await db.select().from(customers).where(eq(customers.email, ctx.investor.email));
    if (!cust.length) return [];
    const ordersList = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, cust[0].id))
      .orderBy(desc(orders.createdAt))
      .limit(100);
    if (!ordersList.length) return [];
    const ids = ordersList.map((o) => o.id);
    const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, ids));
    const docs = await db.select().from(orderDocuments).where(inArray(orderDocuments.orderId, ids));
    const history = await db
      .select()
      .from(trackingHistory)
      .where(inArray(trackingHistory.orderId, ids))
      .orderBy(trackingHistory.createdAt);
    return ordersList.map((o) => ({
      ...o,
      items: items.filter((i) => i.orderId === o.id),
      documents: docs.filter((d) => d.orderId === o.id),
      history: history.filter((h) => h.orderId === o.id),
    }));
  }),

  // ── Statement data (for download) ─────────────────────────────
  statement: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const investorId = ctx.investor.id;
    const txs = await db
      .select()
      .from(investmentTransactions)
      .where(eq(investmentTransactions.investorId, investorId))
      .orderBy(desc(investmentTransactions.createdAt))
      .limit(500);
    const myInvestments = await db
      .select()
      .from(investments)
      .where(eq(investments.investorId, investorId))
      .orderBy(desc(investments.createdAt));
    return {
      investor: sanitizeInvestor(ctx.investor),
      generatedAt: new Date(),
      transactions: txs,
      investments: myInvestments,
    };
  }),

  // ── Account deletion ──────────────────────────────────────────
  deletionEligibility: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const myInvestments = await db.select().from(investments).where(eq(investments.investorId, ctx.investor.id));
    const myWithdrawals = await db.select().from(withdrawals).where(eq(withdrawals.investorId, ctx.investor.id));
    const myDeposits = await db.select().from(deposits).where(eq(deposits.investorId, ctx.investor.id));
    const myLiquidations = await db.select().from(liquidationRequests).where(eq(liquidationRequests.investorId, ctx.investor.id));

    const checks = {
      activeInvestments: myInvestments.filter((i) => i.status === "active" || i.status === "suspended").length,
      pendingInvestments: myInvestments.filter((i) => i.status === "pending").length,
      pendingWithdrawals: myWithdrawals.filter((w) => w.status === "pending").length,
      pendingDeposits: myDeposits.filter((d) => d.status === "pending").length,
      pendingLiquidations: myLiquidations.filter((l) => l.status === "pending").length,
      walletBalance: Number(ctx.investor.walletBalance),
    };
    const eligible =
      checks.activeInvestments === 0 &&
      checks.pendingInvestments === 0 &&
      checks.pendingWithdrawals === 0 &&
      checks.pendingDeposits === 0 &&
      checks.pendingLiquidations === 0 &&
      checks.walletBalance <= 0;
    return { eligible, checks };
  }),

  deleteAccount: investorQuery
    .input(
      z.object({
        reason: z.string().min(3).max(150),
        comment: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const investor = ctx.investor;
      const originalEmail = investor.email;
      const originalName = investor.name;

      await db.transaction(async (tx) => {
        // Re-verify every condition inside the transaction
        const myInvestments = await tx.select().from(investments).where(eq(investments.investorId, investor.id));
        const blocking = myInvestments.filter((i) => ["active", "suspended", "pending"].includes(i.status));
        if (blocking.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You still have active or pending investments. Liquidate them first." });
        }
        const myWithdrawals = await tx.select().from(withdrawals).where(eq(withdrawals.investorId, investor.id));
        if (myWithdrawals.some((w) => w.status === "pending")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You have a pending withdrawal request." });
        }
        const myDeposits = await tx.select().from(deposits).where(eq(deposits.investorId, investor.id));
        if (myDeposits.some((d) => d.status === "pending")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You have a pending deposit request." });
        }
        const myLiquidations = await tx.select().from(liquidationRequests).where(eq(liquidationRequests.investorId, investor.id));
        if (myLiquidations.some((l) => l.status === "pending")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You have a pending liquidation request." });
        }
        if (Number(investor.walletBalance) > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Please withdraw your remaining wallet balance first." });
        }

        // Store feedback for the Primary Admin
        await tx.insert(accountDeletionFeedback).values({
          investorId: investor.id,
          name: originalName,
          email: originalEmail,
          reason: input.reason,
          comment: input.comment?.trim() || null,
        });

        // Anonymize the account — financial records are retained for accounting
        await tx
          .update(investorTableForUpdate)
          .set({
            name: `Deleted Investor #${investor.id}`,
            email: `deleted+${investor.id}@deleted.flexhavens.invalid`,
            passwordHash: "!deleted",
            phone: null,
            country: null,
            kycFullName: null,
            kycDocumentType: null,
            kycIdNumber: null,
            referralCode: `DEL${investor.id}`,
            status: "deleted",
            walletFrozen: "yes",
          })
          .where(eq(investorTableForUpdate.id, investor.id));

        // Revoke tokens and remove personal activity data
        await tx.delete(investorTokens).where(eq(investorTokens.investorId, investor.id));
        await tx.delete(investorNotifications).where(eq(investorNotifications.investorId, investor.id));
        await tx.delete(investorActivityLogs).where(eq(investorActivityLogs.investorId, investor.id));
      });

      clearInvestorCookie(ctx.resHeaders, ctx.req.headers);
      await logAudit(null, originalName, "investor_account_deleted", `Investor #${investor.id} (${originalEmail}) permanently deleted their account. Reason: ${input.reason}`, ctx.req.headers);
      await notifyAdmin(
        "Investor Account Deleted",
        `${originalName} (${originalEmail}) permanently deleted their account. Reason: ${input.reason}. Their feedback is available under Deletion Feedback.`,
        "system",
      );
      await sendAccountDeletedEmail({ to: originalEmail, name: originalName, reqHeaders: ctx.req.headers });
      return { success: true };
    }),
});