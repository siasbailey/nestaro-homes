import { and, eq, isNull, lt, or } from "drizzle-orm";
import { fmtMoney, fmtDate } from "./format";
import { mortgages, investorNotifications } from "@db/schema";
import { getDb } from "../queries/connection";
import { notifyAdmin } from "./activity";

export type PlanLike = {
  planType: "monthly" | "yearly";
  durationValue: number;
  downPaymentPercent: string | number;
  interestPercent: string | number;
  paymentFrequency: "monthly" | "yearly";
};

export function planDurationMonths(plan: PlanLike): number {
  return plan.planType === "yearly" ? plan.durationValue * 12 : plan.durationValue;
}

export function quoteMortgage(price: number, plan: PlanLike, minDownPaymentPercent?: number | null) {
  const durationMonths = planDurationMonths(plan);
  const downPercent = Math.max(Number(plan.downPaymentPercent), minDownPaymentPercent ?? 0);
  const downPayment = Math.round(((price * downPercent) / 100) * 100) / 100;
  const totalPayable = Math.round(price * (1 + Number(plan.interestPercent) / 100) * 100) / 100;
  const periods =
    plan.paymentFrequency === "yearly" ? Math.max(durationMonths / 12, 1) : durationMonths;
  const installment = Math.round((totalPayable / periods) * 100) / 100;
  return { durationMonths, downPercent, downPayment, totalPayable, periods, installment };
}

export function addPeriod(from: Date, frequency: "monthly" | "yearly"): Date {
  const d = new Date(from);
  if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function estimatedCompletion(from: Date, durationMonths: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + durationMonths);
  return d;
}

/**
 * Hourly pass (runs alongside the ROI scheduler): reminds investors about
 * upcoming mortgage payments and flags overdue accounts to the Primary Admin.
 * Idempotent per payment cycle via lastReminderAt.
 */
export async function runMortgageReminders() {
  const db = getDb();
  const now = new Date();
  const soon = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  const dueSoon = await db
    .select()
    .from(mortgages)
    .where(
      and(
        eq(mortgages.status, "active"),
        lt(mortgages.nextPaymentAt, soon),
        or(isNull(mortgages.lastReminderAt), lt(mortgages.lastReminderAt, now)),
      ),
    )
    .limit(200);

  for (const m of dueSoon) {
    if (!m.nextPaymentAt) continue;
    const nextDue = new Date(m.nextPaymentAt);
    const lastReminded = m.lastReminderAt ? new Date(m.lastReminderAt) : null;
    // Only one reminder per due date
    if (lastReminded && lastReminded >= new Date(nextDue.getTime() - 6 * 24 * 60 * 60 * 1000)) continue;

    const overdue = nextDue < now;
    await db.insert(investorNotifications).values({
      investorId: m.investorId,
      title: overdue ? "Mortgage Payment Overdue" : "Upcoming Mortgage Payment",
      message: overdue
        ? `Your ${m.paymentFrequency} payment of ${fmtMoney(Number(m.installmentAmount))} for ${m.propertyName} was due on ${fmtDate(nextDue)}. Please make a payment from your wallet to keep your mortgage in good standing.`
        : `Your ${m.paymentFrequency} payment of ${fmtMoney(Number(m.installmentAmount))} for ${m.propertyName} is due on ${fmtDate(nextDue)}. Remaining balance: ${fmtMoney(Number(m.remainingBalance))}.`,
      type: overdue ? "warning" : "info",
    });
    if (overdue) {
      await notifyAdmin(
        "Mortgage Payment Overdue",
        `Mortgage ${m.reference} (${m.propertyName}) is overdue — installment of ${fmtMoney(Number(m.installmentAmount))} was due ${fmtDate(nextDue)}.`,
        "system",
      );
    }
    await db.update(mortgages).set({ lastReminderAt: now }).where(eq(mortgages.id, m.id));
  }
}
