import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  deposits,
  investments,
  investors,
  mortgages,
  notificationPreferences,
  profitPayments,
  sentReminders,
  withdrawals,
} from "@db/schema";
import { fmtMoney, notifyUser } from "./notify";
import { generatePdfDocument } from "./documents";

/**
 * Scheduled notification sweep (hourly, day-gated internally):
 *  - investment maturity reminders (7d / 1d) + matured alerts
 *  - mortgage payment reminders (3d before due) + overdue alerts
 *  - KYC verification reminders (weekly)
 *  - incomplete profile reminders (once)
 *  - dormant account reminders (monthly)
 *  - weekly portfolio summaries (Mondays, opt-in)
 *  - monthly account statements (1st of month, opt-in)
 *
 * Dedupe via the sentReminders table so each reminder fires exactly once
 * per its key even if the server restarts.
 */

async function claim(key: string, investorId?: number): Promise<boolean> {
  try {
    await getDb().insert(sentReminders).values({ reminderKey: key, investorId: investorId ?? null });
    return true;
  } catch {
    return false; // duplicate key → already sent
  }
}

function weekKey(d: Date): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400_000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function sweep() {
  const db = getDb();
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 86400_000);
  const in1d = new Date(now.getTime() + 86400_000);
  const in3d = new Date(now.getTime() + 3 * 86400_000);

  // ── 1. Investment maturity ──
  const maturing = await db
    .select()
    .from(investments)
    .where(and(eq(investments.status, "active"), lte(investments.maturityDate, in7d)));
  for (const inv of maturing) {
    const m = new Date(inv.maturityDate);
    if (m <= now) {
      if (await claim(`matured:${inv.id}`, inv.investorId)) {
        await notifyUser(inv.investorId, {
          type: "investment_matured",
          category: "investments",
          title: "Investment Matured",
          message: `Your investment in ${inv.projectName} (${fmtMoney(inv.amount)}) has reached maturity. Your returns are now available in your wallet.`,
          severity: "success",
          link: "/invest/dashboard?tab=portfolio",
          relatedRef: `INV-${inv.id}`,
          emailDetails: [
            { label: "Project", value: inv.projectName },
            { label: "Amount Invested", value: fmtMoney(inv.amount) },
            { label: "Total Profit Paid", value: fmtMoney(inv.totalProfitPaid) },
          ],
        });
      }
    } else if (m <= in1d) {
      if (await claim(`maturity1:${inv.id}`, inv.investorId)) {
        await notifyUser(inv.investorId, {
          type: "investment_maturity_reminder",
          category: "investments",
          title: "Investment Matures Tomorrow",
          message: `Your investment in ${inv.projectName} matures tomorrow (${m.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}).`,
          link: "/invest/dashboard?tab=portfolio",
          relatedRef: `INV-${inv.id}`,
          emailDetails: [
            { label: "Project", value: inv.projectName },
            { label: "Amount Invested", value: fmtMoney(inv.amount) },
            { label: "Maturity Date", value: m.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" }) },
          ],
        });
      }
    } else if (m <= in7d) {
      if (await claim(`maturity7:${inv.id}`, inv.investorId)) {
        await notifyUser(inv.investorId, {
          type: "investment_maturity_reminder",
          category: "investments",
          title: "Investment Nearing Maturity",
          message: `Your investment in ${inv.projectName} matures in 7 days (${m.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}).`,
          link: "/invest/dashboard?tab=portfolio",
          relatedRef: `INV-${inv.id}`,
          emailDetails: [
            { label: "Project", value: inv.projectName },
            { label: "Amount Invested", value: fmtMoney(inv.amount) },
            { label: "Maturity Date", value: m.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" }) },
          ],
        });
      }
    }
  }

  // ── 2. Mortgage payment reminders ──
  const activeMortgages = await db
    .select()
    .from(mortgages)
    .where(and(eq(mortgages.status, "active"), sql`${mortgages.nextPaymentAt} IS NOT NULL`));
  for (const mg of activeMortgages) {
    if (!mg.nextPaymentAt) continue;
    const due = new Date(mg.nextPaymentAt);
    const dueStr = due.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });
    if (due > now && due <= in3d) {
      if (await claim(`mortgage_due:${mg.id}:${due.toISOString().slice(0, 10)}`, mg.investorId)) {
        await notifyUser(mg.investorId, {
          type: "mortgage_payment_reminder",
          category: "mortgages",
          title: "Mortgage Payment Due Soon",
          message: `Your ${mg.paymentFrequency} mortgage payment of ${fmtMoney(mg.installmentAmount)} for ${mg.propertyName} is due on ${dueStr}.`,
          severity: "warning",
          link: "/invest/dashboard?tab=mortgages",
          relatedRef: mg.reference,
          emailDetails: [
            { label: "Property", value: mg.propertyName },
            { label: "Amount Due", value: fmtMoney(mg.installmentAmount) },
            { label: "Due Date", value: dueStr },
            { label: "Remaining Balance", value: fmtMoney(mg.remainingBalance) },
          ],
        });
      }
    } else if (due <= now) {
      if (await claim(`mortgage_overdue:${mg.id}:${weekKey(now)}`, mg.investorId)) {
        await notifyUser(mg.investorId, {
          type: "mortgage_payment_overdue",
          category: "mortgages",
          title: "Mortgage Payment Overdue",
          message: `Your mortgage payment of ${fmtMoney(mg.installmentAmount)} for ${mg.propertyName} was due on ${dueStr} and is now overdue. Please fund your wallet and make the payment to keep your plan in good standing.`,
          severity: "error",
          link: "/invest/dashboard?tab=mortgages",
          relatedRef: mg.reference,
          emailDetails: [
            { label: "Property", value: mg.propertyName },
            { label: "Amount Overdue", value: fmtMoney(mg.installmentAmount) },
            { label: "Was Due", value: dueStr },
          ],
        });
      }
    }
  }

  // ── 3. KYC reminders (weekly, accounts older than 3 days) ──
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400_000);
  const unverified = await db
    .select()
    .from(investors)
    .where(
      and(
        eq(investors.status, "active"),
        inArray(investors.kycStatus, ["unverified", "rejected"]),
        lte(investors.createdAt, threeDaysAgo),
      ),
    )
    .then((rows) => rows.slice(0, 50));
  for (const inv of unverified) {
    if (await claim(`kyc:${inv.id}:${weekKey(now)}`, inv.id)) {
      await notifyUser(inv.id, {
        type: "kyc_reminder",
        category: "account_security",
        title: "Complete Your Verification",
        message: "Your identity verification is still incomplete. Verify your account to unlock higher deposit limits, withdrawals and exclusive investment tiers.",
        link: "/invest/dashboard?tab=verification",
        emailIntro: "Your identity verification is still incomplete. It only takes a few minutes and unlocks higher deposit limits, withdrawals and exclusive investment tiers.",
      });
    }
  }

  // ── 4. Incomplete profile (once, accounts older than 2 days) ──
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400_000);
  const incomplete = await db
    .select()
    .from(investors)
    .where(
      and(
        eq(investors.status, "active"),
        lte(investors.createdAt, twoDaysAgo),
        or(isNull(investors.phone), isNull(investors.country)),
      ),
    )
    .then((rows) => rows.slice(0, 50));
  for (const inv of incomplete) {
    if (await claim(`profile:${inv.id}`, inv.id)) {
      await notifyUser(inv.id, {
        type: "profile_reminder",
        category: "system",
        title: "Complete Your Profile",
        message: "Your profile is missing a few details (phone number and/or country). A complete profile helps our team reach you quickly about your investments.",
        link: "/invest/dashboard?tab=settings",
        email: false,
      });
    }
  }

  // ── 5. Dormant accounts (30+ days, monthly nudge) ──
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000);
  const dormant = await db
    .select()
    .from(investors)
    .where(and(eq(investors.status, "active"), lte(investors.lastSignInAt, thirtyDaysAgo)))
    .then((rows) => rows.slice(0, 50));
  for (const inv of dormant) {
    if (await claim(`dormant:${inv.id}:${monthKey(now)}`, inv.id)) {
      await notifyUser(inv.id, {
        type: "dormant_account",
        category: "system",
        title: "We Miss You",
        message: `It's been a while since your last visit. Your wallet balance is ${fmtMoney(inv.walletBalance)} and your investments keep working for you — sign in to review your portfolio.`,
        link: "/invest/dashboard",
        emailDetails: [
          { label: "Wallet Balance", value: fmtMoney(inv.walletBalance) },
          { label: "Total Earnings", value: fmtMoney(inv.totalEarnings) },
        ],
      });
    }
  }

  // ── 6. Weekly portfolio summaries (Mondays, opt-in) ──
  if (now.getDay() === 1 && now.getHours() < 1) {
    const opted = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.weeklySummary, "yes"));
    for (const pref of opted.slice(0, 200)) {
      if (!(await claim(`weekly:${pref.investorId}:${weekKey(now)}`, pref.investorId))) continue;
      const inv = await db.select().from(investors).where(eq(investors.id, pref.investorId)).limit(1);
      const investor = inv.at(0);
      if (!investor || investor.status !== "active") continue;
      const active = await db
        .select({ count: sql<number>`COUNT(*)`, total: sql<string>`COALESCE(SUM(${investments.amount}),0)`, value: sql<string>`COALESCE(SUM(${investments.currentValue}),0)` })
        .from(investments)
        .where(and(eq(investments.investorId, investor.id), eq(investments.status, "active")));
      await notifyUser(investor.id, {
        type: "weekly_portfolio_summary",
        category: "investments",
        title: "Your Weekly Portfolio Summary",
        message: `You have ${Number(active[0]?.count ?? 0)} active investment(s) worth ${fmtMoney(active[0]?.value ?? "0")}. Wallet balance: ${fmtMoney(investor.walletBalance)}. Total earnings: ${fmtMoney(investor.totalEarnings)}.`,
        link: "/invest/dashboard?tab=portfolio",
        emailDetails: [
          { label: "Active Investments", value: String(Number(active[0]?.count ?? 0)) },
          { label: "Portfolio Value", value: fmtMoney(active[0]?.value ?? "0") },
          { label: "Wallet Balance", value: fmtMoney(investor.walletBalance) },
          { label: "Total Earnings", value: fmtMoney(investor.totalEarnings) },
        ],
      });
    }
  }

  // ── 7. Monthly account statements (1st of month, opt-in) ──
  if (now.getDate() === 1 && now.getHours() < 1) {
    const opted = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.monthlyStatement, "yes"));
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    for (const pref of opted.slice(0, 200)) {
      if (!(await claim(`monthly:${pref.investorId}:${monthKey(lastMonth)}`, pref.investorId))) continue;
      const inv = await db.select().from(investors).where(eq(investors.id, pref.investorId)).limit(1);
      const investor = inv.at(0);
      if (!investor || investor.status !== "active") continue;
      const [dep] = await db
        .select({ total: sql<string>`COALESCE(SUM(${deposits.amount}),0)` })
        .from(deposits)
        .where(and(eq(deposits.investorId, investor.id), eq(deposits.status, "approved"), gte(deposits.createdAt, lastMonth), lte(deposits.createdAt, lastMonthEnd)));
      const [wd] = await db
        .select({ total: sql<string>`COALESCE(SUM(${withdrawals.amount}),0)` })
        .from(withdrawals)
        .where(and(eq(withdrawals.investorId, investor.id), eq(withdrawals.status, "paid"), gte(withdrawals.createdAt, lastMonth), lte(withdrawals.createdAt, lastMonthEnd)));
      const [profit] = await db
        .select({ total: sql<string>`COALESCE(SUM(${profitPayments.amount}),0)` })
        .from(profitPayments)
        .where(and(eq(profitPayments.investorId, investor.id), eq(profitPayments.status, "paid"), gte(profitPayments.paidAt, lastMonth), lte(profitPayments.paidAt, lastMonthEnd)));
      const monthName = lastMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      // File a copy of the statement in the user's Document Center (deduped by reference)
      await generatePdfDocument({
        investorId: investor.id,
        ownerEmail: investor.email,
        ownerName: investor.name,
        category: "financial",
        docType: "Account Statement",
        name: `Account Statement — ${monthName}`,
        reference: `STMT-${investor.id}-${monthKey(lastMonth)}`,
        lines: [
          { label: "Statement Month", value: monthName },
          { label: "Deposits Approved", value: fmtMoney(dep?.total ?? "0") },
          { label: "Profits Credited", value: fmtMoney(profit?.total ?? "0") },
          { label: "Withdrawals Paid", value: fmtMoney(wd?.total ?? "0") },
          { label: "Closing Wallet Balance", value: fmtMoney(investor.walletBalance) },
          { label: "Total Earnings to Date", value: fmtMoney(investor.totalEarnings) },
        ],
        note: "This statement summarizes your Nestaro Homes account activity for the period shown.",
        notify: false, // the notification below covers it
      });
      await notifyUser(investor.id, {
        type: "monthly_account_statement",
        category: "wallet_payments",
        title: `Your ${monthName} Account Statement`,
        message: `Statement for ${monthName} — deposits: ${fmtMoney(dep?.total ?? "0")}, profits credited: ${fmtMoney(profit?.total ?? "0")}, withdrawals: ${fmtMoney(wd?.total ?? "0")}. Closing wallet balance: ${fmtMoney(investor.walletBalance)}.`,
        link: "/invest/dashboard?tab=transactions",
        emailDetails: [
          { label: "Statement Month", value: monthName },
          { label: "Deposits Approved", value: fmtMoney(dep?.total ?? "0") },
          { label: "Profits Credited", value: fmtMoney(profit?.total ?? "0") },
          { label: "Withdrawals Paid", value: fmtMoney(wd?.total ?? "0") },
          { label: "Closing Balance", value: fmtMoney(investor.walletBalance) },
        ],
      });
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startNotificationScheduler() {
  if (timer) return;
  const tick = () => {
    sweep().catch((err) => console.error("notification sweep failed:", err));
  };
  setTimeout(tick, 90 * 1000).unref?.(); // first sweep 90s after boot
  timer = setInterval(tick, 60 * 60 * 1000); // hourly
  timer.unref?.();
  console.log("Notification scheduler started (hourly).");
}
