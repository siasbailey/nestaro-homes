/**
 * Client-side mirror of api/lib/mortgage.ts — used by the public mortgage
 * page, checkout, and dashboard schedule previews. Keep formulas in sync.
 */
export type PlanLikeClient = {
  planType: "monthly" | "yearly";
  durationValue: number;
  downPaymentPercent: number | string;
  interestPercent: number | string;
  paymentFrequency: "monthly" | "yearly";
};

export function quoteMortgageClient(
  price: number,
  plan: PlanLikeClient,
  minDownPaymentPercent?: number | null,
) {
  const durationMonths = plan.planType === "yearly" ? plan.durationValue * 12 : plan.durationValue;
  const downPercent = Math.max(Number(plan.downPaymentPercent), minDownPaymentPercent ?? 0);
  const downPayment = Math.round(((price * downPercent) / 100) * 100) / 100;
  const totalPayable = Math.round(price * (1 + Number(plan.interestPercent) / 100) * 100) / 100;
  const periods = plan.paymentFrequency === "yearly" ? Math.max(durationMonths / 12, 1) : durationMonths;
  const installment = Math.round((totalPayable / periods) * 100) / 100;
  return { durationMonths, downPercent, downPayment, totalPayable, periods, installment };
}

export function addPeriodClient(from: Date, frequency: "monthly" | "yearly"): Date {
  const d = new Date(from);
  if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function estimatedCompletionClient(from: Date, durationMonths: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + durationMonths);
  return d;
}

export type ScheduleRow = {
  n: number;
  label: string;
  date: Date;
  amount: number;
  remaining: number;
};

/**
 * Estimated repayment schedule: down payment today, then one installment per
 * period until the contract value is covered.
 */
export function buildSchedule(
  totalPayable: number,
  downPayment: number,
  installment: number,
  periods: number,
  frequency: "monthly" | "yearly",
  from: Date = new Date(),
): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let remaining = totalPayable;
  let date = new Date(from);

  const down = Math.min(downPayment, remaining);
  remaining = Math.max(0, Math.round((remaining - down) * 100) / 100);
  rows.push({ n: 0, label: "Down payment", date: new Date(date), amount: down, remaining });

  for (let i = 1; i <= periods && remaining > 0.009; i++) {
    date = addPeriodClient(date, frequency);
    const amt = Math.min(installment, remaining);
    remaining = Math.max(0, Math.round((remaining - amt) * 100) / 100);
    rows.push({
      n: i,
      label: `${frequency === "yearly" ? "Yearly" : "Monthly"} installment ${i}`,
      date: new Date(date),
      amount: amt,
      remaining,
    });
  }
  return rows;
}
