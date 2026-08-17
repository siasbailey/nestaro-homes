import { ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { Link } from "react-router";
import { kycTier, kycTierLimits, kycNextTier } from "@contracts/kyc";
import { useInvestor, formatCurrency } from "@/hooks/use-investor";

const tierStyles: Record<string, string> = {
  tier1: "bg-red-50 text-red-600 border-red-200",
  tier2: "bg-amber-50 text-amber-700 border-amber-200",
  tier3: "bg-green-50 text-green-700 border-green-200",
};

const dotStyles: Record<string, string> = {
  tier1: "bg-red-500",
  tier2: "bg-amber-500",
  tier3: "bg-green-500",
};

/** Color-coded verification badge — Tier 1 red, Tier 2 amber, Tier 3 green. */
export default function VerificationBadge({
  tier,
  status,
  size = "md",
}: {
  tier: string;
  status?: string;
  size?: "sm" | "md";
}) {
  if (status === "suspended") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border font-semibold bg-red-100 text-red-700 border-red-300 ${
          size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
        }`}
      >
        <ShieldAlert className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        Verification Suspended
      </span>
    );
  }

  const t = kycTier(tier);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${tierStyles[t.key]} ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
      title={t.label}
    >
      <span className={`w-2 h-2 rounded-full ${dotStyles[t.key]}`} />
      <ShieldCheck className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {t.label}
      {status === "pending" && (
        <span className="inline-flex items-center gap-1 font-medium opacity-80">
          <Clock className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
          Upgrade Pending
        </span>
      )}
      {status === "more_info" && <span className="font-medium opacity-80">· Info Needed</span>}
    </span>
  );
}

/** Compact strip shown across dashboard tabs — badge + limits + upgrade link. */
export function VerificationBadgeStrip() {
  const { investor } = useInvestor();
  if (!investor?.verificationTier) return null;
  const limits = kycTierLimits(investor.verificationTier);
  const next = kycNextTier(investor.verificationTier);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-white border border-gray-200 px-4 py-3">
      <span className="text-sm text-gray-500">Verification Level:</span>
      <VerificationBadge tier={investor.verificationTier} status={investor.verificationStatus} size="sm" />
      <span className="text-xs text-gray-400">
        Max deposit {formatCurrency(limits.maxDeposit)} · Max investment {formatCurrency(limits.maxInvestment)}
      </span>
      {next && investor.verificationStatus !== "pending" && investor.verificationStatus !== "suspended" && (
        <Link
          to="/invest/dashboard?tab=verification"
          className="ml-auto text-xs font-semibold text-[#c47a45] hover:text-[#a6632f] transition"
        >
          Upgrade Tier →
        </Link>
      )}
    </div>
  );
}
