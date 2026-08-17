import { eq, and, gte, sql } from "drizzle-orm";
import { fmtMoney } from "./format";
import { TRPCError } from "@trpc/server";
import {
  investors,
  investmentTransactions,
  investorNotifications,
} from "@db/schema";
import type { getDb } from "../queries/connection";

/**
 * Centralized wallet accounting engine.
 *
 * EVERY balance-changing operation on the platform goes through
 * creditWallet / debitWallet so that:
 *  - balances are updated atomically (no read-modify-write races)
 *  - insufficient funds / frozen wallets can never be overdrawn
 *  - every movement writes a ledger row in investmentTransactions
 *  - every movement notifies the investor
 *
 * Callers MUST run inside db.transaction(...) so a failure anywhere
 * rolls back the entire operation — no partial updates, ever.
 */

type Db = ReturnType<typeof getDb>;

/** Minimal structural type satisfied by both the pool and a transaction handle. */
export type DbOrTx = {
  update: Db["update"];
  insert: Db["insert"];
  select: Db["select"];
};

export type WalletTxType =
  | "deposit"
  | "withdrawal"
  | "investment"
  | "earning"
  | "referral_bonus"
  | "adjustment"
  | "refund"
  | "mortgage_payment";

export interface WalletOp {
  investorId: number;
  /** Positive amount in Naira. */
  amount: number;
  type: WalletTxType;
  description: string;
  reference: string;
  /** Aggregate counters to bump alongside the balance. */
  counters?: {
    totalDeposited?: boolean;
    totalWithdrawn?: boolean;
    totalEarnings?: boolean;
    referralEarnings?: boolean;
  };
  /** Investor notification (omit for silent adjustments). */
  notification?: {
    title: string;
    message: string;
    kind?: "info" | "success" | "warning" | "error";
  } | null;
  /**
   * Skip inserting a ledger row — use when the caller updates an existing
   * pending ledger row instead (deposit/withdrawal approval flows), so the
   * movement is never recorded twice.
   */
  skipLedger?: boolean;
  /** Admin-only: allow debiting a frozen wallet (reversals, admin debits). */
  skipFrozenCheck?: boolean;
}

function affectedRows(result: unknown): number {
  // drizzle mysql2 returns [ResultSetHeader, FieldPacket[]]
  const head = Array.isArray(result) ? result[0] : result;
  return Number((head as { affectedRows?: number })?.affectedRows ?? 0);
}

async function recordLedger(
  db: DbOrTx,
  op: WalletOp,
  direction: "credit" | "debit",
) {
  if (!op.skipLedger) {
    await db.insert(investmentTransactions).values({
      investorId: op.investorId,
      type: op.type,
      direction,
      amount: op.amount.toFixed(2),
      description: op.description,
      reference: op.reference,
      status: "completed",
    });
  }

  if (op.notification) {
    await db.insert(investorNotifications).values({
      investorId: op.investorId,
      title: op.notification.title,
      message: op.notification.message,
      type: op.notification.kind ?? "info",
    });
  }
}

/** Increment an aggregate counter without touching the wallet balance. */
export async function bumpCounter(
  db: DbOrTx,
  investorId: number,
  counter: "totalDeposited" | "totalWithdrawn" | "totalEarnings" | "referralEarnings",
  amount: number,
): Promise<void> {
  const amt = amount.toFixed(2);
  const res = await db
    .update(investors)
    .set({ [counter]: sql`${sql.raw(counter)} + ${amt}` })
    .where(eq(investors.id, investorId));
  requireAffected(res, `Investor #${investorId} not found`);
}

/** Credit funds to an investor wallet. Works on frozen wallets (admin fixes). */
export async function creditWallet(db: DbOrTx, op: WalletOp): Promise<void> {
  if (!(op.amount > 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "Amount must be positive" });

  const amt = op.amount.toFixed(2);
  const set: Record<string, unknown> = { walletBalance: sql`walletBalance + ${amt}` };
  if (op.counters?.totalEarnings) set.totalEarnings = sql`totalEarnings + ${amt}`;
  if (op.counters?.totalDeposited) set.totalDeposited = sql`totalDeposited + ${amt}`;
  if (op.counters?.totalWithdrawn) set.totalWithdrawn = sql`totalWithdrawn + ${amt}`;
  if (op.counters?.referralEarnings) set.referralEarnings = sql`referralEarnings + ${amt}`;

  const res = await db.update(investors).set(set).where(eq(investors.id, op.investorId));
  if (affectedRows(res) !== 1) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Investor #${op.investorId} not found` });
  }

  await recordLedger(db, op, "credit");
}

/**
 * Debit funds from an investor wallet — atomically guarded.
 * The UPDATE only succeeds when the wallet has sufficient funds AND is not
 * frozen, so double-spends and overdrafts are impossible even under
 * concurrent requests.
 */
export async function debitWallet(db: DbOrTx, op: WalletOp): Promise<void> {
  if (!(op.amount > 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "Amount must be positive" });

  const amt = op.amount.toFixed(2);
  const set: Record<string, unknown> = { walletBalance: sql`walletBalance - ${amt}` };
  if (op.counters?.totalEarnings) set.totalEarnings = sql`totalEarnings - ${amt}`;
  if (op.counters?.totalDeposited) set.totalDeposited = sql`totalDeposited - ${amt}`;
  if (op.counters?.totalWithdrawn) set.totalWithdrawn = sql`totalWithdrawn + ${amt}`;
  if (op.counters?.referralEarnings) set.referralEarnings = sql`referralEarnings - ${amt}`;

  const conditions = [
    eq(investors.id, op.investorId),
    gte(investors.walletBalance, amt),
  ];
  if (!op.skipFrozenCheck) {
    conditions.push(eq(investors.walletFrozen, "no"));
  }

  const res = await db
    .update(investors)
    .set(set)
    .where(and(...conditions));

  if (affectedRows(res) !== 1) {
    // Figure out WHY it failed for a clear error message
    const rows = await db.select().from(investors).where(eq(investors.id, op.investorId)).limit(1);
    const investor = rows.at(0);
    if (!investor) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Investor #${op.investorId} not found` });
    }
    if (investor.walletFrozen === "yes" && !op.skipFrozenCheck) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your wallet is currently frozen. Please contact support.",
      });
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Insufficient wallet balance. Available: ${fmtMoney(Number(investor.walletBalance))}`,
    });
  }

  await recordLedger(db, op, "debit");
}

/**
 * Assert that a conditional UPDATE actually changed a row.
 * Use after guarded status transitions like
 *   UPDATE deposits SET status='approved' WHERE id=? AND status='pending'
 * If 0 rows changed, another request already processed it — throwing here
 * aborts the surrounding transaction so nothing is credited twice.
 */
export function requireAffected(result: unknown, message: string): void {
  if (affectedRows(result) !== 1) {
    throw new TRPCError({ code: "CONFLICT", message });
  }
}
