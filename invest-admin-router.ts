import { z } from "zod";
import { fmtMoney, fmtDateTime } from "./lib/format";
import { PAYMENT_METHOD_LABELS } from "@contracts/constants";
import { generatePdfDocument } from "./lib/documents";
import { sendSystemMessage } from "./lib/messaging";
import { notifyUser, notifyAdminEmail } from "./lib/notify";
import { LARGE_TRANSACTION_THRESHOLD } from "@contracts/notifications";
import { TRPCError } from "@trpc/server";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { createRouter, investAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  investors,
  investmentPlans,
  investmentProjects,
  investments,
  deposits,
  withdrawals,
  investmentTransactions,
  referrals,
  investorNotifications,
  profitPayments,
  investorActivityLogs,
  adminNotifications,
  auditLogs,
  liquidationRequests,
  platformSettings,
  orders,
  customers,
  mortgages,
  kycRequests,
  appointments,
  testimonials,
} from "@db/schema";
import { ReferralBonus } from "@contracts/constants";
import { sanitizeInvestor } from "./investor-auth-router";
import { runMonthlySettlement, monthlyProfitFor, addMonths, addDays, effectiveDurationDays, payoutCountFor } from "./lib/roi";
import { logAudit, notifyAdmin } from "./lib/activity";
import { creditWallet, debitWallet, bumpCounter, requireAffected } from "./lib/wallet";

// Document-generation payloads captured inside transactions, read after commit.
type DepositDocInfo = { investorId: number; name: string; email: string; amount: number; reference: string; method: string; depositId: number };
type WithdrawalDocInfo = { investorId: number; amount: number; reference: string; method: string; withdrawalId: number; paid: boolean };
type LiquidationDocInfo = { investorId: number; investmentId: number; projectName: string; amountInvested: number; payout: number; requestId: number };

async function notify(investorId: number | null, title: string, message: string, type: "info" | "success" | "warning" | "error" = "info") {
  const db = getDb();
  await db.insert(investorNotifications).values({ investorId, title, message, type });
}

export const investAdminRouter = createRouter({
  // ── Analytics / Reports ───────────────────────────────────────
  stats: investAdminQuery.query(async () => {
    const db = getDb();
    const allInvestors = await db.select().from(investors);
    const allInvestments = await db.select().from(investments);
    const allDeposits = await db.select().from(deposits);
    const allWithdrawals = await db.select().from(withdrawals);
    const allReferrals = await db.select().from(referrals);
    const allPlans = await db.select().from(investmentPlans);
    const allProjects = await db.select().from(investmentProjects);

    const allProfits = await db.select().from(profitPayments);
    const paidProfits = allProfits.filter((p) => p.status === "paid");
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const bucket = (date: Date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${d.getMonth()}`;
    };

    const approvedDeposits = allDeposits.filter((d) => d.status === "approved");
    const pendingDeposits = allDeposits.filter((d) => d.status === "pending");
    const pendingWithdrawals = allWithdrawals.filter((w) => w.status === "pending");
    const paidWithdrawals = allWithdrawals.filter((w) => w.status === "paid" || w.status === "approved");
    const activeInvestments = allInvestments.filter((i) => i.status === "active");
    const totalWalletBalances = allInvestors.reduce((s, i) => s + Number(i.walletBalance), 0);

    return {
      totalInvestors: allInvestors.length,
      activeInvestors: allInvestors.filter((i) => i.status === "active").length,
      suspendedInvestors: allInvestors.filter((i) => i.status === "suspended").length,
      pendingKyc: allInvestors.filter((i) => i.kycStatus === "pending").length,
      totalInvested: allInvestments.reduce((s, i) => s + Number(i.amount), 0),
      activeInvestmentsCount: activeInvestments.length,
      totalDeposited: approvedDeposits.reduce((s, d) => s + Number(d.amount), 0),
      pendingDepositsCount: pendingDeposits.length,
      pendingDepositsAmount: pendingDeposits.reduce((s, d) => s + Number(d.amount), 0),
      totalWithdrawn: paidWithdrawals.reduce((s, w) => s + Number(w.amount), 0),
      pendingWithdrawalsCount: pendingWithdrawals.length,
      pendingWithdrawalsAmount: pendingWithdrawals.reduce((s, w) => s + Number(w.amount), 0),
      totalReferralBonuses: allReferrals.reduce((s, r) => s + Number(r.bonusAmount), 0),
      totalReferrals: allReferrals.length,
      totalPlans: allPlans.length,
      totalProjects: allProjects.length,
      totalEarningsCredited: allInvestors.reduce((s, i) => s + Number(i.totalEarnings), 0),
      // Monthly ROI / profit stats
      totalRoiPaid: paidProfits.reduce((s, p) => s + Number(p.amount), 0),
      monthlyProfitPaid: paidProfits
        .filter((p) => bucket(p.paidAt) === thisMonthKey)
        .reduce((s, p) => s + Number(p.amount), 0),
      totalProfitPayments: paidProfits.length,
      completedWithdrawalsCount: paidWithdrawals.length,
      pendingInvestmentsCount: allInvestments.filter((i) => i.status === "pending").length,
      completedInvestmentsCount: allInvestments.filter((i) => i.status === "matured").length,
      suspendedInvestmentsCount: allInvestments.filter((i) => i.status === "suspended").length,
      totalWalletBalances,
      platformEarnings:
        approvedDeposits.reduce((s, d) => s + Number(d.amount), 0) -
        paidWithdrawals.reduce((s, w) => s + Number(w.amount), 0) -
        totalWalletBalances,
    };
  }),

  // Chart data: deposits/withdrawals/investments per month (last 6 months)
  analytics: investAdminQuery.query(async () => {
    const db = getDb();
    const allDeposits = await db.select().from(deposits);
    const allWithdrawals = await db.select().from(withdrawals);
    const allInvestments = await db.select().from(investments);
    const allInvestors = await db.select().from(investors);

    const months: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString("en-US", { month: "short" }),
      });
    }

    const bucket = (date: Date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${d.getMonth()}`;
    };

    return months.map((m) => ({
      month: m.label,
      deposits: allDeposits
        .filter((d) => d.status === "approved" && bucket(d.createdAt) === m.key)
        .reduce((s, d) => s + Number(d.amount), 0),
      withdrawals: allWithdrawals
        .filter((w) => w.status === "paid" && bucket(w.createdAt) === m.key)
        .reduce((s, w) => s + Number(w.amount), 0),
      investments: allInvestments
        .filter((i) => bucket(i.createdAt) === m.key)
        .reduce((s, i) => s + Number(i.amount), 0),
      newInvestors: allInvestors.filter((i) => bucket(i.createdAt) === m.key).length,
    }));
  }),

  // ── Investor management ───────────────────────────────────────
  investors: investAdminQuery
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(investors).orderBy(desc(investors.createdAt)).limit(500);
      const search = input?.search?.toLowerCase();
      return rows
        .filter((i) =>
          search ? i.name.toLowerCase().includes(search) || i.email.toLowerCase().includes(search) : true,
        )
        .map(sanitizeInvestor);
    }),

  setInvestorStatus: investAdminQuery
    .input(z.object({ investorId: z.number(), status: z.enum(["active", "suspended"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(investors).set({ status: input.status }).where(eq(investors.id, input.investorId));
      await notify(
        input.investorId,
        input.status === "active" ? "Account Reactivated" : "Account Suspended",
        input.status === "active"
          ? "Your investor account has been reactivated."
          : "Your investor account has been suspended. Please contact support for details.",
        input.status === "active" ? "success" : "warning",
      );
      void notifyUser(input.investorId, {
        type: input.status === "active" ? "account_reactivated" : "account_suspended",
        category: "account_security",
        title: input.status === "active" ? "Account Reactivated" : "Account Suspended",
        message:
          input.status === "active"
            ? "Your investor account has been reactivated. Full access has been restored."
            : "Your investor account has been suspended. Please contact support for details.",
        severity: input.status === "active" ? "success" : "error",
        security: true,
        link: "/invest/dashboard",
        inApp: false,
      });
      return { success: true };
    }),

  setKycStatus: investAdminQuery
    .input(z.object({ investorId: z.number(), status: z.enum(["verified", "rejected"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(investors).set({ kycStatus: input.status }).where(eq(investors.id, input.investorId));
      await notify(
        input.investorId,
        input.status === "verified" ? "Identity Verified" : "Verification Rejected",
        input.status === "verified"
          ? "Your identity verification has been approved. Higher withdrawal limits are now unlocked."
          : "Your identity verification was rejected. Please review your details and submit again.",
        input.status === "verified" ? "success" : "error",
      );
      return { success: true };
    }),

  // ── Plan management ───────────────────────────────────────────
  plans: investAdminQuery.query(async () => {
    const db = getDb();
    return db.select().from(investmentPlans).orderBy(investmentPlans.sortOrder);
  }),

  upsertPlan: investAdminQuery
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(2).max(100),
        minAmount: z.number().positive(),
        targetReturn: z.number().min(1).max(1000),
        durationMonths: z.number().min(1).max(120),
        featured: z.enum(["yes", "no"]),
        description: z.string().optional(),
        features: z.array(z.string()).default([]),
        isActive: z.enum(["yes", "no"]),
        sortOrder: z.number().default(0),
        // Flexible duration rules — all omitted/null = legacy fixed duration
        minDurationDays: z.number().int().min(1).max(365).nullish(),
        maxDurationDays: z.number().int().min(1).max(365).nullish(),
        allowedDurationDays: z.array(z.number().int().min(1).max(365)).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const allowed = (input.allowedDurationDays ?? []).filter((d) => d >= 1 && d <= 365);
      if (input.minDurationDays != null && input.maxDurationDays != null && input.minDurationDays > input.maxDurationDays) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Minimum duration cannot be greater than the maximum duration." });
      }
      const values = {
        name: input.name,
        slug,
        minAmount: input.minAmount.toFixed(2),
        targetReturn: input.targetReturn,
        durationMonths: input.durationMonths,
        featured: input.featured,
        minDurationDays: input.minDurationDays ?? null,
        maxDurationDays: input.maxDurationDays ?? null,
        allowedDurationDays: allowed.length > 0 ? JSON.stringify([...new Set(allowed)].sort((a, b) => a - b)) : null,
        description: input.description || null,
        features: JSON.stringify(input.features),
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      };
      if (input.id) {
        await db.update(investmentPlans).set(values).where(eq(investmentPlans.id, input.id));
      } else {
        await db.insert(investmentPlans).values(values);
      }
      return { success: true };
    }),

  deletePlan: investAdminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const used = await db
        .select({ count: sql<number>`count(*)` })
        .from(investments)
        .where(eq(investments.planId, input.id));
      if (Number(used[0]?.count ?? 0) > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This plan has active investments and cannot be deleted. Deactivate it instead.",
        });
      }
      await db.delete(investmentPlans).where(eq(investmentPlans.id, input.id));
      return { success: true };
    }),

  // ── Project management ────────────────────────────────────────
  projects: investAdminQuery.query(async () => {
    const db = getDb();
    return db.select().from(investmentProjects).orderBy(desc(investmentProjects.createdAt));
  }),

  upsertProject: investAdminQuery
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(2).max(255),
        location: z.string().min(2).max(255),
        category: z.string().min(2).max(100),
        description: z.string().optional(),
        image: z.string().max(500).optional(),
        targetAmount: z.number().positive(),
        expectedReturn: z.number().min(1).max(1000),
        durationMonths: z.number().min(1).max(120),
        status: z.enum(["open", "funding", "funded", "completed"]),
        // Project-level flexible duration override (takes precedence over the plan)
        minDurationDays: z.number().int().min(1).max(365).nullish(),
        maxDurationDays: z.number().int().min(1).max(365).nullish(),
        allowedDurationDays: z.array(z.number().int().min(1).max(365)).nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const allowed = (input.allowedDurationDays ?? []).filter((d) => d >= 1 && d <= 365);
      if (input.minDurationDays != null && input.maxDurationDays != null && input.minDurationDays > input.maxDurationDays) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Minimum duration cannot be greater than the maximum duration." });
      }
      const values = {
        name: input.name,
        location: input.location,
        category: input.category,
        description: input.description || null,
        image: input.image || null,
        targetAmount: input.targetAmount.toFixed(2),
        expectedReturn: input.expectedReturn,
        durationMonths: input.durationMonths,
        status: input.status,
        minDurationDays: input.minDurationDays ?? null,
        maxDurationDays: input.maxDurationDays ?? null,
        allowedDurationDays: allowed.length > 0 ? JSON.stringify([...new Set(allowed)].sort((a, b) => a - b)) : null,
      };
      if (input.id) {
        await db.update(investmentProjects).set(values).where(eq(investmentProjects.id, input.id));
      } else {
        await db.insert(investmentProjects).values(values);
      }
      return { success: true };
    }),

  deleteProject: investAdminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(investmentProjects).where(eq(investmentProjects.id, input.id));
      return { success: true };
    }),

  // ── Deposit payment instructions (shown to investors per method) ──
  paymentInstructions: investAdminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(platformSettings);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value ?? "";
    return {
      bank: map["deposit_instructions_bank"] ?? "",
      // Fall back to the legacy opay key for previously saved instructions.
      zelle: map["deposit_instructions_zelle"] ?? map["deposit_instructions_opay"] ?? "",
      crypto: map["deposit_instructions_crypto"] ?? "",
    };
  }),

  updatePaymentInstructions: investAdminQuery
    .input(
      z.object({
        bank: z.string().max(4000),
        zelle: z.string().max(4000),
        crypto: z.string().max(4000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const entries: Array<[string, string]> = [
        ["deposit_instructions_bank", input.bank],
        ["deposit_instructions_zelle", input.zelle],
        ["deposit_instructions_crypto", input.crypto],
      ];
      for (const [key, value] of entries) {
        await db
          .insert(platformSettings)
          .values({ key, value })
          .onDuplicateKeyUpdate({ set: { value } });
      }
      await logAudit(null, ctx.investor.name, "payment_instructions_updated", "Deposit payment instructions updated (bank / Zelle / crypto)", ctx.req.headers);
      return { success: true };
    }),

  // ── Deposit management ────────────────────────────────────────
  deposits: investAdminQuery
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(deposits).orderBy(desc(deposits.createdAt)).limit(500);
      const allInvestors = await db.select().from(investors);
      const investorMap = new Map(allInvestors.map((i) => [i.id, i]));
      return rows
        .filter((d) => (input?.status && input.status !== "all" ? d.status === input.status : true))
        .map((d) => ({
          ...d,
          investorName: investorMap.get(d.investorId)?.name ?? "Unknown",
          investorEmail: investorMap.get(d.investorId)?.email ?? "",
          investorAvatar: investorMap.get(d.investorId)?.avatar ?? null,
        }));
    }),

  reviewDeposit: investAdminQuery
    .input(
      z.object({
        depositId: z.number(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      let depositDoc: DepositDocInfo | null = null;
      let referralBonusInfo: { referrerId: number; bonus: number; referredName: string } | null = null;
      const result = await db.transaction(async (tx) => {
        const rows = await tx.select().from(deposits).where(eq(deposits.id, input.depositId)).limit(1);
        const deposit = rows.at(0);
        if (!deposit) throw new TRPCError({ code: "NOT_FOUND", message: "Deposit not found" });

        // Atomic guard: only ONE request can flip pending → decision.
        // A second approval finds 0 matching rows and aborts — no double credit.
        const claim = await tx
          .update(deposits)
          .set({ status: input.decision, adminNote: input.note || null, processedAt: new Date() })
          .where(and(eq(deposits.id, deposit.id), eq(deposits.status, "pending")));
        requireAffected(claim, "This deposit has already been processed");

        const amount = Number(deposit.amount);
        const reference = deposit.reference ?? `DEP-${deposit.id}`;

        if (input.decision === "approved") {
          const investorRows = await tx.select().from(investors).where(eq(investors.id, deposit.investorId)).limit(1);
          const investor = investorRows.at(0);
          if (!investor) throw new TRPCError({ code: "NOT_FOUND", message: "Investor not found" });
          depositDoc = { investorId: investor.id, name: investor.name, email: investor.email, amount, reference, method: deposit.method, depositId: deposit.id };

          // Mark the existing pending ledger row as credited (no duplicate row)
          await tx
            .update(investmentTransactions)
            .set({
              status: "completed",
              description: `Deposit via ${deposit.method} (approved & credited)`,
            })
            .where(eq(investmentTransactions.reference, reference));

          // Credit the wallet atomically (+ Total Deposits counter + notification)
          await creditWallet(tx, {
            investorId: investor.id,
            amount,
            type: "deposit",
            description: `Deposit via ${deposit.method} (approved & credited)`,
            reference,
            counters: { totalDeposited: true },
            skipLedger: true, // ledger row updated above
            notification: {
              title: "Deposit Approved",
              message: `Your deposit of ${fmtMoney(amount)} has been approved and added to your wallet.`,
              kind: "success",
            },
          });

          // Referral bonus on first approved deposit
          const priorApproved = await tx
            .select({ count: sql<number>`count(*)` })
            .from(deposits)
            .where(and(eq(deposits.investorId, investor.id), eq(deposits.status, "approved")));
          const isFirstApproved = Number(priorApproved[0]?.count ?? 0) === 1;
          if (isFirstApproved && investor.referredById) {
            // Flat $50 per qualifying referral (referred customer's first approved deposit)
            const bonus = ReferralBonus.amount;
            const referrerRows = await tx
              .select()
              .from(investors)
              .where(eq(investors.id, investor.referredById))
              .limit(1);
            const referrer = referrerRows.at(0);
            if (referrer) {
              await creditWallet(tx, {
                investorId: referrer.id,
                amount: bonus,
                type: "referral_bonus",
                description: `Referral bonus — ${investor.name}'s first deposit`,
                reference: `REF-${deposit.id}`,
                counters: { referralEarnings: true },
                notification: {
                  title: "Referral Bonus Credited",
                  message: `You earned a ${fmtMoney(bonus)} referral bonus from ${investor.name}'s first deposit.`,
                  kind: "success",
                },
              });
              await tx
                .update(referrals)
                .set({ bonusAmount: bonus.toFixed(2), status: "credited" })
                .where(and(eq(referrals.referrerId, referrer.id), eq(referrals.referredId, investor.id)));
              referralBonusInfo = { referrerId: referrer.id, bonus, referredName: investor.name };
            }
          }
        } else {
          // Rejected: no balance changes — just close out the ledger row + notify
          const investorRows = await tx.select().from(investors).where(eq(investors.id, deposit.investorId)).limit(1);
          const rejectedInvestor = investorRows.at(0);
          depositDoc = { investorId: deposit.investorId, name: rejectedInvestor?.name ?? "", email: rejectedInvestor?.email ?? "", amount, reference, method: deposit.method, depositId: deposit.id };
          await tx
            .update(investmentTransactions)
            .set({
              status: "failed",
              description: `Deposit via ${deposit.method} (rejected)`,
            })
            .where(eq(investmentTransactions.reference, reference));
          await tx.insert(investorNotifications).values({
            investorId: deposit.investorId,
            title: "Deposit Rejected",
            message: `Your deposit of ${fmtMoney(amount)} was rejected.${input.note ? ` Reason: ${input.note}` : ""}`,
            type: "error",
          });
        }

        await logAudit(
          ctx.investor.id,
          ctx.investor.name,
          `deposit_${input.decision}`,
          `Deposit #${deposit.id} ${fmtMoney(amount)} ${input.decision}${input.note ? ` — ${input.note}` : ""}`,
          ctx.req.headers,
          tx,
        );

        return { success: true };
      });
      const depDoc = depositDoc as DepositDocInfo | null;
      if (depDoc) {
        void notifyAdminEmail({
          eyebrow: input.decision === "approved" ? "Deposit Approved" : "Deposit Rejected",
          heading: `Deposit ${input.decision === "approved" ? "Approved" : "Rejected"} — ${fmtMoney(depDoc.amount)}`,
          intro: `The deposit ${depDoc.reference} from ${depDoc.name || "a customer"} has been ${input.decision}.${input.note ? ` Note: ${input.note}` : ""}`,
          details: [
            { label: "Customer", value: depDoc.email ? `${depDoc.name} · ${depDoc.email}` : depDoc.name },
            { label: "Amount", value: fmtMoney(depDoc.amount) },
            { label: "Payment Method", value: PAYMENT_METHOD_LABELS[depDoc.method] ?? depDoc.method },
            { label: "Reference", value: depDoc.reference },
            { label: "Date / Time", value: fmtDateTime(new Date()) },
            { label: "Status", value: input.decision === "approved" ? "Approved" : "Rejected" },
          ],
          adminLink: "/admin/dashboard?section=deposits",
          ctaLabel: "View Deposits",
          reqHeaders: ctx.req.headers,
        });
        void sendSystemMessage(depDoc.investorId, {
          subject: input.decision === "approved" ? "Deposit Approved" : "Deposit Rejected",
          category: "payment_support",
          body:
            input.decision === "approved"
              ? `Your deposit of ${fmtMoney(depDoc.amount)} via ${depDoc.method.toUpperCase()} has been approved and credited to your wallet. Reference: ${depDoc.reference}.`
              : `Your deposit of ${fmtMoney(depDoc.amount)} was rejected.${input.note ? ` Reason: ${input.note}.` : ""} Reference: ${depDoc.reference}. Please contact support if you need assistance.`,
          notify: false,
        });
        const approved = input.decision === "approved";
        void notifyUser(depDoc.investorId, {
          type: approved ? "deposit_approved" : "deposit_rejected",
          category: "wallet_payments",
          title: approved ? "Deposit Approved" : "Deposit Rejected",
          message: approved
            ? `Your deposit of ${fmtMoney(depDoc.amount)} has been approved and credited to your wallet.`
            : `Your deposit of ${fmtMoney(depDoc.amount)} was rejected.${input.note ? ` Reason: ${input.note}.` : ""}`,
          severity: approved ? "success" : "error",
          link: "/invest/dashboard?tab=transactions",
          relatedRef: depDoc.reference,
          inApp: false,
          emailDetails: [
            { label: "Amount", value: fmtMoney(depDoc.amount) },
            { label: "Payment Method", value: depDoc.method.toUpperCase() },
          ],
        });
        if (approved && depDoc.amount >= LARGE_TRANSACTION_THRESHOLD) {
          void notifyUser(depDoc.investorId, {
            type: "large_transaction",
            category: "wallet_payments",
            title: "Large Transaction Alert",
            message: `A large deposit of ${fmtMoney(depDoc.amount)} was credited to your wallet. If you did not authorize this transaction, contact support immediately.`,
            severity: "warning",
            security: true,
            link: "/invest/dashboard?tab=transactions",
            relatedRef: depDoc.reference,
            inApp: true,
            emailDetails: [{ label: "Amount", value: fmtMoney(depDoc.amount) }],
          });
        }
      }
      const bonusInfo = referralBonusInfo as { referrerId: number; bonus: number; referredName: string } | null;
      if (bonusInfo) {
        void notifyUser(bonusInfo.referrerId, {
          type: "referral_bonus_earned",
          category: "referrals",
          title: "Referral Bonus Credited",
          message: `You earned a ${fmtMoney(bonusInfo.bonus)} referral bonus from ${bonusInfo.referredName}'s first approved deposit. It has been credited to your wallet.`,
          severity: "success",
          link: "/invest/dashboard?tab=referrals",
          inApp: false,
          emailDetails: [
            { label: "Bonus Amount", value: fmtMoney(bonusInfo.bonus) },
            { label: "Referred User", value: bonusInfo.referredName },
          ],
        });
      }
      if (input.decision === "approved" && depDoc) {
        void generatePdfDocument({
          investorId: depDoc.investorId,
          ownerEmail: depDoc.email,
          ownerName: depDoc.name,
          category: "financial",
          docType: "Deposit Receipt",
          amount: depDoc.amount,
          reference: depDoc.reference,
          links: { depositId: depDoc.depositId },
          lines: [
            { label: "Transaction Type", value: "Wallet Deposit" },
            { label: "Payment Method", value: depDoc.method.toUpperCase() },
            { label: "Reference", value: depDoc.reference },
            { label: "Status", value: "Approved & Credited" },
          ],
          note: "Your deposit has been approved and the funds credited to your Nestaro Homes wallet.",
        });
      }
      return result;
    }),

  // ── Withdrawal management ─────────────────────────────────────
  withdrawals: investAdminQuery
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt)).limit(500);
      const allInvestors = await db.select().from(investors);
      const investorMap = new Map(allInvestors.map((i) => [i.id, i]));
      return rows
        .filter((w) => (input?.status && input.status !== "all" ? w.status === input.status : true))
        .map((w) => ({
          ...w,
          investorName: investorMap.get(w.investorId)?.name ?? "Unknown",
          investorEmail: investorMap.get(w.investorId)?.email ?? "",
          investorAvatar: investorMap.get(w.investorId)?.avatar ?? null,
        }));
    }),

  reviewWithdrawal: investAdminQuery
    .input(
      z.object({
        withdrawalId: z.number(),
        decision: z.enum(["approved", "paid", "rejected"]),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      let withdrawalDoc: WithdrawalDocInfo | null = null;
      let wdInvestor: { id: number; amount: number; reference: string; method: string; destination: string; name: string; email: string } | null = null;
      const result = await db.transaction(async (tx) => {
        const rows = await tx.select().from(withdrawals).where(eq(withdrawals.id, input.withdrawalId)).limit(1);
        const withdrawal = rows.at(0);
        if (!withdrawal) throw new TRPCError({ code: "NOT_FOUND", message: "Withdrawal not found" });

        // Atomic guard: a finalized withdrawal can never transition again
        const claim = await tx
          .update(withdrawals)
          .set({ status: input.decision, adminNote: input.note || null, processedAt: new Date() })
          .where(
            and(
              eq(withdrawals.id, withdrawal.id),
              sql`(${withdrawals.status} = 'pending' OR (${withdrawals.status} = 'approved' AND ${input.decision} = 'paid'))`,
            ),
          );
        requireAffected(claim, "This withdrawal has already been finalized");

        const amount = Number(withdrawal.amount);
        const reference = withdrawal.reference ?? `WDR-${withdrawal.id}`;
        {
          const invRows = await tx.select().from(investors).where(eq(investors.id, withdrawal.investorId)).limit(1);
          const inv = invRows.at(0);
          wdInvestor = { id: withdrawal.investorId, amount, reference, method: withdrawal.method, destination: withdrawal.destination, name: inv?.name ?? "Customer", email: inv?.email ?? "" };
        }

        if (input.decision === "rejected") {
          // Refund the funds that were held at request time
          await tx
            .update(investmentTransactions)
            .set({ status: "failed", description: `Withdrawal via ${withdrawal.method} (rejected, refunded)` })
            .where(eq(investmentTransactions.reference, reference));
          await creditWallet(tx, {
            investorId: withdrawal.investorId,
            amount,
            type: "refund",
            description: `Withdrawal rejected — funds returned (${reference})`,
            reference: `WDR-RF-${withdrawal.id}`,
            notification: {
              title: "Withdrawal Rejected",
              message: `Your withdrawal of ${fmtMoney(amount)} was rejected and the funds were returned to your wallet.${input.note ? ` Reason: ${input.note}` : ""}`,
              kind: "error",
            },
          });
        } else {
          await tx
            .update(investmentTransactions)
            .set({
              status: "completed",
              description: `Withdrawal via ${withdrawal.method} (${input.decision})`,
            })
            .where(eq(investmentTransactions.reference, reference));

          // Count the withdrawal exactly once — on its first successful
          // finalization (pending → approved/paid). The approved → paid
          // follow-up transition must not double-count.
          if (withdrawal.status === "pending") {
            await bumpCounter(tx, withdrawal.investorId, "totalWithdrawn", amount);
            await tx
              .update(investors)
              .set({ withdrawalCount: sql`withdrawalCount + 1` })
              .where(eq(investors.id, withdrawal.investorId));
            withdrawalDoc = { investorId: withdrawal.investorId, amount, reference, method: withdrawal.method, withdrawalId: withdrawal.id, paid: input.decision === "paid" };
          }

          await tx.insert(investorNotifications).values({
            investorId: withdrawal.investorId,
            title: input.decision === "paid" ? "Withdrawal Paid" : "Withdrawal Approved",
            message:
              input.decision === "paid"
                ? `Your withdrawal of ${fmtMoney(amount)} has been paid to your ${withdrawal.method} account.`
                : `Your withdrawal of ${fmtMoney(amount)} has been approved and is being processed.`,
            type: "success",
          });
        }

        await logAudit(
          ctx.investor.id,
          ctx.investor.name,
          `withdrawal_${input.decision}`,
          `Withdrawal #${withdrawal.id} ${fmtMoney(amount)} ${input.decision}`,
          ctx.req.headers,
          tx,
        );
        return { success: true };
      });
      const wdInv = wdInvestor as { id: number; amount: number; reference: string; method: string; destination: string; name: string; email: string } | null;
      if (wdInv) {
        const wdStatus = input.decision === "paid" ? "Paid" : input.decision === "approved" ? "Approved" : "Rejected";
        void notifyAdminEmail({
          eyebrow: `Withdrawal ${wdStatus}`,
          heading: `Withdrawal ${wdStatus} — ${fmtMoney(wdInv.amount)}`,
          intro: `The withdrawal ${wdInv.reference} from ${wdInv.name} has been marked ${wdStatus.toLowerCase()}.${input.note ? ` Note: ${input.note}` : ""}`,
          details: [
            { label: "Customer", value: wdInv.email ? `${wdInv.name} · ${wdInv.email}` : wdInv.name },
            { label: "Amount", value: fmtMoney(wdInv.amount) },
            { label: "Withdrawal Method", value: PAYMENT_METHOD_LABELS[wdInv.method] ?? wdInv.method },
            { label: "Destination", value: wdInv.destination },
            { label: "Reference", value: wdInv.reference },
            { label: "Date / Time", value: fmtDateTime(new Date()) },
            { label: "Status", value: wdStatus },
          ],
          adminLink: "/admin/dashboard?section=withdrawals",
          ctaLabel: "View Withdrawals",
          reqHeaders: ctx.req.headers,
        });
        void sendSystemMessage(wdInv.id, {
          subject: input.decision === "paid" ? "Withdrawal Paid" : input.decision === "approved" ? "Withdrawal Approved" : "Withdrawal Rejected",
          category: "payment_support",
          body:
            input.decision === "paid"
              ? `Your withdrawal of ${fmtMoney(wdInv.amount)} has been paid. Reference: ${wdInv.reference}.`
              : input.decision === "approved"
                ? `Your withdrawal of ${fmtMoney(wdInv.amount)} has been approved and is being processed. Reference: ${wdInv.reference}.`
                : `Your withdrawal of ${fmtMoney(wdInv.amount)} was rejected and the funds were returned to your wallet.${input.note ? ` Reason: ${input.note}.` : ""} Reference: ${wdInv.reference}.`,
          notify: false,
        });
        const st = input.decision === "paid" ? "paid" : input.decision === "approved" ? "approved" : "rejected";
        void notifyUser(wdInv.id, {
          type: `withdrawal_${st}`,
          category: "wallet_payments",
          title: st === "paid" ? "Withdrawal Paid" : st === "approved" ? "Withdrawal Approved" : "Withdrawal Rejected",
          message:
            st === "paid"
              ? `Your withdrawal of ${fmtMoney(wdInv.amount)} has been paid to your account.`
              : st === "approved"
                ? `Your withdrawal of ${fmtMoney(wdInv.amount)} has been approved and is being processed.`
                : `Your withdrawal of ${fmtMoney(wdInv.amount)} was rejected and the funds were returned to your wallet.${input.note ? ` Reason: ${input.note}.` : ""}`,
          severity: st === "rejected" ? "error" : "success",
          link: "/invest/dashboard?tab=transactions",
          relatedRef: wdInv.reference,
          inApp: false,
          emailDetails: [{ label: "Amount", value: fmtMoney(wdInv.amount) }],
        });
      }
      const wdDoc = withdrawalDoc as WithdrawalDocInfo | null;
      if (wdDoc) {
        const doc = wdDoc;
        const invRows = await db.select().from(investors).where(eq(investors.id, doc.investorId)).limit(1);
        const inv = invRows.at(0);
        if (inv) {
          void generatePdfDocument({
            investorId: inv.id,
            ownerEmail: inv.email,
            ownerName: inv.name,
            category: "financial",
            docType: "Withdrawal Receipt",
            amount: doc.amount,
            reference: doc.reference,
            links: { withdrawalId: doc.withdrawalId },
            lines: [
              { label: "Transaction Type", value: "Wallet Withdrawal" },
              { label: "Destination Method", value: doc.method.toUpperCase() },
              { label: "Reference", value: doc.reference },
              { label: "Status", value: doc.paid ? "Paid" : "Approved — Processing" },
            ],
            note: doc.paid
              ? "Your withdrawal has been paid to your selected account."
              : "Your withdrawal has been approved and is being processed for payment.",
          });
        }
      }
      return result;
    }),

  // ── Earnings: run the monthly ROI settlement engine ───────────
  settleInvestments: investAdminQuery.mutation(async ({ ctx }) => {
    const result = await runMonthlySettlement("admin", ctx.investor.name);
    return { success: true, settled: result.settled, profitsPaid: result.profitsPaid, skipped: result.skipped };
  }),

  // Manual earnings adjustment (credit/debit wallet)
  adjustWallet: investAdminQuery
    .input(
      z.object({
        investorId: z.number(),
        amount: z.number().positive(),
        direction: z.enum(["credit", "debit"]),
        reason: z.string().min(3).max(500),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(investors).where(eq(investors.id, input.investorId)).limit(1);
        const investor = rows.at(0);
        if (!investor) throw new TRPCError({ code: "NOT_FOUND", message: "Investor not found" });

        const reference = `ADJ-${Date.now().toString(36).toUpperCase()}`;
        const notification = {
          title: input.direction === "credit" ? "Wallet Credited" : "Balance Adjustment",
          message: `${fmtMoney(input.amount)} ${input.direction === "credit" ? "credited to" : "debited from"} your wallet. Reason: ${input.reason}`,
          kind: "info" as const,
        };

        if (input.direction === "credit") {
          await creditWallet(tx, {
            investorId: investor.id,
            amount: input.amount,
            type: "adjustment",
            description: input.reason,
            reference,
            counters: { totalEarnings: true },
            notification,
          });
        } else {
          await debitWallet(tx, {
            investorId: investor.id,
            amount: input.amount,
            type: "adjustment",
            description: input.reason,
            reference,
            skipFrozenCheck: true, // admin operation
            notification,
          });
        }

        await logAudit(
          ctx.investor.id,
          ctx.investor.name,
          "adjust_wallet",
          `${input.direction} ${fmtMoney(input.amount)} to investor #${investor.id} (${investor.name}): ${input.reason}`,
          ctx.req.headers,
          tx,
        );
        return { success: true };
      });
    }),

  // ── Referrals overview ────────────────────────────────────────
  referrals: investAdminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(referrals).orderBy(desc(referrals.createdAt)).limit(500);
    const allInvestors = await db.select().from(investors);
    const investorMap = new Map(allInvestors.map((i) => [i.id, i]));
    return rows.map((r) => ({
      ...r,
      referrerName: investorMap.get(r.referrerId)?.name ?? "Unknown",
      referrerEmail: investorMap.get(r.referrerId)?.email ?? "",
    }));
  }),

  // ── Transactions overview (reports) ───────────────────────────
  transactions: investAdminQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(investmentTransactions)
      .orderBy(desc(investmentTransactions.createdAt))
      .limit(500);
    const allInvestors = await db.select().from(investors);
    const investorMap = new Map(allInvestors.map((i) => [i.id, i]));
    return rows.map((t) => ({
      ...t,
      investorName: investorMap.get(t.investorId)?.name ?? "Unknown",
      investorEmail: investorMap.get(t.investorId)?.email ?? "",
      investorAvatar: investorMap.get(t.investorId)?.avatar ?? null,
    }));
  }),

  // ── Notifications broadcast ───────────────────────────────────
  broadcast: investAdminQuery
    .input(
      z.object({
        title: z.string().min(2).max(255),
        message: z.string().min(2),
        type: z.enum(["info", "success", "warning", "error"]).default("info"),
        investorId: z.number().optional(), // omit = broadcast to all
      }),
    )
    .mutation(async ({ input }) => {
      await notify(input.investorId ?? null, input.title, input.message, input.type);
      return { success: true };
    }),

  // ── Investment control ────────────────────────────────────────
  investments: investAdminQuery
    .input(z.object({ status: z.string().optional(), search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(investments).orderBy(desc(investments.createdAt)).limit(500);
      const allInvestors = await db.select().from(investors);
      const plans = await db.select().from(investmentPlans);
      const investorMap = new Map(allInvestors.map((i) => [i.id, i]));
      const planMap = new Map(plans.map((p) => [p.id, p]));
      const search = input?.search?.toLowerCase();
      return rows
        .filter((i) => (input?.status && input.status !== "all" ? i.status === input.status : true))
        .filter((i) => {
          if (!search) return true;
          const inv = investorMap.get(i.investorId);
          return (
            inv?.name.toLowerCase().includes(search) ||
            inv?.email.toLowerCase().includes(search) ||
            i.projectName.toLowerCase().includes(search) ||
            String(i.id) === search
          );
        })
        .map((i) => {
          const plan = planMap.get(i.planId);
          const returnRate = i.customReturnRate ?? plan?.targetReturn ?? 0;
          const payoutCount = plan ? payoutCountFor(i, plan) : (i.durationDays ? Math.max(1, Math.ceil(i.durationDays / 30)) : 1);
          const { monthlyProfit, monthlyRate } = monthlyProfitFor(
            Number(i.amount),
            returnRate,
            payoutCount,
          );
          return {
            ...i,
            investorName: investorMap.get(i.investorId)?.name ?? "Unknown",
            investorEmail: investorMap.get(i.investorId)?.email ?? "",
            investorAvatar: investorMap.get(i.investorId)?.avatar ?? null,
            planName: plan?.name ?? "Plan",
            durationMonths: plan?.durationMonths ?? 0,
            durationDaysEffective: plan ? effectiveDurationDays(i, plan) : (i.durationDays ?? 0),
            payoutCount,
            effectiveReturn: returnRate,
            monthlyProfit,
            monthlyRate,
          };
        });
    }),

  approveInvestment: investAdminQuery
    .input(z.object({ investmentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db.transaction(async (tx) => {
        const rows = await tx.select().from(investments).where(eq(investments.id, input.investmentId)).limit(1);
        const inv = rows.at(0);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investment not found" });

        const plans = await tx.select().from(investmentPlans).where(eq(investmentPlans.id, inv.planId)).limit(1);
        const plan = plans[0];
        const now = new Date();

        // Atomic guard: only one approval can activate a pending investment
        const claim = await tx
          .update(investments)
          .set({
            status: "active",
            startDate: now,
            // Flexible-duration investments mature after their chosen number of days;
            // legacy investments keep the plan's month-based duration.
            maturityDate: addDays(now, effectiveDurationDays(inv, plan ?? { durationMonths: 12 })),
            nextProfitAt: now, // month-1 ROI is due immediately (investment month)
          })
          .where(and(eq(investments.id, inv.id), eq(investments.status, "pending")));
        requireAffected(claim, "Only pending investments can be approved");

        // Track funding progress on the linked project
        if (inv.projectId) {
          await tx
            .update(investmentProjects)
            .set({ raisedAmount: sql`raisedAmount + ${Number(inv.amount).toFixed(2)}` })
            .where(eq(investmentProjects.id, inv.projectId));
        }

        await tx.insert(investorNotifications).values({
          investorId: inv.investorId,
          title: "Investment Approved",
          message: `Your investment in ${inv.projectName} is now active. Your first monthly profit is on its way to your wallet — ROI begins in your investment month.`,
          type: "success",
        });
        await logAudit(
          ctx.investor.id,
          ctx.investor.name,
          "approve_investment",
          `Investment #${inv.id} (${inv.projectName}) approved — ${fmtMoney(Number(inv.amount))} activated`,
          ctx.req.headers,
          tx,
        );
        return { success: true };
      });
      // Month-1 ROI is due in the investment month — settle right away instead
      // of waiting for the next hourly tick (settlement is idempotent).
      runMonthlySettlement("scheduler").catch((err) =>
        console.error("post-approval settlement failed:", err),
      );
      return result;
    }),

  rejectInvestment: investAdminQuery
    .input(z.object({ investmentId: z.number(), note: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(investments).where(eq(investments.id, input.investmentId)).limit(1);
        const inv = rows.at(0);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investment not found" });

        // Atomic guard: claim the pending → cancelled transition
        const claim = await tx
          .update(investments)
          .set({ status: "cancelled" })
          .where(and(eq(investments.id, inv.id), eq(investments.status, "pending")));
        requireAffected(claim, "Only pending investments can be rejected");

        // Refund the principal through the wallet engine
        await creditWallet(tx, {
        investorId: inv.investorId,
        amount: Number(inv.amount),
        type: "refund",
        description: `Investment rejected — principal refunded (${inv.projectName})`,
        reference: `REJ-${inv.id}`,
        notification: {
          title: "Investment Rejected",
          message: `Your investment in ${inv.projectName} was rejected and ${fmtMoney(Number(inv.amount))} was refunded to your wallet.${input.note ? ` Reason: ${input.note}` : ""}`,
          kind: "error",
          },
        });

        await logAudit(
          ctx.investor.id,
          ctx.investor.name,
          "reject_investment",
          `Investment #${inv.id} rejected, principal ${fmtMoney(Number(inv.amount))} refunded`,
          ctx.req.headers,
          tx,
        );
        return { success: true };
      });
    }),

  setInvestmentStatus: investAdminQuery
    .input(z.object({ investmentId: z.number(), action: z.enum(["suspend", "activate", "close"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(investments).where(eq(investments.id, input.investmentId)).limit(1);
      const inv = rows.at(0);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investment not found" });

      if (input.action === "suspend") {
        if (inv.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Only active investments can be suspended" });
        await db.update(investments).set({ status: "suspended" }).where(eq(investments.id, inv.id));
        await notify(inv.investorId, "Investment Suspended", `Your investment in ${inv.projectName} has been suspended. Contact support for details.`, "warning");
      } else if (input.action === "activate") {
        if (inv.status !== "suspended") throw new TRPCError({ code: "BAD_REQUEST", message: "Only suspended investments can be reactivated" });
        await db.update(investments).set({ status: "active" }).where(eq(investments.id, inv.id));
        await notify(inv.investorId, "Investment Reactivated", `Your investment in ${inv.projectName} is active again.`, "success");
      } else {
        // close — only matured/completed investments
        if (inv.status !== "matured") throw new TRPCError({ code: "BAD_REQUEST", message: "Only completed investments can be closed" });
        await db.update(investments).set({ progress: 100 }).where(eq(investments.id, inv.id));
      }
      await logAudit(ctx.investor.id, ctx.investor.name, `${input.action}_investment`, `Investment #${inv.id} (${inv.projectName})`, ctx.req.headers);
      return { success: true };
    }),

  extendInvestment: investAdminQuery
    .input(z.object({ investmentId: z.number(), months: z.number().min(1).max(24) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(investments).where(eq(investments.id, input.investmentId)).limit(1);
      const inv = rows.at(0);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investment not found" });

      const newMaturity = addMonths(new Date(inv.maturityDate), input.months);
      await db
        .update(investments)
        .set({ maturityDate: newMaturity })
        .where(eq(investments.id, inv.id));
      await notify(inv.investorId, "Investment Extended", `Your investment in ${inv.projectName} was extended by ${input.months} month(s). New end date: ${newMaturity.toDateString()}.`, "info");
      await logAudit(ctx.investor.id, ctx.investor.name, "extend_investment", `Investment #${inv.id} extended ${input.months} month(s)`, ctx.req.headers);
      return { success: true, newMaturity };
    }),

  // ── Profit management ─────────────────────────────────────────
  setCustomRoi: investAdminQuery
    .input(z.object({ investmentId: z.number(), returnRate: z.number().min(1).max(1000).nullable() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(investments).where(eq(investments.id, input.investmentId)).limit(1);
      const inv = rows.at(0);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investment not found" });

      await db
        .update(investments)
        .set({ customReturnRate: input.returnRate })
        .where(eq(investments.id, inv.id));
      await logAudit(
        ctx.investor.id,
        ctx.investor.name,
        "set_custom_roi",
        input.returnRate === null
          ? `Investment #${inv.id} reverted to plan rate`
          : `Investment #${inv.id} custom ROI set to ${input.returnRate}%`,
        ctx.req.headers,
      );
      return { success: true };
    }),

  setProfitPaused: investAdminQuery
    .input(z.object({ investmentId: z.number(), paused: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(investments).where(eq(investments.id, input.investmentId)).limit(1);
      const inv = rows.at(0);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investment not found" });

      await db
        .update(investments)
        .set({ profitPaused: input.paused ? "yes" : "no" })
        .where(eq(investments.id, inv.id));
      await notify(
        inv.investorId,
        input.paused ? "Profit Payments Paused" : "Profit Payments Resumed",
        input.paused
          ? `Profit payments for ${inv.projectName} have been paused by administration.`
          : `Profit payments for ${inv.projectName} have resumed.`,
        input.paused ? "warning" : "success",
      );
      await logAudit(ctx.investor.id, ctx.investor.name, input.paused ? "pause_profits" : "resume_profits", `Investment #${inv.id}`, ctx.req.headers);
      return { success: true };
    }),

  creditProfitNow: investAdminQuery
    .input(z.object({ investmentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(investments).where(eq(investments.id, input.investmentId)).limit(1);
        const inv = rows.at(0);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investment not found" });
        if (inv.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Only active investments can receive profits" });

        const plans = await tx.select().from(investmentPlans).where(eq(investmentPlans.id, inv.planId)).limit(1);
        const plan = plans[0];
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
        const payoutCount = payoutCountFor(inv, plan);
        if (inv.profitsPaid >= payoutCount) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "All scheduled profits for this investment have been paid" });
        }

        const returnRate = inv.customReturnRate ?? plan.targetReturn;
        const { monthlyProfit, monthlyRate } = monthlyProfitFor(Number(inv.amount), returnRate, payoutCount);
        const monthNumber = inv.profitsPaid + 1;

        // Unique (investmentId, monthNumber) index blocks double-crediting
        await tx.insert(profitPayments).values({
          investmentId: inv.id,
          investorId: inv.investorId,
          amount: monthlyProfit.toFixed(2),
          monthNumber,
          roiPercent: monthlyRate.toFixed(2),
          status: "paid",
        });

        await creditWallet(tx, {
          investorId: inv.investorId,
          amount: monthlyProfit,
          type: "earning",
          description: `Monthly ROI profit (month ${monthNumber}/${payoutCount}, manual credit) — ${inv.projectName}`,
          reference: `PROF-${inv.id}-M${monthNumber}`,
          counters: { totalEarnings: true },
          skipFrozenCheck: true, // admin credit
          notification: {
            title: "Monthly Profit Credited",
            message: `Month ${monthNumber} profit of ${fmtMoney(monthlyProfit)} from ${inv.projectName} has been credited to your wallet.`,
            kind: "success",
          },
        });

        // Optimistic concurrency: only advance if profitsPaid is still what we read
        const upd = await tx
          .update(investments)
          .set({
            profitsPaid: monthNumber,
            totalProfitPaid: (Number(inv.totalProfitPaid) + monthlyProfit).toFixed(2),
            lastProfitAt: new Date(),
            nextProfitAt: addMonths(new Date(inv.startDate), monthNumber), // next month due on the startDate-derived schedule
            currentValue: (Number(inv.amount) + Number(inv.totalProfitPaid) + monthlyProfit).toFixed(2),
            estimatedEarnings: (Number(inv.totalProfitPaid) + monthlyProfit).toFixed(2),
          })
          .where(and(eq(investments.id, inv.id), eq(investments.profitsPaid, inv.profitsPaid)));
        requireAffected(upd, "Investment changed concurrently — try again");

        await logAudit(
          ctx.investor.id,
          ctx.investor.name,
          "credit_profit_manual",
          `Investment #${inv.id} month ${monthNumber} profit ${fmtMoney(monthlyProfit)} credited manually`,
          ctx.req.headers,
          tx,
        );
        return { success: true, amount: monthlyProfit };
      });
    }),

  profitPayments: investAdminQuery
    .input(z.object({ investmentId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(profitPayments).orderBy(desc(profitPayments.paidAt)).limit(500);
      const allInvestors = await db.select().from(investors);
      const allInvestments = await db.select().from(investments);
      const investorMap = new Map(allInvestors.map((i) => [i.id, i]));
      const invMap = new Map(allInvestments.map((i) => [i.id, i]));
      return rows
        .filter((p) => (input?.investmentId ? p.investmentId === input.investmentId : true))
        .map((p) => ({
          ...p,
          investorName: investorMap.get(p.investorId)?.name ?? "Unknown",
          investorAvatar: investorMap.get(p.investorId)?.avatar ?? null,
          projectName: invMap.get(p.investmentId)?.projectName ?? "Investment",
        }));
    }),

  // ── Wallet management: reverse a transaction ──────────────────
  reverseTransaction: investAdminQuery
    .input(z.object({ transactionId: z.number(), reason: z.string().min(3).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(investmentTransactions).where(eq(investmentTransactions.id, input.transactionId)).limit(1);
        const txRow = rows.at(0);
        if (!txRow) throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });

        // Double-reversal guard: a reversal ledger row already exists
        const existing = await tx
          .select({ id: investmentTransactions.id })
          .from(investmentTransactions)
          .where(eq(investmentTransactions.reference, `REV-${txRow.id}`))
          .limit(1);
        if (existing.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "This transaction has already been reversed" });
        }

        // Atomic guard: only completed transactions can be reversed, exactly once
        const claim = await tx
          .update(investmentTransactions)
          .set({ status: "failed", description: `${txRow.description} (REVERSED)` })
          .where(and(eq(investmentTransactions.id, txRow.id), eq(investmentTransactions.status, "completed")));
        requireAffected(claim, "Only completed transactions can be reversed");

        const amount = Number(txRow.amount);
        const reverseOp = {
          investorId: txRow.investorId,
          amount,
          type: "adjustment" as const,
          description: `Reversal of ${txRow.reference ?? `transaction #${txRow.id}`} — ${input.reason}`,
          reference: `REV-${txRow.id}`,
          skipFrozenCheck: true, // admin operation
          notification: {
            title: "Transaction Reversed",
            message: `A transaction of ${fmtMoney(amount)} was reversed by administration. Reason: ${input.reason}`,
            kind: "warning" as const,
          },
        };

        // A credit reversal removes funds; a debit reversal restores them
        if (txRow.direction === "credit") {
          await debitWallet(tx, reverseOp);
        } else {
          await creditWallet(tx, reverseOp);
        }

        // Keep profit payments consistent when reversing an ROI credit
        if (txRow.type === "earning" && txRow.reference?.startsWith("PROF-")) {
          const parts = txRow.reference.split("-M");
          const invId = Number(txRow.reference.split("-")[1]);
          const monthNo = Number(parts[1]);
          if (invId && monthNo) {
            await tx
              .update(profitPayments)
              .set({ status: "reversed" })
              .where(and(eq(profitPayments.investmentId, invId), eq(profitPayments.monthNumber, monthNo)));
          }
        }

        await logAudit(
          ctx.investor.id,
          ctx.investor.name,
          "reverse_transaction",
          `Transaction #${txRow.id} (${txRow.type} ${txRow.direction} ${fmtMoney(amount)}) reversed: ${input.reason}`,
          ctx.req.headers,
          tx,
        );
        return { success: true };
      });
    }),

  // ── Per-investor detail (investments + activity) ──────────────
  investorDetail: investAdminQuery
    .input(z.object({ investorId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const investorRows = await db.select().from(investors).where(eq(investors.id, input.investorId)).limit(1);
      const investor = investorRows.at(0);
      if (!investor) throw new TRPCError({ code: "NOT_FOUND", message: "Investor not found" });

      const myInvestments = await db.select().from(investments).where(eq(investments.investorId, input.investorId)).orderBy(desc(investments.createdAt));
      const activity = await db.select().from(investorActivityLogs).where(eq(investorActivityLogs.investorId, input.investorId)).orderBy(desc(investorActivityLogs.createdAt)).limit(100);
      const txs = await db.select().from(investmentTransactions).where(eq(investmentTransactions.investorId, input.investorId)).orderBy(desc(investmentTransactions.createdAt)).limit(100);

      const myDeposits = await db.select().from(deposits).where(eq(deposits.investorId, input.investorId));
      const myWithdrawals = await db.select().from(withdrawals).where(eq(withdrawals.investorId, input.investorId));
      const myProfits = await db.select().from(profitPayments).where(eq(profitPayments.investorId, input.investorId));

      const financials = {
        walletBalance: Number(investor.walletBalance),
        availableBalance: Number(investor.walletBalance),
        walletFrozen: investor.walletFrozen === "yes",
        totalDeposits: myDeposits.filter((d) => d.status === "approved").reduce((s, d) => s + Number(d.amount), 0),
        totalWithdrawals: myWithdrawals.filter((w) => w.status === "paid" || w.status === "approved").reduce((s, w) => s + Number(w.amount), 0),
        withdrawalCount: myWithdrawals.filter((w) => w.status === "paid" || w.status === "approved").length,
        activeInvestments: myInvestments.filter((i) => i.status === "active").reduce((s, i) => s + Number(i.amount), 0),
        monthlyRoiPaid: myProfits.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0),
        pendingDeposits: myDeposits.filter((d) => d.status === "pending").length,
        pendingWithdrawals: myWithdrawals.filter((w) => w.status === "pending").length,
        totalProfitEarned: Number(investor.totalEarnings),
        referralEarnings: Number(investor.referralEarnings),
      };

      return {
        investor: sanitizeInvestor(investor),
        investments: myInvestments,
        activity,
        transactions: txs,
        financials,
      };
    }),

  // ── Freeze / unfreeze an investor wallet ──────────────────────
  setWalletFrozen: investAdminQuery
    .input(z.object({ investorId: z.number(), frozen: z.boolean(), reason: z.string().max(500).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(investors).where(eq(investors.id, input.investorId)).limit(1);
        const investor = rows.at(0);
        if (!investor) throw new TRPCError({ code: "NOT_FOUND", message: "Investor not found" });

        const target = input.frozen ? "yes" : "no";
        const claim = await tx
          .update(investors)
          .set({ walletFrozen: target })
          .where(and(eq(investors.id, investor.id), eq(investors.walletFrozen, input.frozen ? "no" : "yes")));
        requireAffected(claim, `Wallet is already ${input.frozen ? "frozen" : "active"}`);

        await tx.insert(investorNotifications).values({
          investorId: investor.id,
          title: input.frozen ? "Wallet Frozen" : "Wallet Unfrozen",
          message: input.frozen
            ? `Your wallet has been frozen by administration. Withdrawals and investments are temporarily disabled.${input.reason ? ` Reason: ${input.reason}` : ""}`
            : "Your wallet has been unfrozen. All features are available again.",
          type: input.frozen ? "warning" : "success",
        });

        await logAudit(
          ctx.investor.id,
          ctx.investor.name,
          input.frozen ? "freeze_wallet" : "unfreeze_wallet",
          `Investor #${investor.id} (${investor.name}) wallet ${input.frozen ? "frozen" : "unfrozen"}${input.reason ? ` — ${input.reason}` : ""}`,
          ctx.req.headers,
          tx,
        );
        return { success: true };
      });
    }),

  // ── Reconcile an investor's wallet & counters against the ledger ──
  recalculateInvestor: investAdminQuery
    .input(z.object({ investorId: z.number(), fix: z.boolean().default(false) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(investors).where(eq(investors.id, input.investorId)).limit(1);
      const investor = rows.at(0);
      if (!investor) throw new TRPCError({ code: "NOT_FOUND", message: "Investor not found" });

      // Recompute aggregate counters from the source tables
      const myDeposits = await db.select().from(deposits).where(eq(deposits.investorId, investor.id));
      const myWithdrawals = await db.select().from(withdrawals).where(eq(withdrawals.investorId, investor.id));
      const myReferrals = await db.select().from(referrals).where(eq(referrals.referrerId, investor.id));
      const totalDeposited = myDeposits.filter((d) => d.status === "approved").reduce((s, d) => s + Number(d.amount), 0);
      const doneWithdrawals = myWithdrawals.filter((w) => w.status === "paid" || w.status === "approved");
      const totalWithdrawn = doneWithdrawals.reduce((s, w) => s + Number(w.amount), 0);
      const withdrawalCount = doneWithdrawals.length;
      const referralEarnings = myReferrals.filter((r) => r.status === "credited").reduce((s, r) => s + Number(r.bonusAmount), 0);

      // Recompute the wallet from the ledger: completed credits − completed debits
      const ledger = await db
        .select({
          credits: sql<string>`coalesce(sum(case when ${investmentTransactions.direction} = 'credit' then ${investmentTransactions.amount} else 0 end), 0)`,
          debits: sql<string>`coalesce(sum(case when ${investmentTransactions.direction} = 'debit' then ${investmentTransactions.amount} else 0 end), 0)`,
        })
        .from(investmentTransactions)
        .where(and(eq(investmentTransactions.investorId, investor.id), eq(investmentTransactions.status, "completed")));
      const ledgerBalance = Number(ledger[0]?.credits ?? 0) - Number(ledger[0]?.debits ?? 0);
      const storedBalance = Number(investor.walletBalance);
      const drift = Math.round((storedBalance - ledgerBalance) * 100) / 100;

      if (input.fix) {
        await db
          .update(investors)
          .set({
            walletBalance: ledgerBalance.toFixed(2),
            totalDeposited: totalDeposited.toFixed(2),
            totalWithdrawn: totalWithdrawn.toFixed(2),
            withdrawalCount,
            referralEarnings: referralEarnings.toFixed(2),
          })
          .where(eq(investors.id, investor.id));
        await logAudit(
          ctx.investor.id,
          ctx.investor.name,
          "recalculate_investor",
          `Investor #${investor.id} (${investor.name}) reconciled — wallet ${storedBalance.toFixed(2)} → ${ledgerBalance.toFixed(2)} (drift ${drift.toFixed(2)})`,
          ctx.req.headers,
        );
      }

      return {
        investorId: investor.id,
        name: investor.name,
        storedBalance,
        ledgerBalance,
        drift,
        totalDeposited,
        totalWithdrawn,
        withdrawalCount,
        referralEarnings,
        fixed: input.fix,
      };
    }),

  // ── Investment liquidation management ─────────────────────────
  liquidationRequests: investAdminQuery
    .input(
      z
        .object({
          status: z.enum(["pending", "approved", "rejected", "completed"]).optional(),
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(liquidationRequests).orderBy(desc(liquidationRequests.requestedAt)).limit(300);
      const allInvestors = await db.select().from(investors);
      const allInvestments = await db.select().from(investments);
      const allPlans = await db.select().from(investmentPlans);
      const invMap = new Map(allInvestors.map((i) => [i.id, i]));
      const investmentMap = new Map(allInvestments.map((i) => [i.id, i]));
      const planMap = new Map(allPlans.map((p) => [p.id, p]));

      const search = input?.search?.toLowerCase().trim();
      return rows
        .map((r) => {
          const investor = invMap.get(r.investorId);
          const investment = investmentMap.get(r.investmentId);
          const plan = investment ? planMap.get(investment.planId) : undefined;
          return {
            ...r,
            investorName: investor?.name ?? "Unknown",
            investorEmail: investor?.email ?? "",
            investorAvatar: investor?.avatar ?? null,
            projectName: investment?.projectName ?? "Investment",
            planName: plan?.name ?? "Plan",
            roi: investment?.roi ?? "0.00",
            maturityDate: investment?.maturityDate ?? null,
            investmentStatus: investment?.status ?? "unknown",
          };
        })
        .filter((r) => {
          if (input?.status && r.status !== input.status) return false;
          if (search) {
            const hay = `${r.investorName} ${r.investorEmail} ${r.projectName} ${r.planName} #${r.id}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        });
    }),

  liquidationStats: investAdminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(liquidationRequests);
    const completed = rows.filter((r) => r.status === "completed" || r.status === "approved");
    return {
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
      completed: completed.length,
      totalLiquidated: completed.reduce((s, r) => s + Number(r.finalAmount ?? r.estimatedValue), 0),
    };
  }),

  reviewLiquidation: investAdminQuery
    .input(
      z.object({
        requestId: z.number(),
        decision: z.enum(["approved", "rejected"]),
        finalAmount: z.number().positive().optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      let liqDoc: LiquidationDocInfo | null = null;
      const result = await db.transaction(async (tx) => {
        const rows = await tx.select().from(liquidationRequests).where(eq(liquidationRequests.id, input.requestId)).limit(1);
        const request = rows.at(0);
        if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Liquidation request not found" });

        const invRows = await tx.select().from(investments).where(eq(investments.id, request.investmentId)).limit(1);
        const inv = invRows.at(0);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Linked investment not found" });

        if (input.decision === "rejected") {
          // Atomic claim: only one rejection can land
          const claim = await tx
            .update(liquidationRequests)
            .set({ status: "rejected", adminNote: input.note || null, processedAt: new Date() })
            .where(and(eq(liquidationRequests.id, request.id), eq(liquidationRequests.status, "pending")));
          requireAffected(claim, "This request has already been processed");

          // Unfreeze ROI — the investment continues as normal
          if (inv.status === "active") {
            await tx.update(investments).set({ profitPaused: "no" }).where(eq(investments.id, inv.id));
          }

          await tx.insert(investorNotifications).values({
            investorId: request.investorId,
            title: "Liquidation Request Rejected",
            message: `Your liquidation request for ${inv.projectName} was rejected and your investment continues as normal.${input.note ? ` Reason: ${input.note}` : ""}`,
            type: "error",
          });
          await logAudit(
            ctx.investor.id,
            ctx.investor.name,
            "liquidation_rejected",
            `Liquidation #${request.id} (investment #${inv.id}) rejected${input.note ? ` — ${input.note}` : ""}`,
            ctx.req.headers,
            tx,
          );
          return { success: true };
        }

        // ── Approval: everything atomically ──
        const payout = input.finalAmount ?? Number(request.estimatedValue);
        if (!(payout > 0)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Final liquidation amount must be positive" });
        }

        // 1) Claim the request (pending → completed)
        const claimReq = await tx
          .update(liquidationRequests)
          .set({
            status: "completed",
            finalAmount: payout.toFixed(2),
            adminNote: input.note || null,
            processedAt: new Date(),
          })
          .where(and(eq(liquidationRequests.id, request.id), eq(liquidationRequests.status, "pending")));
        requireAffected(claimReq, "This request has already been processed");

        // 2) Claim the investment (active → liquidated) — blocks races with the ROI scheduler
        const claimInv = await tx
          .update(investments)
          .set({ status: "liquidated", nextProfitAt: null })
          .where(and(eq(investments.id, inv.id), eq(investments.status, "active")));
        requireAffected(claimInv, "This investment is no longer active");

        // 3) Credit the payout through the wallet engine
        await creditWallet(tx, {
          investorId: request.investorId,
          amount: payout,
          type: "refund",
          description: `Investment liquidation payout — ${inv.projectName}`,
          reference: `LIQ-${request.id}`,
          skipFrozenCheck: true, // liquidation always pays out
          notification: {
            title: "Liquidation Approved",
            message: `Your liquidation request for ${inv.projectName} was approved. ${fmtMoney(payout)} has been credited to your wallet.`,
            kind: "success",
          },
        });

        liqDoc = { investorId: request.investorId, investmentId: inv.id, projectName: inv.projectName, amountInvested: Number(inv.amount), payout, requestId: request.id };

        await notifyAdmin(
          "Liquidation Completed",
          `${ctx.investor.name} approved liquidation #${request.id} — ${fmtMoney(payout)} credited (investment #${inv.id}, ${inv.projectName}).`,
          "investment",
          tx,
        );
        await logAudit(
          ctx.investor.id,
          ctx.investor.name,
          "liquidation_approved",
          `Liquidation #${request.id} approved — investment #${inv.id} closed, payout ${fmtMoney(payout)} (est. ${fmtMoney(Number(request.estimatedValue))})`,
          ctx.req.headers,
          tx,
        );
        return { success: true, payout };
      });
      const liq = liqDoc as LiquidationDocInfo | null;
      if (liq) {
        const d = liq;
        const invRows = await db.select().from(investors).where(eq(investors.id, d.investorId)).limit(1);
        const investor = invRows.at(0);
        if (investor) {
          void generatePdfDocument({
            investorId: investor.id,
            ownerEmail: investor.email,
            ownerName: investor.name,
            category: "investment",
            docType: "Investment Closure Certificate",
            name: `Investment Closure Certificate — ${d.projectName} (LIQ-${d.requestId})`,
            amount: d.payout,
            reference: `LIQ-${d.requestId}`,
            links: { investmentId: d.investmentId },
            lines: [
              { label: "Project", value: d.projectName },
              { label: "Amount Invested", value: fmtMoney(d.amountInvested) },
              { label: "Liquidation Payout", value: fmtMoney(d.payout) },
              { label: "Status", value: "Liquidated — Investment Closed" },
            ],
            note: "This certificate confirms the liquidation and closure of the investment described above. The payout has been credited to your wallet.",
          });
        }
      }
      return result;
    }),

  // ── Admin notifications ───────────────────────────────────────
  adminNotifications: investAdminQuery.query(async () => {
    const db = getDb();
    return db.select().from(adminNotifications).orderBy(desc(adminNotifications.createdAt)).limit(200);
  }),

  adminUnreadCount: investAdminQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(adminNotifications)
      .where(eq(adminNotifications.isRead, "no"));
    return { count: Number(rows[0]?.count ?? 0) };
  }),

  markAdminNotificationRead: investAdminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(adminNotifications).set({ isRead: "yes" }).where(eq(adminNotifications.id, input.id));
      return { success: true };
    }),

  markAllAdminNotificationsRead: investAdminQuery.mutation(async () => {
    const db = getDb();
    await db.update(adminNotifications).set({ isRead: "yes" }).where(eq(adminNotifications.isRead, "no"));
    return { success: true };
  }),

  // ── Pending actions (real records awaiting admin handling) ────
  // Powers the header indicator, its dropdown and the overview summary.
  // Every count/item is computed straight from the source tables, so an
  // item stays "pending" until its underlying workflow status actually
  // changes — the adminNotifications read-state is a separate system and
  // never affects these numbers. Completed / rejected / cancelled /
  // handled records are never counted.
  pendingActions: investAdminQuery.query(async () => {
    const db = getDb();
    const count = async (q: Promise<{ count: number }[]>) => Number((await q)[0]?.count ?? 0);

    const [
      pendDeposits,
      openWithdrawals, // "pending" needs review, "approved" still needs payout
      pendInvestments,
      pendLiquidations,
      pendMortgages,
      pendKyc,
      unpaidOrders,
      pendAppointments,
      pendTestimonials,
      cDeposits,
      cWithdrawals,
      cInvestments,
      cLiquidations,
      cMortgages,
      cKyc,
      cOrders,
      cAppointments,
      cTestimonials,
    ] = await Promise.all([
      db.select().from(deposits).where(eq(deposits.status, "pending")).orderBy(desc(deposits.createdAt)).limit(25),
      db.select().from(withdrawals).where(inArray(withdrawals.status, ["pending", "approved"])).orderBy(desc(withdrawals.createdAt)).limit(25),
      db.select().from(investments).where(eq(investments.status, "pending")).orderBy(desc(investments.createdAt)).limit(25),
      db.select().from(liquidationRequests).where(eq(liquidationRequests.status, "pending")).orderBy(desc(liquidationRequests.requestedAt)).limit(25),
      db.select().from(mortgages).where(eq(mortgages.status, "pending")).orderBy(desc(mortgages.createdAt)).limit(25),
      db.select().from(kycRequests).where(eq(kycRequests.status, "pending")).orderBy(desc(kycRequests.submittedAt)).limit(25),
      db.select().from(orders).where(eq(orders.paymentStatus, "pending")).orderBy(desc(orders.createdAt)).limit(25),
      db.select().from(appointments).where(eq(appointments.status, "pending")).orderBy(desc(appointments.createdAt)).limit(25),
      db.select().from(testimonials).where(eq(testimonials.status, "pending")).orderBy(desc(testimonials.createdAt)).limit(25),
      count(db.select({ count: sql<number>`count(*)` }).from(deposits).where(eq(deposits.status, "pending"))),
      count(db.select({ count: sql<number>`count(*)` }).from(withdrawals).where(inArray(withdrawals.status, ["pending", "approved"]))),
      count(db.select({ count: sql<number>`count(*)` }).from(investments).where(eq(investments.status, "pending"))),
      count(db.select({ count: sql<number>`count(*)` }).from(liquidationRequests).where(eq(liquidationRequests.status, "pending"))),
      count(db.select({ count: sql<number>`count(*)` }).from(mortgages).where(eq(mortgages.status, "pending"))),
      count(db.select({ count: sql<number>`count(*)` }).from(kycRequests).where(eq(kycRequests.status, "pending"))),
      count(db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.paymentStatus, "pending"))),
      count(db.select({ count: sql<number>`count(*)` }).from(appointments).where(eq(appointments.status, "pending"))),
      count(db.select({ count: sql<number>`count(*)` }).from(testimonials).where(eq(testimonials.status, "pending"))),
    ]);

    const [allInvestors, allCustomers] = await Promise.all([
      db.select({ id: investors.id, name: investors.name }).from(investors),
      db.select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName }).from(customers),
    ]);
    const investorName = new Map(allInvestors.map((i) => [i.id, i.name]));
    const customerName = new Map(allCustomers.map((c) => [c.id, `${c.firstName} ${c.lastName}`]));
    const invName = (id: number) => investorName.get(id) ?? `Customer #${id}`;

    // Liquidation requests reference the parent investment for its name
    const liqInvIds = [...new Set(pendLiquidations.map((r) => r.investmentId))];
    const liqInvs = liqInvIds.length
      ? await db.select({ id: investments.id, projectName: investments.projectName }).from(investments).where(inArray(investments.id, liqInvIds))
      : [];
    const liqProject = new Map(liqInvs.map((i) => [i.id, i.projectName]));

    type PendingItem = {
      key: string;
      category: string;
      categoryLabel: string;
      title: string;
      message: string;
      createdAt: Date;
      section: string;
      filter?: string;
    };
    const items: PendingItem[] = [];

    for (const d of pendDeposits) {
      items.push({
        key: `deposit-${d.id}`,
        category: "deposits",
        categoryLabel: "Deposits",
        title: "Pending Deposit",
        message: `${fmtMoney(d.amount)} deposit from ${invName(d.investorId)} requires review`,
        createdAt: d.createdAt,
        section: "deposits",
      });
    }
    for (const w of openWithdrawals) {
      const awaitingPayout = w.status === "approved";
      items.push({
        key: `withdrawal-${w.id}`,
        category: "withdrawals",
        categoryLabel: "Withdrawals",
        title: awaitingPayout ? "Withdrawal Awaiting Payout" : "Pending Withdrawal",
        message: awaitingPayout
          ? `${fmtMoney(w.amount)} withdrawal for ${invName(w.investorId)} is approved — mark as paid to complete`
          : `${fmtMoney(w.amount)} withdrawal from ${invName(w.investorId)} requires review`,
        createdAt: w.createdAt,
        section: "withdrawals",
      });
    }
    for (const inv of pendInvestments) {
      items.push({
        key: `investment-${inv.id}`,
        category: "investments",
        categoryLabel: "Home Plans",
        title: "Pending Home Plan",
        message: `${invName(inv.investorId)} put ${fmtMoney(inv.amount)} into ${inv.projectName} — approval required`,
        createdAt: inv.createdAt,
        section: "investments",
        filter: "pending",
      });
    }
    for (const l of pendLiquidations) {
      items.push({
        key: `liquidation-${l.id}`,
        category: "liquidations",
        categoryLabel: "Early Withdrawals",
        title: "Early Withdrawal Request",
        message: `${invName(l.investorId)} requests early exit from ${liqProject.get(l.investmentId) ?? `investment #${l.investmentId}`} (est. payout ${fmtMoney(l.estimatedValue)})`,
        createdAt: l.requestedAt,
        section: "liquidations",
      });
    }
    for (const m of pendMortgages) {
      items.push({
        key: `mortgage-${m.id}`,
        category: "mortgages",
        categoryLabel: "Financing",
        title: "Financing Application",
        message: `${invName(m.investorId)} applied to finance ${m.propertyName} (${m.planName} · ${fmtMoney(m.propertyPrice)})`,
        createdAt: m.createdAt,
        section: "mortgages",
      });
    }
    for (const k of pendKyc) {
      items.push({
        key: `kyc-${k.id}`,
        category: "verification",
        categoryLabel: "Verification",
        title: "Verification Request",
        message: `${invName(k.investorId)} submitted a ${k.tierRequested === "tier3" ? "Tier 3" : "Tier 2"} verification request`,
        createdAt: k.submittedAt,
        section: "verification",
      });
    }
    for (const o of unpaidOrders) {
      items.push({
        key: `order-${o.id}`,
        category: "orders",
        categoryLabel: "Property Orders",
        title: "Order Awaiting Payment Confirmation",
        message: `${o.orderNumber} from ${customerName.get(o.customerId) ?? `Customer #${o.customerId}`} — ${fmtMoney(o.totalAmount)} payment to confirm`,
        createdAt: o.createdAt,
        section: "property",
      });
    }
    for (const a of pendAppointments) {
      items.push({
        key: `appointment-${a.id}`,
        category: "appointments",
        categoryLabel: "Appointments",
        title: "Appointment Request",
        message: `${a.customerName} requested a ${a.type.replace(/_/g, " ")} (${a.appointmentRef})`,
        createdAt: a.createdAt,
        section: "appointments",
        filter: "pending",
      });
    }
    for (const t of pendTestimonials) {
      items.push({
        key: `testimonial-${t.id}`,
        category: "testimonials",
        categoryLabel: "Testimonials",
        title: "Testimonial Awaiting Review",
        message: `${t.customerName} submitted a ${t.rating}-star testimonial${t.propertyName ? ` for ${t.propertyName}` : ""}`,
        createdAt: t.createdAt,
        section: "testimonials",
        filter: "pending",
      });
    }

    items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const countMap: Record<string, number> = {
      deposits: cDeposits,
      withdrawals: cWithdrawals,
      investments: cInvestments,
      liquidations: cLiquidations,
      mortgages: cMortgages,
      verification: cKyc,
      orders: cOrders,
      appointments: cAppointments,
      testimonials: cTestimonials,
    };
    const categories = [
      { key: "deposits", label: "Deposits", section: "deposits" },
      { key: "withdrawals", label: "Withdrawals", section: "withdrawals" },
      { key: "investments", label: "Home Plans", section: "investments", filter: "pending" },
      { key: "liquidations", label: "Early Withdrawals", section: "liquidations" },
      { key: "mortgages", label: "Financing", section: "mortgages" },
      { key: "verification", label: "Verification", section: "verification" },
      { key: "orders", label: "Property Orders", section: "property" },
      { key: "appointments", label: "Appointments", section: "appointments", filter: "pending" },
      { key: "testimonials", label: "Testimonials", section: "testimonials", filter: "pending" },
    ]
      .map((c) => ({ ...c, count: countMap[c.key] ?? 0 }))
      .filter((c) => c.count > 0);

    return {
      total: categories.reduce((sum, c) => sum + c.count, 0),
      categories,
      items: items.slice(0, 40),
    };
  }),

  // ── Activity & audit logs ─────────────────────────────────────
  activityLogs: investAdminQuery
    .input(z.object({ investorId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const rows = input?.investorId
        ? await db.select().from(investorActivityLogs).where(eq(investorActivityLogs.investorId, input.investorId)).orderBy(desc(investorActivityLogs.createdAt)).limit(300)
        : await db.select().from(investorActivityLogs).orderBy(desc(investorActivityLogs.createdAt)).limit(300);
      const allInvestors = await db.select().from(investors);
      const investorMap = new Map(allInvestors.map((i) => [i.id, i]));
      return rows.map((a) => ({
        ...a,
        investorName: investorMap.get(a.investorId)?.name ?? "Unknown",
        investorEmail: investorMap.get(a.investorId)?.email ?? "",
      }));
    }),

  auditLogs: investAdminQuery.query(async () => {
    const db = getDb();
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(300);
  }),
});
