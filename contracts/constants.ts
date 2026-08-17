export const Session = {
  cookieName: "kimi_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const InvestorSession = {
  cookieName: "fh_investor_sid",
  maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const;

export const ReferralBonus = {
  // Flat $50 credited to the referrer when a referred customer's first
  // deposit is approved.
  amount: 50,
  // Referral earnings become withdrawable only after the referrer has
  // made their own qualifying deposit (lifetime approved deposits).
  qualifyingDeposit: 50,
} as const;

export const DepositRules = {
  // Platform-wide minimum deposit, enforced by the API.
  minAmount: 50,
} as const;

export const LiquidationRules = {
  // Early liquidation penalty, charged as a % of the invested principal
  penaltyPercent: 10,
  // Partial-month profit accrues at 1/30 of the monthly profit per day
  daysPerMonth: 30,
} as const;

export const AdminSession = {
  cookieName: "fh_admin_sid",
  maxAgeMs: 12 * 60 * 60 * 1000, // 12 hours
} as const;

// Permissions assignable to Secondary Administrators.
// Everything NOT listed here (investor management, wallets, deposits,
// withdrawals, ROI, liquidations, financial reports, admin management,
// security settings) is exclusive to the Primary Admin.
export const AdminPermissions = [
  { key: "orders", label: "Property Orders" },
  { key: "tracking", label: "Order Tracking" },
  { key: "products", label: "Product Management" },
  { key: "content", label: "Website Content" },
  { key: "support", label: "Customer Support" },
  { key: "notifications", label: "Notifications" },
  { key: "reports", label: "Reports" },
  { key: "faqs", label: "FAQs" },
  { key: "contact", label: "Contact Messages" },
  { key: "catalog", label: "Catalog Management" },
  { key: "announcements", label: "Announcement Management" },
  { key: "crm", label: "CRM / Lead Management" },
  { key: "appointments", label: "Appointments" },
] as const;

export type AdminPermissionKey = (typeof AdminPermissions)[number]["key"];

// ── Payment Methods ─────────────────────────────────────────────
// User-facing deposit/withdrawal methods for the US market: exactly
// Bank Transfer, Zelle and Cryptocurrency. "opay" (and paypal/card)
// remain in the database enums for historical records only — the API
// rejects them for new transactions.
export const PAYMENT_METHODS = [
  { key: "bank", label: "Bank Transfer" },
  { key: "zelle", label: "Zelle" },
  { key: "crypto", label: "Cryptocurrency" },
] as const;

export type PaymentMethodKey = (typeof PAYMENT_METHODS)[number]["key"];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank: "Bank Transfer",
  zelle: "Zelle",
  crypto: "Cryptocurrency",
  // Legacy values — historical records only, not selectable for new transactions.
  opay: "OPay (legacy)",
  paypal: "PayPal",
  card: "Debit / Credit Card",
};

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
} as const;
