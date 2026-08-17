/**
 * Platform timezone: America/Los_Angeles (Pacific Time).
 * Imported first in boot.ts so every server-side Date operation —
 * scheduled jobs, notification timestamps, audit logs, emails —
 * runs on the company's local time (Portland, Oregon).
 */
process.env.TZ = process.env.TZ || "America/Los_Angeles";
