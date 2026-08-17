/**
 * Real Estate Purchase Progress Tracker — the 9 purchase stages every
 * property order moves through, replacing shipping-style tracking.
 */
export const PURCHASE_STAGES = [
  {
    key: "purchase_request",
    label: "Purchase Request Submitted",
    shortLabel: "Purchase Request",
    next: "Payment Verification",
    description: "We have received your purchase request and our sales team is reviewing it.",
  },
  {
    key: "payment_verification",
    label: "Payment Verification",
    shortLabel: "Payment Verification",
    next: "Purchase Agreement",
    description: "Your payment is being verified and matched to your purchase.",
  },
  {
    key: "purchase_agreement",
    label: "Purchase Agreement Generated",
    shortLabel: "Purchase Agreement",
    next: "Legal Documentation",
    description: "Your purchase agreement has been prepared and issued for signing.",
  },
  {
    key: "legal_documentation",
    label: "Legal Documentation in Progress",
    shortLabel: "Legal Documentation",
    next: "Property Allocation",
    description: "Our legal team is processing the contracts and supporting documents.",
  },
  {
    key: "property_allocation",
    label: "Property Allocation Confirmed",
    shortLabel: "Property Allocation",
    next: "Title Documentation",
    description: "Your specific property unit has been allocated and reserved in your name.",
  },
  {
    key: "title_documentation",
    label: "Title Documentation Processing",
    shortLabel: "Title Documentation",
    next: "Final Inspection",
    description: "Title documents are being processed and prepared for transfer.",
  },
  {
    key: "final_inspection",
    label: "Final Inspection Scheduled",
    shortLabel: "Final Inspection",
    next: "Handover Preparation",
    description: "A final inspection of your property has been scheduled before handover.",
  },
  {
    key: "handover_preparation",
    label: "Handover Preparation",
    shortLabel: "Handover Preparation",
    next: "Property Handover",
    description: "We are preparing your keys, documents, and the official handover.",
  },
  {
    key: "handed_over",
    label: "Property Successfully Handed Over",
    shortLabel: "Handed Over",
    next: null,
    description: "Congratulations — your property has been handed over. Welcome home!",
  },
] as const;

export type PurchaseStageKey = (typeof PURCHASE_STAGES)[number]["key"];

export const PURCHASE_STAGE_KEYS = PURCHASE_STAGES.map((s) => s.key) as [
  PurchaseStageKey,
  ...PurchaseStageKey[],
];

/** 0-based index of a stage key; -1 when not a purchase stage (e.g. cancelled). */
export function purchaseStageIndex(key: string): number {
  return PURCHASE_STAGES.findIndex((s) => s.key === key);
}

export function purchaseStageLabel(key: string): string {
  return PURCHASE_STAGES.find((s) => s.key === key)?.label ?? key.replace(/_/g, " ");
}

/** Label of the estimated next step for the buyer, or null when complete. */
export function purchaseStageNext(key: string): string | null {
  return PURCHASE_STAGES.find((s) => s.key === key)?.next ?? null;
}
