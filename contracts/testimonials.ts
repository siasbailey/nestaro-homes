// ── Testimonials — shared constants ──

export const TESTIMONIAL_STATUSES = {
  pending: { key: "pending", label: "Pending Approval", color: "#d97706" },
  approved: { key: "approved", label: "Approved", color: "#16a34a" },
  rejected: { key: "rejected", label: "Rejected", color: "#dc2626" },
  archived: { key: "archived", label: "Archived", color: "#64748b" },
} as const;

export type TestimonialStatusKey = keyof typeof TESTIMONIAL_STATUSES;
export const TESTIMONIAL_STATUS_OPTIONS = Object.values(TESTIMONIAL_STATUSES);

export function testimonialStatusLabel(key: string): string {
  return (TESTIMONIAL_STATUSES as Record<string, { label: string }>)[key]?.label ?? key;
}

/** Profile-photo upload rules for testimonials. */
export const TESTIMONIAL_PHOTO = {
  accept: ".jpg,.jpeg,.png",
  maxBytes: 2 * 1024 * 1024, // 2 MB
  maxBytesBase64: 2_800_000,
  dataUrlPattern: /^data:image\/(jpeg|png);base64,/,
} as const;
