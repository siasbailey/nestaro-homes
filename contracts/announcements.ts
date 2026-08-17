// ── Announcement Bar — shared between API and frontend ──────────────

export const ANNOUNCEMENT_PRIORITIES = [
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "high", label: "High" },
  { key: "urgent", label: "Urgent" },
] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number]["key"];

export const ANNOUNCEMENT_STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "expired", label: "Expired" },
] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number]["key"];

export const ANNOUNCEMENT_DISPLAY_MODES = [
  { key: "single", label: "Single announcement", hint: "Show one selected announcement" },
  { key: "rotate", label: "Rotate in sequence", hint: "Fade between active announcements one at a time" },
  { key: "scroll_all", label: "Continuous scroll", hint: "Scroll all active announcements one after another" },
] as const;
export type AnnouncementDisplayMode = (typeof ANNOUNCEMENT_DISPLAY_MODES)[number]["key"];

export const ANNOUNCEMENT_SPEEDS = [
  { key: "slow", label: "Slow", seconds: 40 },
  { key: "normal", label: "Normal", seconds: 20 },
  { key: "fast", label: "Fast", seconds: 10 },
] as const;
export type AnnouncementSpeed = (typeof ANNOUNCEMENT_SPEEDS)[number]["key"];

export const ANNOUNCEMENT_DIRECTIONS = [
  { key: "rtl", label: "Right to Left" },
  { key: "ltr", label: "Left to Right" },
] as const;
export type AnnouncementDirection = (typeof ANNOUNCEMENT_DIRECTIONS)[number]["key"];

export const ANNOUNCEMENT_VISIBILITY = [
  { key: "homepage", label: "Homepage only" },
  { key: "all", label: "All public pages" },
  { key: "selected", label: "Selected pages" },
] as const;
export type AnnouncementVisibility = (typeof ANNOUNCEMENT_VISIBILITY)[number]["key"];

/** Public pages where the announcement bar is allowed to appear. */
export const ANNOUNCEMENT_PAGES = [
  { path: "/", label: "Homepage" },
  { path: "/about", label: "About" },
  { path: "/faq", label: "FAQ" },
  { path: "/track-order", label: "Track Purchase" },
  { path: "/mortgage", label: "Mortgage" },
  { path: "/invest", label: "Investment Portal Home" },
  { path: "/privacy-policy", label: "Privacy Policy" },
  { path: "/terms-conditions", label: "Terms & Conditions" },
] as const;

/** Approved theme colors for the bar background / text. */
export const ANNOUNCEMENT_THEME_COLORS = [
  { value: "#1e3a5f", label: "Navy" },
  { value: "#2d5a87", label: "Sky Navy" },
  { value: "#c8956c", label: "Copper" },
  { value: "#b07d52", label: "Deep Copper" },
  { value: "#faf8f5", label: "Cream" },
  { value: "#ffffff", label: "White" },
  { value: "#1f2937", label: "Charcoal" },
] as const;
export const ANNOUNCEMENT_COLOR_VALUES = ANNOUNCEMENT_THEME_COLORS.map((c) => c.value) as string[];

export const DEFAULT_ANNOUNCEMENT_SETTINGS = {
  displayMode: "scroll_all" as AnnouncementDisplayMode,
  singleAnnouncementId: null as number | null,
  speed: "normal" as AnnouncementSpeed,
  direction: "rtl" as AnnouncementDirection,
  pauseOnHover: "yes" as "yes" | "no",
  autoRepeat: "yes" as "yes" | "no",
  bgColor: "#1e3a5f",
  textColor: "#ffffff",
  visibility: "homepage" as AnnouncementVisibility,
  selectedPages: ["/"],
};

/** The message shown before the admin publishes anything (matches the old hardcoded bar). */
export const DEFAULT_ANNOUNCEMENT_MESSAGE =
  "The houses on our social media pages might not be on the website. However, we got you covered. Contact our social media admin on WhatsApp, TikTok, or Facebook with pictures or videos of your desired Home.";

/** True when an announcement should be visible to visitors right now. */
export function isAnnouncementLive(
  a: { status: string; startAt: Date | string | null; endAt: Date | string | null },
  now: Date = new Date()
): boolean {
  if (a.status !== "active" && a.status !== "scheduled") return false;
  if (a.startAt && new Date(a.startAt) > now) return false;
  if (a.endAt && new Date(a.endAt) <= now) return false;
  return true;
}

/** What the admin list should show as the announcement's current state. */
export function announcementDisplayStatus(
  a: { status: string; startAt: Date | string | null; endAt: Date | string | null },
  now: Date = new Date()
): AnnouncementStatus {
  if (a.status === "draft") return "draft";
  if (a.endAt && new Date(a.endAt) <= now) return "expired";
  if (a.status === "scheduled" && a.startAt && new Date(a.startAt) > now) return "scheduled";
  if (a.status === "expired") return "expired";
  return "active";
}

export function announcementSpeedSeconds(speed: AnnouncementSpeed): number {
  return ANNOUNCEMENT_SPEEDS.find((s) => s.key === speed)?.seconds ?? 20;
}

export function priorityLabel(key: string): string {
  return ANNOUNCEMENT_PRIORITIES.find((p) => p.key === key)?.label ?? key;
}

export function statusLabel(key: string): string {
  return ANNOUNCEMENT_STATUSES.find((s) => s.key === key)?.label ?? key;
}
