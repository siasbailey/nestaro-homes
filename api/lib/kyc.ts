import { TRPCError } from "@trpc/server";
import type { Investor } from "@db/schema";
import { kycTierLabel, kycTierLimits } from "@contracts/kyc";
import { fmtMoney } from "./format";

/**
 * Hard gate for deposit / investment amounts based on the investor's
 * verification tier. Throws a clean user-facing error when not allowed.
 */
export function assertTierAllows(investor: Investor, kind: "deposit" | "investment", amount: number) {
  if (investor.verificationStatus === "suspended") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account verification is currently suspended. Transactions are disabled — please contact support.",
    });
  }
  const limits = kycTierLimits(investor.verificationTier);
  const cap = kind === "deposit" ? limits.maxDeposit : limits.maxInvestment;
  if (amount > cap) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Your current level (${kycTierLabel(investor.verificationTier)}) allows a maximum ${kind} of ${fmtMoney(cap)} per transaction. Visit the Verification page to upgrade your tier for higher limits.`,
    });
  }
}
