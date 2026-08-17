/**
 * Server-side US localization helpers — used in notification messages,
 * emails, audit details, and any user-facing strings built on the server.
 * Display-only: stored values are never converted.
 */
const PACIFIC = "America/Los_Angeles";

/** $1,234.56 — US Dollar with thousands grouping. */
export function fmtMoney(value: number | string): string {
  const num = typeof value === "string" ? Number(value) : value;
  return `$${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** DD/MM/YYYY in America/Los_Angeles time. */
export function fmtDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { timeZone: PACIFIC });
}

/** DD/MM/YYYY hh:mm AM/PM in America/Los_Angeles time. */
export function fmtDateTime(date: Date | string): string {
  const d = new Date(date);
  const day = d.toLocaleDateString("en-US", { timeZone: PACIFIC });
  const time = d.toLocaleTimeString("en-US", {
    timeZone: PACIFIC,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} ${time}`;
}
