// ── CRM (Lead Management) & Appointment Booking — shared constants ──

export const LEAD_SOURCES = {
  contact_form: { key: "contact_form", label: "Contact Form" },
  property_inquiry: { key: "property_inquiry", label: "Property Inquiry" },
  investment_inquiry: { key: "investment_inquiry", label: "Investment Inquiry" },
  mortgage_inquiry: { key: "mortgage_inquiry", label: "Mortgage Inquiry" },
  appointment_request: { key: "appointment_request", label: "Appointment Request" },
  reservation_request: { key: "reservation_request", label: "Reservation Request" },
  newsletter: { key: "newsletter", label: "Newsletter Subscription" },
  manual: { key: "manual", label: "Manual Entry" },
} as const;

export type LeadSourceKey = keyof typeof LEAD_SOURCES;
export const LEAD_SOURCE_OPTIONS = Object.values(LEAD_SOURCES);

export function leadSourceLabel(key: string): string {
  return (LEAD_SOURCES as Record<string, { label: string }>)[key]?.label ?? key;
}

// ── Pipeline stages ─────────────────────────────────────────────
// Stages are stored in the crmStages table (admin-customizable); these are
// the defaults seeded on migration. `kind` drives terminal-state logic:
// "won" (closed deal) and "lost" stages are terminal.
export type CrmStageKind = "open" | "won" | "lost";

export const DEFAULT_PIPELINE_STAGES: { key: string; label: string; color: string; kind: CrmStageKind }[] = [
  { key: "new", label: "New Lead", color: "#3b82f6", kind: "open" },
  { key: "contacted", label: "Contacted", color: "#06b6d4", kind: "open" },
  { key: "follow_up_scheduled", label: "Follow-up Scheduled", color: "#8b5cf6", kind: "open" },
  { key: "inspection_booked", label: "Property Inspection Booked", color: "#f59e0b", kind: "open" },
  { key: "negotiation", label: "Negotiation", color: "#eab308", kind: "open" },
  { key: "mortgage_processing", label: "Mortgage Processing", color: "#d97706", kind: "open" },
  { key: "investment_processing", label: "Investment Processing", color: "#0ea5e9", kind: "open" },
  { key: "reservation_pending", label: "Reservation Pending", color: "#a855f7", kind: "open" },
  { key: "reservation_confirmed", label: "Reservation Confirmed", color: "#7c3aed", kind: "open" },
  { key: "payment_pending", label: "Payment Pending", color: "#f97316", kind: "open" },
  { key: "property_purchased", label: "Property Purchased", color: "#16a34a", kind: "won" },
  { key: "investment_completed", label: "Investment Completed", color: "#059669", kind: "won" },
  { key: "closed", label: "Closed", color: "#475569", kind: "won" },
  { key: "lost", label: "Lost", color: "#dc2626", kind: "lost" },
];

export const FIRST_STAGE_KEY = DEFAULT_PIPELINE_STAGES[0].key;

// ── Lead activity types (timeline) ──────────────────────────────
export const LEAD_ACTIVITY_TYPES = {
  created: { key: "created", label: "Lead Created" },
  note: { key: "note", label: "Note Added" },
  email: { key: "email", label: "Email Sent" },
  call: { key: "call", label: "Phone Call Logged" },
  whatsapp: { key: "whatsapp", label: "WhatsApp Contacted" },
  meeting: { key: "meeting", label: "Meeting" },
  stage_change: { key: "stage_change", label: "Stage Changed" },
  assignment: { key: "assignment", label: "Lead Assigned" },
  follow_up: { key: "follow_up", label: "Follow-up" },
  appointment: { key: "appointment", label: "Appointment" },
  property_reserved: { key: "property_reserved", label: "Property Reserved" },
  mortgage_applied: { key: "mortgage_applied", label: "Mortgage Applied" },
  investment_started: { key: "investment_started", label: "Investment Started" },
  property_purchased: { key: "property_purchased", label: "Property Purchased" },
  deal_closed: { key: "deal_closed", label: "Deal Closed" },
  registered: { key: "registered", label: "Registered as Customer" },
  system: { key: "system", label: "System Update" },
} as const;

export type LeadActivityTypeKey = keyof typeof LEAD_ACTIVITY_TYPES;

export function leadActivityLabel(key: string): string {
  return (LEAD_ACTIVITY_TYPES as Record<string, { label: string }>)[key]?.label ?? key;
}

// ── Follow-ups ──────────────────────────────────────────────────
export const FOLLOWUP_PRIORITIES = {
  low: { key: "low", label: "Low", color: "#64748b" },
  medium: { key: "medium", label: "Medium", color: "#0ea5e9" },
  high: { key: "high", label: "High", color: "#f59e0b" },
  urgent: { key: "urgent", label: "Urgent", color: "#dc2626" },
} as const;

export type FollowUpPriorityKey = keyof typeof FOLLOWUP_PRIORITIES;
export const FOLLOWUP_PRIORITY_OPTIONS = Object.values(FOLLOWUP_PRIORITIES);

export function followUpPriorityLabel(key: string): string {
  return (FOLLOWUP_PRIORITIES as Record<string, { label: string }>)[key]?.label ?? key;
}

export const FOLLOWUP_SUGGESTIONS = [
  "Call Customer",
  "Send Email",
  "WhatsApp Follow-up",
  "Schedule Meeting",
  "Send Property Brochure",
  "Mortgage Discussion",
  "Investment Consultation",
] as const;

// ── Appointments ────────────────────────────────────────────────
export const APPOINTMENT_TYPES = {
  property_inspection: { key: "property_inspection", label: "Property Inspection", defaultDuration: 60 },
  virtual_tour: { key: "virtual_tour", label: "Virtual Property Tour", defaultDuration: 45 },
  office_meeting: { key: "office_meeting", label: "Office Meeting", defaultDuration: 60 },
  investment_consultation: { key: "investment_consultation", label: "Investment Consultation", defaultDuration: 45 },
  mortgage_consultation: { key: "mortgage_consultation", label: "Mortgage Consultation", defaultDuration: 45 },
} as const;

export type AppointmentTypeKey = keyof typeof APPOINTMENT_TYPES;
export const APPOINTMENT_TYPE_OPTIONS = Object.values(APPOINTMENT_TYPES);

export function appointmentTypeLabel(key: string): string {
  return (APPOINTMENT_TYPES as Record<string, { label: string }>)[key]?.label ?? key;
}

export const APPOINTMENT_STATUSES = {
  pending: { key: "pending", label: "Pending", color: "#d97706" },
  confirmed: { key: "confirmed", label: "Confirmed", color: "#16a34a" },
  rescheduled: { key: "rescheduled", label: "Rescheduled", color: "#7c3aed" },
  completed: { key: "completed", label: "Completed", color: "#0ea5e9" },
  cancelled: { key: "cancelled", label: "Cancelled", color: "#dc2626" },
  no_show: { key: "no_show", label: "No Show", color: "#64748b" },
} as const;

export type AppointmentStatusKey = keyof typeof APPOINTMENT_STATUSES;
export const APPOINTMENT_STATUS_OPTIONS = Object.values(APPOINTMENT_STATUSES);

export function appointmentStatusLabel(key: string): string {
  return (APPOINTMENT_STATUSES as Record<string, { label: string }>)[key]?.label ?? key;
}

export const APPOINTMENT_DURATIONS = [30, 45, 60, 90, 120] as const;

export const BUDGET_RANGES = [
  "Under $25,000",
  "$25,000 – $50,000",
  "$50,000 – $100,000",
  "$100,000 – $250,000",
  "Above $250,000",
] as const;

export const PREFERRED_CONTACT_METHODS = [
  { key: "phone", label: "Phone Call" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
] as const;
