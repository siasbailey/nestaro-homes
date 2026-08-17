import type { Investment, InvestmentPlan } from "@db/schema";
import { LiquidationRules } from "@contracts/constants";
import { monthlyProfitFor, payoutCountFor } from "./roi";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface LiquidationEstimate {
  principal: number;
  profitEarned: number; // ROI already paid out over the investment's life
  monthlyProfit: number;
  penaltyPercent: number;
  penaltyAmount: number;
  accruedProfit: number; // partial-month profit since the last payout
  estimatedValue: number; // principal − penalty + accrued profit
}

/**
 * Computes what an early liquidation would pay out for an active investment.
 * Monthly profits are already credited month by month, so the locked value is
 * the principal plus the current partial month's accrual, minus the
 * early-exit penalty.
 */
export function computeLiquidationEstimate(
  inv: Pick<Investment, "amount" | "customReturnRate" | "profitsPaid" | "totalProfitPaid" | "lastProfitAt" | "startDate" | "durationDays">,
  plan: Pick<InvestmentPlan, "targetReturn" | "durationMonths">,
  now: Date = new Date(),
): LiquidationEstimate {
  const principal = Number(inv.amount);
  const returnRate = inv.customReturnRate ?? plan.targetReturn;
  const payoutCount = payoutCountFor(inv, plan);
  const { monthlyProfit } = monthlyProfitFor(principal, returnRate, payoutCount);

  const lastProfit = inv.lastProfitAt ? new Date(inv.lastProfitAt) : new Date(inv.startDate);
  const daysAccrued = Math.max(
    0,
    Math.floor((now.getTime() - lastProfit.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const monthsRemaining = Math.max(0, payoutCount - inv.profitsPaid);
  const accruedProfit =
    monthsRemaining > 0
      ? round2(Math.min((monthlyProfit * daysAccrued) / LiquidationRules.daysPerMonth, monthlyProfit))
      : 0;

  const penaltyAmount = round2((principal * LiquidationRules.penaltyPercent) / 100);
  const estimatedValue = round2(principal - penaltyAmount + accruedProfit);

  return {
    principal,
    profitEarned: Number(inv.totalProfitPaid),
    monthlyProfit,
    penaltyPercent: LiquidationRules.penaltyPercent,
    penaltyAmount,
    accruedProfit,
    estimatedValue,
  };
}
