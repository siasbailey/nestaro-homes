/**
 * Backend-only Resend email test.
 *
 * Run with:  npx tsx scripts/test-email.ts
 *
 * Verifies:
 *   1. RESEND_API_KEY exists (server-side env only — never frontend)
 *   2. Sender identity is valid
 *   3. The Resend connection works and an email can be sent
 *   4. Errors are handled in a controlled way (no crash, no key leakage)
 *
 * Sends a test email to ADMIN_NOTIFICATION_EMAIL (default info@nestarohomes.com).
 * This is a script, NOT a publicly accessible endpoint.
 */
import { sendEmail, buildAdminActionEmail, appBaseUrl, adminNotificationEmail, DEFAULT_FROM_EMAIL } from "../api/lib/email";

async function main() {
  let failures = 0;
  const fail = (msg: string) => { failures++; console.error(`FAIL  ${msg}`); };
  const pass = (msg: string) => console.log(`PASS  ${msg}`);

  // 1. API key present
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    fail("RESEND_API_KEY is not set — add it to your local .env (or Railway Variables in production).");
  } else {
    pass("RESEND_API_KEY exists (server-side only)");
  }

  // 2. Sender valid
  const from = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
  const fromOk = /^NESTARO HOMES <[^@\s]+@[^@\s]+\.[^@\s]+>$/.test(from);
  if (!fromOk) fail(`RESEND_FROM_EMAIL is malformed: "${from}" (expected 'NESTARO HOMES <no-reply@nestarohomes.com>')`);
  else pass(`sender is valid: ${from}`);

  // 3. Controlled failure: no key must never throw or leak internals.
  // (Run BEFORE the real send, while no Resend client has been cached.)
  const savedKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const probe = buildAdminActionEmail({
      eyebrow: "Probe", heading: "Probe", intro: "probe", details: [{ label: "Probe", value: "probe" }],
      ctaLabel: "Probe", ctaUrl: "http://localhost:3000", baseUrl: "http://localhost:3000",
    });
    const controlled = await sendEmail({ to: adminNotificationEmail(), ...probe }).then((r) => r).catch(() => null);
    if (controlled === null) fail("sendEmail threw when the API key was missing (must return a controlled result)");
    else if (controlled.sent) fail("sendEmail reported sent without an API key");
    else pass(`missing-key path returns a controlled result without throwing (reason: ${controlled.reason})`);
  } finally {
    if (savedKey) process.env.RESEND_API_KEY = savedKey;
  }

  // 4. Send a real test email through the production code path
  const to = adminNotificationEmail();
  const baseUrl = appBaseUrl();
  const msg = buildAdminActionEmail({
    eyebrow: "Email System Test",
    heading: "Resend Integration Test",
    intro: "This is an automated test of the NESTARO HOMES email system. If you received this message, Resend delivery is working end to end.",
    details: [
      { label: "Sender", value: from },
      { label: "Recipient", value: to },
      { label: "App URL", value: baseUrl },
      { label: "Date / Time", value: new Date().toLocaleString("en-US") },
      { label: "Status", value: "Test" },
    ],
    ctaLabel: "Open Admin Dashboard",
    ctaUrl: `${baseUrl}/admin/dashboard`,
    baseUrl,
  });

  const result = await sendEmail({ to, ...msg });
  if (result.sent) {
    pass(`test email sent to ${to} via Resend`);
  } else {
    fail(`test email was not sent (reason: ${result.reason})`);
    if (result.reason === "resend-not-configured") {
      console.log("      → set RESEND_API_KEY in .env and re-run.");
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll email checks passed.");
}

main().catch((err) => {
  console.error("Unexpected test failure:", err instanceof Error ? err.message : err);
  process.exit(1);
});
