// ── Centralized Notification System ─────────────────────────────
// Shared between server and client. Extend — never duplicate.

export const NOTIFICATION_CATEGORIES = [
  { key: "account_security", label: "Account & Security", color: "#dc2626", bg: "#fee2e2" },
  { key: "wallet_payments", label: "Wallet & Payments", color: "#047857", bg: "#d1fae5" },
  { key: "property", label: "Property", color: "#1e3a5f", bg: "#dbeafe" },
  { key: "investments", label: "Investments", color: "#7c3aed", bg: "#ede9fe" },
  { key: "mortgages", label: "Mortgages", color: "#b45309", bg: "#fef3c7" },
  { key: "meetings", label: "Meetings", color: "#0e7490", bg: "#cffafe" },
  { key: "documents", label: "Documents", color: "#4d7c0f", bg: "#ecfccb" },
  { key: "referrals", label: "Referrals", color: "#be185d", bg: "#fce7f3" },
  { key: "messages", label: "Messages", color: "#4338ca", bg: "#e0e7ff" },
  { key: "marketing", label: "News & Offers", color: "#c8956c", bg: "#faf3eb" },
  { key: "system", label: "System", color: "#475569", bg: "#f1f5f9" },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["key"];

export function notificationCategoryMeta(key: string) {
  return (
    NOTIFICATION_CATEGORIES.find((c) => c.key === key) ??
    NOTIFICATION_CATEGORIES[NOTIFICATION_CATEGORIES.length - 1]
  );
}

/** Categories the user can toggle email for. Security is always on. */
export const CATEGORY_PREF_FIELD: Partial<Record<NotificationCategory, string>> = {
  property: "propertyUpdates",
  investments: "investmentUpdates",
  meetings: "meetingReminders",
  mortgages: "mortgageUpdates",
  documents: "documentUpdates",
  wallet_payments: "walletUpdates",
  referrals: "referralUpdates",
  marketing: "marketingEmails",
};

// ── User preference toggles (drives the preferences UI) ─────────
export const NOTIFICATION_PREFERENCES = [
  { key: "emailNotifications", label: "Email Notifications", description: "Receive important notifications by email", locked: false },
  { key: "inAppNotifications", label: "In-App Notifications", description: "Show notifications in your dashboard Notification Center", locked: false },
  { key: "securityAlerts", label: "Security Alerts", description: "Login alerts, password changes and account security — always on for your protection", locked: true },
  { key: "walletUpdates", label: "Wallet & Payment Alerts", description: "Deposits, withdrawals and wallet activity", locked: false },
  { key: "investmentUpdates", label: "Investment Updates", description: "Investment status, ROI credits and maturity alerts", locked: false },
  { key: "propertyUpdates", label: "Property Updates", description: "Purchases, handovers and property news", locked: false },
  { key: "mortgageUpdates", label: "Mortgage Updates", description: "Application decisions and payment reminders", locked: false },
  { key: "meetingReminders", label: "Meeting Reminders", description: "Appointment confirmations and reminders", locked: false },
  { key: "documentUpdates", label: "Document Updates", description: "Uploads, approvals and document requests", locked: false },
  { key: "referralUpdates", label: "Referral Updates", description: "Referral sign-ups and bonus credits", locked: false },
  { key: "marketingEmails", label: "Marketing & Promotions", description: "New opportunities, offers and platform news", locked: false },
  { key: "weeklySummary", label: "Weekly Portfolio Summary", description: "A weekly email summary of your account", locked: false },
  { key: "monthlyStatement", label: "Monthly Account Statement", description: "A monthly email statement of your account", locked: false },
  { key: "smsNotifications", label: "SMS Notifications", description: "Coming soon — SMS alerts for critical events", locked: false, comingSoon: true },
] as const;

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCES)[number]["key"];

// ── Admin broadcasts ────────────────────────────────────────────
export const BROADCAST_KINDS = [
  { key: "announcement", label: "Platform Announcement" },
  { key: "maintenance", label: "Maintenance Notice" },
  { key: "emergency", label: "Emergency Alert" },
  { key: "investment_opportunity", label: "New Investment Opportunity" },
  { key: "property_announcement", label: "New Property Announcement" },
  { key: "feature", label: "Feature Announcement" },
  { key: "policy", label: "Policy Update" },
  { key: "promotional", label: "Promotional / Marketing" },
] as const;

export type BroadcastKind = (typeof BROADCAST_KINDS)[number]["key"];

export function broadcastKindLabel(key: string) {
  return BROADCAST_KINDS.find((k) => k.key === key)?.label ?? key;
}

export const BROADCAST_AUDIENCES = [
  { key: "all", label: "All Users" },
  { key: "investors", label: "Investors (have investments)" },
  { key: "property_buyers", label: "Property Buyers" },
  { key: "mortgage_clients", label: "Mortgage Clients" },
  { key: "verified", label: "Verified Users" },
  { key: "custom", label: "Custom (specific emails)" },
] as const;

export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number]["key"];

export function broadcastAudienceLabel(key: string) {
  return BROADCAST_AUDIENCES.find((a) => a.key === key)?.label ?? key;
}

/** Large-transaction alert threshold (USD). */
export const LARGE_TRANSACTION_THRESHOLD = 5_000_000;

/** Default dashboard links per category (used for email CTAs). */
export const CATEGORY_LINKS: Record<string, string> = {
  account_security: "/invest/dashboard?tab=settings",
  wallet_payments: "/invest/dashboard?tab=transactions",
  property: "/invest/dashboard?tab=purchases",
  investments: "/invest/dashboard?tab=portfolio",
  mortgages: "/invest/dashboard?tab=mortgages",
  meetings: "/invest/dashboard?tab=appointments",
  documents: "/invest/dashboard?tab=documents",
  referrals: "/invest/dashboard?tab=referrals",
  messages: "/invest/dashboard?tab=messages",
  marketing: "/invest",
  system: "/invest/dashboard",
};

// ── Interactive notifications: CTA labels + deep links ──────────
// Maps notification types to their action button label and the
// authenticated dashboard destination. Used by both the in-app
// Notification Center and the email action button.
export const NOTIFICATION_CTA: Record<string, { label: string; link: string }> = {
  welcome: { label: "Open Dashboard", link: "/invest/dashboard" },
  login: { label: "Review Activity", link: "/invest/dashboard?tab=settings" },
  new_device_login: { label: "Secure My Account", link: "/invest/dashboard?tab=settings" },
  failed_login_attempts: { label: "Secure My Account", link: "/invest/dashboard?tab=settings" },
  password_changed: { label: "Security Settings", link: "/invest/dashboard?tab=settings" },
  password_reset_completed: { label: "Security Settings", link: "/invest/dashboard?tab=settings" },
  profile_updated: { label: "View Profile", link: "/invest/dashboard?tab=settings" },
  profile_reminder: { label: "Complete Profile", link: "/invest/dashboard?tab=settings" },
  account_verified: { label: "View Verification", link: "/invest/dashboard?tab=verification" },
  kyc_reminder: { label: "Complete Verification", link: "/invest/dashboard?tab=verification" },
  account_suspended: { label: "Contact Support", link: "/invest/dashboard?tab=messages" },
  account_reactivated: { label: "Open Dashboard", link: "/invest/dashboard" },
  deposit_submitted: { label: "View Transaction", link: "/invest/dashboard?tab=transactions" },
  deposit_approved: { label: "View Transaction", link: "/invest/dashboard?tab=transactions" },
  deposit_rejected: { label: "View Transaction", link: "/invest/dashboard?tab=transactions" },
  withdrawal_requested: { label: "View Transaction", link: "/invest/dashboard?tab=transactions" },
  withdrawal_approved: { label: "View Transaction", link: "/invest/dashboard?tab=transactions" },
  withdrawal_paid: { label: "View Transaction", link: "/invest/dashboard?tab=transactions" },
  withdrawal_rejected: { label: "View Transaction", link: "/invest/dashboard?tab=transactions" },
  large_transaction: { label: "Review Transaction", link: "/invest/dashboard?tab=transactions" },
  monthly_account_statement: { label: "View Statement", link: "/invest/dashboard?tab=transactions" },
  investment_created: { label: "View Investment", link: "/invest/dashboard?tab=portfolio" },
  roi_paid: { label: "View Earnings", link: "/invest/dashboard?tab=profits" },
  investment_completed: { label: "View Investment", link: "/invest/dashboard?tab=portfolio" },
  investment_matured: { label: "View Investment", link: "/invest/dashboard?tab=portfolio" },
  investment_maturity_reminder: { label: "View Investment", link: "/invest/dashboard?tab=portfolio" },
  weekly_portfolio_summary: { label: "View Portfolio", link: "/invest/dashboard?tab=portfolio" },
  broadcast_investment_opportunity: { label: "View Opportunity", link: "/invest" },
  mortgage_approved: { label: "View Mortgage", link: "/invest/dashboard?tab=mortgages" },
  mortgage_rejected: { label: "View Mortgage", link: "/invest/dashboard?tab=mortgages" },
  mortgage_payment_reminder: { label: "Make Payment", link: "/invest/dashboard?tab=mortgages" },
  mortgage_payment_overdue: { label: "Make Payment", link: "/invest/dashboard?tab=mortgages" },
  mortgage_payment_received: { label: "View Mortgage", link: "/invest/dashboard?tab=mortgages" },
  mortgage_completed: { label: "View Mortgage", link: "/invest/dashboard?tab=mortgages" },
  property_handover_completed: { label: "View Purchase", link: "/invest/dashboard?tab=purchases" },
  broadcast_property_announcement: { label: "View Property", link: "/#properties" },
  document_uploaded: { label: "View Document", link: "/invest/dashboard?tab=documents" },
  document_generated: { label: "View Document", link: "/invest/dashboard?tab=documents" },
  referral_registered: { label: "View Referrals", link: "/invest/dashboard?tab=referrals" },
  referral_bonus_earned: { label: "View Earnings", link: "/invest/dashboard?tab=referrals" },
  support_update: { label: "View Conversation", link: "/invest/dashboard?tab=messages" },
  appointment_update: { label: "View Appointment", link: "/invest/dashboard?tab=appointments" },
  dormant_account: { label: "Open Dashboard", link: "/invest/dashboard" },
};

/** CTA metadata for a notification type, with category-level fallback. */
export function ctaForNotification(type: string | null | undefined, category: string): { label: string; link: string } {
  if (type && NOTIFICATION_CTA[type]) return NOTIFICATION_CTA[type];
  return { label: "View Details", link: CATEGORY_LINKS[category] ?? "/invest/dashboard" };
}
