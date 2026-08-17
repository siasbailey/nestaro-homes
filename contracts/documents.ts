/**
 * Document Center contracts — shared between client and server.
 * Categories, statuses, document types and upload constraints for the
 * investor document vault and auto-generated PDF receipts.
 */

export const DOCUMENT_CATEGORIES = [
  { key: "property", label: "Property Documents" },
  { key: "investment", label: "Investment Documents" },
  { key: "mortgage", label: "Mortgage Documents" },
  { key: "financial", label: "Financial Receipts" },
  { key: "personal", label: "Personal Documents" },
] as const;

export type DocumentCategoryKey = (typeof DOCUMENT_CATEGORIES)[number]["key"];

export const DOCUMENT_STATUSES = [
  { key: "available", label: "Available" },
  { key: "uploaded", label: "Uploaded" },
  { key: "generated", label: "Generated" },
  { key: "pending_upload", label: "Pending Upload" },
  { key: "awaiting_signature", label: "Awaiting Signature" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
] as const;

export type DocumentStatusKey = (typeof DOCUMENT_STATUSES)[number]["key"];

/** Document types available per category (admin upload picker + filter labels). */
export const DOCUMENT_TYPES: Record<DocumentCategoryKey, string[]> = {
  property: [
    "Purchase Agreement",
    "Offer Letter",
    "Allocation Letter",
    "Payment Receipt",
    "Handover Certificate",
    "Deed of Assignment",
    "Certificate of Occupancy",
    "Survey Plan",
    "Other Property Document",
  ],
  investment: [
    "Investment Agreement",
    "Investment Certificate",
    "Investment Confirmation",
    "Investment Closure Certificate",
    "ROI Statement",
    "Investment Summary",
    "Other Investment Document",
  ],
  mortgage: [
    "Mortgage Agreement",
    "Mortgage Approval Letter",
    "Payment Schedule",
    "Mortgage Statement",
    "Mortgage Completion Certificate",
    "Closure Letter",
    "Other Mortgage Document",
  ],
  financial: [
    "Deposit Receipt",
    "Withdrawal Receipt",
    "Purchase Receipt",
    "Mortgage Payment Receipt",
    "Investment Receipt",
    "ROI Payment Statement",
    "Sales Invoice",
    "Reservation Receipt",
    "Other Financial Document",
  ],
  personal: [
    "National ID",
    "International Passport",
    "Driver's License",
    "Proof of Address",
    "Bank Statement",
    "Other Personal Document",
  ],
};

/** Flat list of every valid document type (for server-side validation). */
export const DOCUMENT_TYPE_OPTIONS: { category: DocumentCategoryKey; type: string }[] = (
  Object.entries(DOCUMENT_TYPES) as [DocumentCategoryKey, string[]][]
).flatMap(([category, types]) => types.map((type) => ({ category, type })));

export function documentCategoryLabel(key: string): string {
  return DOCUMENT_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function documentStatusLabel(key: string): string {
  return DOCUMENT_STATUSES.find((s) => s.key === key)?.label ?? key;
}

/** Upload constraints — PDF/JPG/PNG stored as base64 data URLs (longtext column). */
export const DOCUMENT_UPLOAD = {
  accept: ".pdf,.jpg,.jpeg,.png",
  maxMB: 3,
  maxBytes: 3 * 1024 * 1024,
  /** base64 inflates ~4/3 — 3 MB binary ≈ ~4.19M chars */
  maxBytesBase64: 4_200_000,
  dataUrlPattern: /^data:(application\/pdf|image\/(jpeg|jpg|png));base64,/,
} as const;
