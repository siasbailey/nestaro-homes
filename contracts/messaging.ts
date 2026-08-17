// ── Internal Messaging Center — shared constants ──

export const MESSAGE_CATEGORIES = {
  general_inquiry: { key: "general_inquiry", label: "General Inquiry" },
  property_inquiry: { key: "property_inquiry", label: "Property Inquiry" },
  investment_support: { key: "investment_support", label: "Investment Support" },
  mortgage_support: { key: "mortgage_support", label: "Mortgage Support" },
  payment_support: { key: "payment_support", label: "Payment Support" },
  account_verification: { key: "account_verification", label: "Account Verification" },
  technical_support: { key: "technical_support", label: "Technical Support" },
  complaint: { key: "complaint", label: "Complaint" },
  feedback: { key: "feedback", label: "Feedback" },
  other: { key: "other", label: "Other" },
} as const;

export type MessageCategoryKey = keyof typeof MESSAGE_CATEGORIES;
export const MESSAGE_CATEGORY_OPTIONS = Object.values(MESSAGE_CATEGORIES);

export function messageCategoryLabel(key: string): string {
  return (MESSAGE_CATEGORIES as Record<string, { label: string }>)[key]?.label ?? key;
}

export const CONVERSATION_STATUSES = {
  open: { key: "open", label: "Open", color: "#16a34a" },
  closed: { key: "closed", label: "Closed", color: "#64748b" },
  archived: { key: "archived", label: "Archived", color: "#94a3b8" },
} as const;

export type ConversationStatusKey = keyof typeof CONVERSATION_STATUSES;

export function conversationStatusLabel(key: string): string {
  return (CONVERSATION_STATUSES as Record<string, { label: string }>)[key]?.label ?? key;
}

export const MESSAGE_PRIORITIES = {
  low: { key: "low", label: "Low", color: "#64748b" },
  normal: { key: "normal", label: "Normal", color: "#0ea5e9" },
  high: { key: "high", label: "High", color: "#f59e0b" },
  urgent: { key: "urgent", label: "Urgent", color: "#dc2626" },
} as const;

export type MessagePriorityKey = keyof typeof MESSAGE_PRIORITIES;
export const MESSAGE_PRIORITY_OPTIONS = Object.values(MESSAGE_PRIORITIES);

export function messagePriorityLabel(key: string): string {
  return (MESSAGE_PRIORITIES as Record<string, { label: string }>)[key]?.label ?? key;
}

/** Attachment rules for the messaging center. */
export const MESSAGE_UPLOAD = {
  accept: ".pdf,.jpg,.jpeg,.png,.docx,.xlsx",
  extensions: [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".xlsx"],
  maxBytes: 3 * 1024 * 1024, // 3 MB raw file
  maxBytesBase64: 4_200_000, // data-url ceiling (base64 ≈ 4/3 raw)
  dataUrlPattern: /^data:(application\/pdf|image\/jpeg|image\/png|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet));base64,/,
} as const;

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Admin Activity Timeline — module classification ──
export const ACTIVITY_MODULES = {
  financial: { key: "financial", label: "Financial", color: "#16a34a" },
  users: { key: "users", label: "Users", color: "#0ea5e9" },
  property: { key: "property", label: "Property", color: "#c8956c" },
  investments: { key: "investments", label: "Investments", color: "#1e3a5f" },
  mortgage: { key: "mortgage", label: "Mortgage", color: "#d97706" },
  crm: { key: "crm", label: "CRM", color: "#7c3aed" },
  appointments: { key: "appointments", label: "Appointments", color: "#0891b2" },
  documents: { key: "documents", label: "Documents", color: "#65a30d" },
  messaging: { key: "messaging", label: "Messaging", color: "#db2777" },
  testimonials: { key: "testimonials", label: "Testimonials", color: "#eab308" },
  content: { key: "content", label: "Content", color: "#475569" },
  security: { key: "security", label: "Security", color: "#dc2626" },
  system: { key: "system", label: "System", color: "#64748b" },
} as const;

export type ActivityModuleKey = keyof typeof ACTIVITY_MODULES;
export const ACTIVITY_MODULE_OPTIONS = Object.values(ACTIVITY_MODULES);

/** Map an audit action string to its display module. */
export function activityModuleFor(action: string): ActivityModuleKey {
  const a = action.toLowerCase();
  if (/(deposit|withdrawal|payout|roi|profit|settlement|refund|wallet)/.test(a)) return "financial";
  if (/(kyc|verification|investor_account|user|register|login|password|referral)/.test(a)) return "users";
  if (/(mortgage)/.test(a)) return "mortgage";
  if (/(investment|invest_|liquidat)/.test(a)) return "investments";
  if (/(order|product|property|purchase|handover|checkout)/.test(a)) return "property";
  if (/(crm_|lead|followup|stage)/.test(a)) return "crm";
  if (/(appointment)/.test(a)) return "appointments";
  if (/(document)/.test(a)) return "documents";
  if (/(message|conversation)/.test(a)) return "messaging";
  if (/(testimonial)/.test(a)) return "testimonials";
  if (/(announcement|settings|content|feedback|contact)/.test(a)) return "content";
  if (/(admin|security|suspended|banned|otp|pin|freeze)/.test(a)) return "security";
  return "system";
}

export function activityModuleLabel(key: string): string {
  return (ACTIVITY_MODULES as Record<string, { label: string }>)[key]?.label ?? key;
}

/** Humanize an audit action key, e.g. "approve_deposit" → "Approve Deposit". */
export function activityActionLabel(action: string): string {
  return action
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
