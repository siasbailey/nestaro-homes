// ── Investor Verification (KYC Tier System) — shared API + frontend ──

export const KYC_TIERS = [
  {
    key: "tier1",
    label: "Tier 1 – Basic",
    shortLabel: "Basic",
    color: "red",
    maxDeposit: 500_000,
    maxInvestment: 500_000,
    requirements: ["Account Registration", "Email Verification", "Phone Number Verification"],
  },
  {
    key: "tier2",
    label: "Tier 2 – Verified",
    shortLabel: "Verified",
    color: "amber",
    maxDeposit: 10_000_000,
    maxInvestment: 10_000_000,
    requirements: ["Government-issued ID", "Selfie holding your ID", "Proof of Address (last 3 months)"],
  },
  {
    key: "tier3",
    label: "Tier 3 – Premium Verified",
    shortLabel: "Premium",
    color: "green",
    maxDeposit: 500_000_000,
    maxInvestment: 500_000_000,
    requirements: ["Approved Tier 2 verification", "Enhanced KYC review", "Source of Funds declaration", "Primary Admin approval"],
  },
] as const;

export type KycTierKey = (typeof KYC_TIERS)[number]["key"];

export const KYC_TIER_KEYS = KYC_TIERS.map((t) => t.key) as KycTierKey[];

export const KYC_REQUEST_STATUSES = [
  { key: "not_started", label: "Not Started" },
  { key: "pending", label: "Pending Review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "more_info", label: "More Information Required" },
  { key: "suspended", label: "Suspended" },
] as const;

export type KycRequestStatus = (typeof KYC_REQUEST_STATUSES)[number]["key"];

export const KYC_DOC_TYPES = [
  { key: "government_id", label: "Government-issued ID", hint: "National ID, International Passport, Driver's License, or Voter's Card" },
  { key: "selfie_with_id", label: "Selfie holding your ID", hint: "A clear photo of you holding the same ID next to your face" },
  { key: "proof_of_address", label: "Proof of Address", hint: "Utility bill or bank statement issued within the last 3 months" },
  { key: "additional", label: "Additional Document", hint: "Any extra document requested by the review team" },
] as const;

export type KycDocType = (typeof KYC_DOC_TYPES)[number]["key"];

/** Documents required when requesting each tier. */
export const KYC_REQUIRED_DOCS: Record<string, KycDocType[]> = {
  tier2: ["government_id", "selfie_with_id", "proof_of_address"],
  tier3: [],
};

export function kycTier(key: string) {
  return KYC_TIERS.find((t) => t.key === key) ?? KYC_TIERS[0];
}

export function kycTierLabel(key: string): string {
  return kycTier(key).label;
}

export function kycTierLimits(key: string): { maxDeposit: number; maxInvestment: number } {
  const t = kycTier(key);
  return { maxDeposit: t.maxDeposit, maxInvestment: t.maxInvestment };
}

export function kycStatusLabel(key: string): string {
  return KYC_REQUEST_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export function kycDocTypeLabel(key: string): string {
  return KYC_DOC_TYPES.find((d) => d.key === key)?.label ?? key;
}

/** Next tier an investor can request, or null at the top. */
export function kycNextTier(current: string): "tier2" | "tier3" | null {
  if (current === "tier1") return "tier2";
  if (current === "tier2") return "tier3";
  return null;
}

/** Accepted upload formats + size cap (matches the secure-document rules). */
export const KYC_UPLOAD = {
  accept: ".pdf,.jpg,.jpeg,.png",
  maxBytes: 3 * 1024 * 1024, // 3 MB per file
  dataUrlPattern: /^data:(application\/pdf|image\/(jpeg|jpg|png));base64,/,
  maxBytesBase64: 4_000_000, // base64 inflates ~33%
} as const;
