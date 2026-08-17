import { Resend } from "resend";

// ── Brand constants (mirrors the Nestaro Homes site theme) ──────
const Brand = {
  navy: "#26342b",
  navyDark: "#192420",
  navyLight: "#3d5045",
  copper: "#c47a45",
  copperDark: "#a6632f",
  cream: "#f7f4ee",
  wrapper: "#ece6dc",
  text: "#4b5563",
  muted: "#9ca3af",
  serif: "'Playfair Display', Georgia, 'Times New Roman', serif",
  sans: "Arial, Helvetica, sans-serif",
} as const;

export const Company = {
  name: "Nestaro Homes",
  legalName: "Nestaro Homes LLC",
  email: "info@nestarohomes.com",
  phone: "+1 (506) 497-8043",
  hours: "Open 24 hours",
  addressLines: ["Nestaro Homes LLC", "Portland, Oregon 97209, United States"],
} as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Public base URL used to build links inside emails.
 *  Local: http://localhost:3000 · Production: https://www.nestarohomes.com
 *  (set via APP_URL — never hard-coded per environment). */
export function appBaseUrl(reqHeaders?: Headers): string {
  const fromEnv = process.env.APP_URL ?? process.env.SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const origin = reqHeaders?.get("origin") ?? reqHeaders?.get("referer");
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      /* fall through */
    }
  }
  return "http://localhost:3000";
}

/** Automated sender for all transactional mail (verified Resend domain). */
export const DEFAULT_FROM_EMAIL = "NESTARO HOMES <no-reply@nestarohomes.com>";

/** Administrator notification recipient — configurable, never hard-coded at call sites. */
export function adminNotificationEmail(): string {
  return process.env.ADMIN_NOTIFICATION_EMAIL ?? Company.email;
}

// ── Resend transport (server-side only — the API key never leaves the server) ──
let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) {
    // RESEND_BASE_URL is an optional test hook; production uses the default
    // https://api.resend.com endpoint built into the SDK.
    const baseUrl = process.env.RESEND_BASE_URL;
    resendClient = new Resend(apiKey, baseUrl ? { baseUrl } : undefined);
  }
  return resendClient;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const resend = getResend();
    if (!resend) return { sent: false, reason: "resend-not-configured" };
    const from = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
    const { error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      // Log server-side only; never expose provider internals to customers.
      console.error("[email] Resend rejected send:", error.message);
      return { sent: false, reason: "provider-error" };
    }
    return { sent: true };
  } catch (err) {
    // Controlled failure: log, never crash auth/financial workflows.
    console.error("[email] send failed:", err instanceof Error ? err.message : err);
    return { sent: false, reason: "send-failed" };
  }
}

// ── Shared layout ───────────────────────────────────────────────
function layout(opts: {
  title: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  body: string; // inner HTML for the white card
  baseUrl: string;
}): string {
  const year = new Date().getFullYear();
  const contactRow = (label: string, value: string, href?: string) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #efe9e0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="110" style="font-family:${Brand.sans};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${Brand.navy};vertical-align:top;">${label}</td>
                      <td style="font-family:${Brand.sans};font-size:13px;line-height:19px;color:${Brand.text};">
                        ${href ? `<a href="${href}" style="color:${Brand.copperDark};text-decoration:none;">${value}</a>` : value}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(opts.title)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap');
    a { text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .px { padding-left: 24px !important; padding-right: 24px !important; }
      .h1 { font-size: 27px !important; line-height: 35px !important; }
      .btn-td { display: block !important; }
      .btn-link { width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;word-spacing:normal;background-color:${Brand.wrapper};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${Brand.wrapper};">
    <tr>
      <td align="center" style="padding:36px 12px;">
        <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center"><tr><td><![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="container" style="max-width:600px;">

          <!-- Brand header -->
          <tr>
            <td class="px" style="background-color:${Brand.navy};border-radius:16px 16px 0 0;padding:26px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="50" height="50" align="center" valign="middle" style="width:50px;height:50px;background-color:${Brand.copper};border-radius:12px;font-family:${Brand.serif};font-size:21px;font-weight:bold;color:${Brand.navy};">FH</td>
                  <td style="padding-left:14px;">
                    <div style="font-family:${Brand.serif};font-size:22px;font-weight:bold;color:#ffffff;line-height:26px;">Nestaro Homes</div>
                    <div style="font-family:${Brand.sans};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${Brand.copper};line-height:14px;">Real Estate Investment</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td class="px" style="background-color:#ffffff;padding:42px 40px 36px;">
              <div style="font-family:${Brand.sans};font-size:11px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;color:${Brand.copperDark};padding-bottom:12px;">${opts.eyebrow}</div>
              <h1 class="h1" style="margin:0 0 18px;font-family:${Brand.serif};font-size:32px;line-height:40px;font-weight:700;color:${Brand.navy};">${opts.heading}</h1>
              ${opts.body}
            </td>
          </tr>

          <!-- Contact card -->
          <tr>
            <td class="px" style="background-color:${Brand.cream};padding:26px 40px;border-top:1px solid #efe9e0;">
              <div style="font-family:${Brand.serif};font-size:16px;font-weight:700;color:${Brand.navy};padding-bottom:8px;">Questions? We're here to help.</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${contactRow("Email", Company.email, `mailto:${Company.email}`)}
                ${contactRow("Phone", `${Company.phone} &nbsp;<span style="color:${Brand.muted};font-size:11px;">(${Company.hours})</span>`, `tel:${Company.phone.replace(/[^+\d]/g, "")}`)}
                ${contactRow("Office", Company.addressLines.slice(1).join(", "))}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="px" style="background-color:${Brand.navyDark};border-radius:0 0 16px 16px;padding:28px 40px;">
              <div style="font-family:${Brand.serif};font-size:17px;font-weight:700;color:${Brand.copper};padding-bottom:4px;">Nestaro Homes</div>
              <div style="font-family:${Brand.sans};font-size:12px;line-height:18px;color:#b8c4d4;padding-bottom:14px;">Premium tiny homes, designed for modern living across the US &amp; Europe.</div>
              <div style="font-family:${Brand.sans};font-size:12px;line-height:20px;padding-bottom:16px;border-bottom:1px solid #2d4a6b;">
                <a href="${opts.baseUrl}" style="color:#ffffff;text-decoration:underline;">Website</a>
                <span style="color:#4a6584;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                <a href="${opts.baseUrl}/invest" style="color:#ffffff;text-decoration:underline;">Investment Plans</a>
                <span style="color:#4a6584;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                <a href="mailto:${Company.email}" style="color:#ffffff;text-decoration:underline;">Contact Support</a>
              </div>
              <div style="font-family:${Brand.sans};font-size:11px;line-height:17px;color:#8fa3bc;padding-top:12px;">
                ${Company.addressLines.join("<br/>")}<br/><br/>
                &copy; ${year} ${Company.legalName} All rights reserved.<br/>
                You received this email because an investor account was registered with this email address at Nestaro Homes.
              </div>
            </td>
          </tr>

        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Bulletproof CTA button (VML for Outlook, styled anchor elsewhere). */
function ctaButton(url: string, label: string): string {
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px;">
                <tr>
                  <td class="btn-td" align="center">
                    <div><!--[if mso]>
                      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:54px;v-text-anchor:middle;width:320px;" arcsize="15%" strokecolor="${Brand.copperDark}" fillcolor="${Brand.copper}">
                        <w:anchorlock/>
                        <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${label}</center>
                      </v:roundrect>
                    <![endif]--><!--[if !mso]><!-->
                      <a class="btn-link" href="${url}" style="background-color:${Brand.copper};border:1px solid ${Brand.copperDark};border-radius:8px;color:#ffffff;display:inline-block;font-family:${Brand.sans};font-size:16px;font-weight:bold;line-height:54px;text-align:center;text-decoration:none;width:320px;-webkit-text-size-adjust:none;mso-hide:all;">${label}</a>
                    <!--<![endif]--></div>
                  </td>
                </tr>
              </table>`;
}

function fallbackLink(url: string): string {
  return `
              <div style="padding-top:26px;">
                <div style="font-family:${Brand.sans};font-size:12px;line-height:18px;color:${Brand.text};padding-bottom:8px;">Button not working? Copy and paste this link into your browser:</div>
                <div style="background-color:${Brand.cream};border:1px solid #e8e0d4;border-radius:8px;padding:12px 14px;font-family:${Brand.sans};font-size:12px;line-height:18px;color:${Brand.copperDark};word-break:break-all;"><a href="${url}" style="color:${Brand.copperDark};text-decoration:underline;">${url}</a></div>
              </div>`;
}

// ── Public builders ─────────────────────────────────────────────
export function buildVerificationEmail(opts: { name: string; verifyUrl: string; baseUrl: string }): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(opts.name.trim().split(/\s+/)[0] || "Investor");
  const body = `
              <p style="margin:0 0 14px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">Hi ${firstName},</p>
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">
                Welcome aboard — your Nestaro Homes account is ready. Please confirm your email
                address to secure your account and unlock deposits, investments and monthly ROI payouts.
              </p>
              ${ctaButton(opts.verifyUrl, "Verify Email Address")}
              <p style="margin:10px 0 0;font-family:${Brand.sans};font-size:12px;line-height:18px;color:${Brand.muted};">This verification link expires in <strong>24 hours</strong>.</p>
              ${fallbackLink(opts.verifyUrl)}
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  If you didn't create a Nestaro Homes account, you can safely ignore this email —
                  no account will be activated.
                </p>
              </div>`;

  return {
    subject: "Verify your email — Nestaro Homes",
    html: layout({
      title: "Verify your email — Nestaro Homes",
      preheader: "Confirm your email address to activate your Nestaro Homes account.",
      eyebrow: "Welcome to Nestaro Homes",
      heading: "Verify Your Email Address",
      body,
      baseUrl: opts.baseUrl,
    }),
    text: [
      `Hi ${opts.name},`,
      ``,
      `Welcome to Nestaro Homes! Please verify your email address to activate your account:`,
      opts.verifyUrl,
      ``,
      `This link expires in 24 hours. If you didn't create this account, you can ignore this email.`,
      ``,
      `— ${Company.legalName}`,
      `${Company.email} · ${Company.phone}`,
    ].join("\n"),
  };
}

export function buildPasswordResetEmail(opts: { name: string; resetUrl: string; baseUrl: string }): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(opts.name.trim().split(/\s+/)[0] || "Investor");
  const body = `
              <p style="margin:0 0 14px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">Hi ${firstName},</p>
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">
                We received a request to reset the password for your Nestaro Homes account.
                Click the button below to choose a new password.
              </p>
              ${ctaButton(opts.resetUrl, "Reset Password")}
              <p style="margin:10px 0 0;font-family:${Brand.sans};font-size:12px;line-height:18px;color:${Brand.muted};">This reset link expires in <strong>1 hour</strong>.</p>
              ${fallbackLink(opts.resetUrl)}
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  If you didn't request a password reset, you can safely ignore this email —
                  your password will remain unchanged.
                </p>
              </div>`;

  return {
    subject: "Reset your password — Nestaro Homes",
    html: layout({
      title: "Reset your password — Nestaro Homes",
      preheader: "Reset the password for your Nestaro Homes account.",
      eyebrow: "Account Security",
      heading: "Reset Your Password",
      body,
      baseUrl: opts.baseUrl,
    }),
    text: [
      `Hi ${opts.name},`,
      ``,
      `We received a request to reset your Nestaro Homes password:`,
      opts.resetUrl,
      ``,
      `This link expires in 1 hour. If you didn't request this, you can ignore this email.`,
      ``,
      `— ${Company.legalName}`,
    ].join("\n"),
  };
}

// ── High-level helpers used by the auth router ──────────────────
export async function sendVerificationEmail(opts: {
  to: string;
  name: string;
  token: string;
  reqHeaders?: Headers;
}): Promise<boolean> {
  const baseUrl = appBaseUrl(opts.reqHeaders);
  const verifyUrl = `${baseUrl}/invest/verify-email?token=${opts.token}`;
  const message = buildVerificationEmail({ name: opts.name, verifyUrl, baseUrl });
  const result = await sendEmail({ to: opts.to, ...message });
  if (!result.sent) {
    console.log(`[email:dev] verification link for ${opts.to}: ${verifyUrl} (${result.reason})`);
  }
  return result.sent;
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  token: string;
  reqHeaders?: Headers;
}): Promise<boolean> {
  const baseUrl = appBaseUrl(opts.reqHeaders);
  const resetUrl = `${baseUrl}/invest/reset-password?token=${opts.token}`;
  const message = buildPasswordResetEmail({ name: opts.name, resetUrl, baseUrl });
  const result = await sendEmail({ to: opts.to, ...message });
  if (!result.sent) {
    console.log(`[email:dev] password reset link for ${opts.to}: ${resetUrl} (${result.reason})`);
  }
  return result.sent;
}

// ── Admin & account-lifecycle templates ─────────────────────────
export function buildAdminEmailChangeEmail(opts: { name: string; newEmail: string; verifyUrl: string; baseUrl: string }): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(opts.name.trim().split(/\s+/)[0] || "Admin");
  const body = `
              <p style="margin:0 0 14px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">Hi ${firstName},</p>
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">
                You requested to change the email address on your Nestaro Homes administrator account to
                <strong>${escapeHtml(opts.newEmail)}</strong>. Please verify this address to complete the change.
              </p>
              ${ctaButton(opts.verifyUrl, "Verify New Email Address")}
              <p style="margin:10px 0 0;font-family:${Brand.sans};font-size:12px;line-height:18px;color:${Brand.muted};">This verification link expires in <strong>24 hours</strong>.</p>
              ${fallbackLink(opts.verifyUrl)}
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  If you didn't request this change, contact the Primary Administrator immediately.
                </p>
              </div>`;
  return {
    subject: "Verify your new email address — Nestaro Homes Admin",
    html: layout({
      title: "Verify your new email address — Nestaro Homes Admin",
      preheader: "Confirm your new administrator email address.",
      eyebrow: "Administrator Security",
      heading: "Verify Your New Email",
      body,
      baseUrl: opts.baseUrl,
    }),
    text: [
      `Hi ${opts.name},`,
      ``,
      `You requested to change your Nestaro Homes admin email to ${opts.newEmail}. Verify it here:`,
      opts.verifyUrl,
      ``,
      `This link expires in 24 hours.`,
      ``,
      `— ${Company.legalName}`,
    ].join("\n"),
  };
}

export function buildAdminEmailChangeNoticeEmail(opts: { name: string; newEmail: string; baseUrl: string }): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(opts.name.trim().split(/\s+/)[0] || "Admin");
  const body = `
              <p style="margin:0 0 14px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">Hi ${firstName},</p>
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">
                A request was made to change the email address on your Nestaro Homes administrator account to
                <strong>${escapeHtml(opts.newEmail)}</strong>. Your current email remains active until the new
                address is verified.
              </p>
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  If you did not make this request, contact the Primary Administrator immediately —
                  your account may be at risk.
                </p>
              </div>`;
  return {
    subject: "Email change requested on your admin account — Nestaro Homes",
    html: layout({
      title: "Email change requested — Nestaro Homes Admin",
      preheader: "An email change was requested on your administrator account.",
      eyebrow: "Administrator Security",
      heading: "Email Change Requested",
      body,
      baseUrl: opts.baseUrl,
    }),
    text: [
      `Hi ${opts.name},`,
      ``,
      `A request was made to change your Nestaro Homes admin email to ${opts.newEmail}.`,
      `Your current email remains active until the new address is verified.`,
      `If you didn't make this request, contact the Primary Administrator immediately.`,
      ``,
      `— ${Company.legalName}`,
    ].join("\n"),
  };
}

export function buildAdminEmailChangedEmail(opts: { name: string; oldEmail: string; newEmail: string; baseUrl: string }): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(opts.name.trim().split(/\s+/)[0] || "Admin");
  const body = `
              <p style="margin:0 0 14px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">Hi ${firstName},</p>
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">
                The email address on your Nestaro Homes administrator account has been changed successfully.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 4px;border:1px solid #efe9e0;border-radius:10px;">
                <tr>
                  <td style="padding:10px 16px;font-family:${Brand.sans};font-size:12px;color:${Brand.muted};border-bottom:1px solid #efe9e0;">Previous email</td>
                  <td style="padding:10px 16px;font-family:${Brand.sans};font-size:13px;color:${Brand.text};border-bottom:1px solid #efe9e0;" align="right">${escapeHtml(opts.oldEmail)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-family:${Brand.sans};font-size:12px;color:${Brand.muted};">New email</td>
                  <td style="padding:10px 16px;font-family:${Brand.sans};font-size:13px;color:${Brand.text};font-weight:600;" align="right">${escapeHtml(opts.newEmail)}</td>
                </tr>
              </table>
              <p style="margin:10px 0 0;font-family:${Brand.sans};font-size:13px;line-height:20px;color:${Brand.text};">
                The new address is verified and is now your administrator sign-in email.
              </p>
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  If you did not make this change, contact the Primary Administrator immediately.
                </p>
              </div>`;
  return {
    subject: "Your admin email address has been changed — Nestaro Homes",
    html: layout({
      title: "Your admin email address has been changed — Nestaro Homes",
      preheader: "Your Nestaro Homes administrator email was updated.",
      eyebrow: "Administrator Security",
      heading: "Email Address Changed",
      body,
      baseUrl: opts.baseUrl,
    }),
    text: [
      `Hi ${opts.name},`,
      ``,
      `The email address on your Nestaro Homes admin account has been changed.`,
      `Previous email: ${opts.oldEmail}`,
      `New email: ${opts.newEmail}`,
      ``,
      `The new address is verified and is now your sign-in email.`,
      `If you did not make this change, contact the Primary Administrator immediately.`,
      ``,
      `— ${Company.legalName}`,
    ].join("\n"),
  };
}

export function buildInvestorEmailChangeEmail(opts: { name: string; newEmail: string; verifyUrl: string; baseUrl: string }): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(opts.name.trim().split(/\s+/)[0] || "Investor");
  const body = `
              <p style="margin:0 0 14px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">Hi ${firstName},</p>
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">
                You requested to change the email address on your Nestaro Homes account to
                <strong>${escapeHtml(opts.newEmail)}</strong>. Please verify this address to complete the change.
                Your current email remains active until then.
              </p>
              ${ctaButton(opts.verifyUrl, "Verify New Email Address")}
              <p style="margin:10px 0 0;font-family:${Brand.sans};font-size:12px;line-height:18px;color:${Brand.muted};">This verification link expires in <strong>24 hours</strong> and can be used only once.</p>
              ${fallbackLink(opts.verifyUrl)}
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  If you didn't request this change, you can ignore this email — your account email will not change.
                </p>
              </div>`;
  return {
    subject: "Verify your new email address — Nestaro Homes",
    html: layout({
      title: "Verify your new email address — Nestaro Homes",
      preheader: "Confirm your new account email address.",
      eyebrow: "Account Security",
      heading: "Verify Your New Email",
      body,
      baseUrl: opts.baseUrl,
    }),
    text: [
      `Hi ${opts.name},`,
      ``,
      `You requested to change your Nestaro Homes account email to ${opts.newEmail}. Verify it here:`,
      opts.verifyUrl,
      ``,
      `This link expires in 24 hours and can be used only once.`,
      `Your current email remains active until the new address is verified.`,
      ``,
      `— ${Company.legalName}`,
    ].join("\n"),
  };
}

export function buildInvestorEmailChangedEmail(opts: { name: string; oldEmail: string; newEmail: string; baseUrl: string }): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(opts.name.trim().split(/\s+/)[0] || "Investor");
  const body = `
              <p style="margin:0 0 14px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">Hi ${firstName},</p>
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">
                The email address on your Nestaro Homes account has been changed successfully.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 4px;border:1px solid #efe9e0;border-radius:10px;">
                <tr>
                  <td style="padding:10px 16px;font-family:${Brand.sans};font-size:12px;color:${Brand.muted};border-bottom:1px solid #efe9e0;">Previous email</td>
                  <td style="padding:10px 16px;font-family:${Brand.sans};font-size:13px;color:${Brand.text};border-bottom:1px solid #efe9e0;" align="right">${escapeHtml(opts.oldEmail)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-family:${Brand.sans};font-size:12px;color:${Brand.muted};">New email</td>
                  <td style="padding:10px 16px;font-family:${Brand.sans};font-size:13px;color:${Brand.text};font-weight:600;" align="right">${escapeHtml(opts.newEmail)}</td>
                </tr>
              </table>
              <p style="margin:10px 0 0;font-family:${Brand.sans};font-size:13px;line-height:20px;color:${Brand.text};">
                The new address is verified and is now your sign-in email.
              </p>
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  If you did not make this change, contact our support team immediately — your account may be at risk.
                </p>
              </div>`;
  return {
    subject: "Your email address has been changed — Nestaro Homes",
    html: layout({
      title: "Your email address has been changed — Nestaro Homes",
      preheader: "Your Nestaro Homes account email was updated.",
      eyebrow: "Account Security",
      heading: "Email Address Changed",
      body,
      baseUrl: opts.baseUrl,
    }),
    text: [
      `Hi ${opts.name},`,
      ``,
      `The email address on your Nestaro Homes account has been changed.`,
      `Previous email: ${opts.oldEmail}`,
      `New email: ${opts.newEmail}`,
      ``,
      `The new address is verified and is now your sign-in email.`,
      `If you did not make this change, contact support immediately.`,
      ``,
      `— ${Company.legalName}`,
    ].join("\n"),
  };
}

export function buildAdminPasswordChangedEmail(opts: { name: string; baseUrl: string }): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(opts.name.trim().split(/\s+/)[0] || "Admin");
  const body = `
              <p style="margin:0 0 14px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">Hi ${firstName},</p>
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">
                This is a confirmation that the password on your Nestaro Homes administrator account was
                changed successfully. All other sessions have been signed out.
              </p>
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  If you didn't change your password, contact the Primary Administrator immediately.
                </p>
              </div>`;
  return {
    subject: "Your admin password was changed — Nestaro Homes",
    html: layout({
      title: "Password changed — Nestaro Homes Admin",
      preheader: "Your administrator password was changed.",
      eyebrow: "Administrator Security",
      heading: "Password Changed",
      body,
      baseUrl: opts.baseUrl,
    }),
    text: [
      `Hi ${opts.name},`,
      ``,
      `Your Nestaro Homes admin password was changed successfully. All other sessions were signed out.`,
      `If you didn't do this, contact the Primary Administrator immediately.`,
      ``,
      `— ${Company.legalName}`,
    ].join("\n"),
  };
}

export function buildAccountDeletedEmail(opts: { name: string; baseUrl: string }): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(opts.name.trim().split(/\s+/)[0] || "Investor");
  const body = `
              <p style="margin:0 0 14px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">Hi ${firstName},</p>
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">
                This confirms that your Nestaro Homes account has been permanently deleted and your
                personal data has been removed from our systems. We're sorry to see you go.
              </p>
              <p style="margin:14px 0 0;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">
                Thank you for investing with us — you're always welcome back.
              </p>
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  If you didn't request this deletion, contact us immediately at
                  <a href="mailto:${Company.email}" style="color:${Brand.copperDark};text-decoration:underline;">${Company.email}</a>.
                </p>
              </div>`;
  return {
    subject: "Your account has been deleted — Nestaro Homes",
    html: layout({
      title: "Account deleted — Nestaro Homes",
      preheader: "Confirmation that your Nestaro Homes account was deleted.",
      eyebrow: "Account Closure",
      heading: "Account Deleted",
      body,
      baseUrl: opts.baseUrl,
    }),
    text: [
      `Hi ${opts.name},`,
      ``,
      `Your Nestaro Homes account has been permanently deleted. We're sorry to see you go.`,
      `If you didn't request this, contact us at ${Company.email}.`,
      ``,
      `— ${Company.legalName}`,
    ].join("\n"),
  };
}

export async function sendAccountDeletedEmail(opts: { to: string; name: string; reqHeaders?: Headers }): Promise<boolean> {
  const baseUrl = appBaseUrl(opts.reqHeaders);
  const message = buildAccountDeletedEmail({ name: opts.name, baseUrl });
  const result = await sendEmail({ to: opts.to, ...message });
  if (!result.sent) console.log(`[email:dev] account deletion confirmation for ${opts.to} (${result.reason})`);
  return result.sent;
}

// ── Purchase progress notification (property order stage updates) ──
export function buildPurchaseProgressEmail(opts: {
  name: string;
  orderNumber: string;
  stageLabel: string;
  note?: string | null;
  estimatedNext?: string | null;
  trackUrl: string;
  baseUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(opts.name.trim().split(/\s+/)[0] || "there");
  const stage = escapeHtml(opts.stageLabel);
  const body = `
              <p style="margin:0 0 14px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">Hi ${firstName},</p>
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">
                Great news — your property purchase <strong>${escapeHtml(opts.orderNumber)}</strong> has moved to a new stage:
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0;">
                <tr>
                  <td style="background-color:#f7f4ee;border-left:4px solid ${Brand.copper};border-radius:8px;padding:16px 18px;">
                    <p style="margin:0;font-family:${Brand.sans};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${Brand.muted};">Current Stage</p>
                    <p style="margin:4px 0 0;font-family:${Brand.serif};font-size:19px;line-height:26px;font-weight:700;color:${Brand.navy};">${stage}</p>
                    ${opts.note ? `<p style="margin:8px 0 0;font-family:${Brand.sans};font-size:13px;line-height:20px;color:${Brand.text};">${escapeHtml(opts.note)}</p>` : ""}
                    ${opts.estimatedNext ? `<p style="margin:8px 0 0;font-family:${Brand.sans};font-size:12px;line-height:18px;color:${Brand.muted};">Estimated next step: <strong>${escapeHtml(opts.estimatedNext)}</strong></p>` : ""}
                  </td>
                </tr>
              </table>
              ${ctaButton(opts.trackUrl, "Track Your Purchase")}
              ${fallbackLink(opts.trackUrl)}
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  You'll receive an update every time your purchase progresses. If you have any
                  questions, our team is happy to help.
                </p>
              </div>`;

  return {
    subject: `Purchase update: ${opts.stageLabel} — ${Company.name}`,
    html: layout({
      title: `Purchase update: ${opts.stageLabel}`,
      preheader: `Your property purchase moved to: ${opts.stageLabel}.`,
      eyebrow: "Purchase Progress",
      heading: "Your Purchase Is Moving Forward",
      body,
      baseUrl: opts.baseUrl,
    }),
    text: [
      `Hi ${opts.name},`,
      ``,
      `Your property purchase ${opts.orderNumber} has moved to a new stage: ${opts.stageLabel}.`,
      opts.note ? `Note from our team: ${opts.note}` : ``,
      opts.estimatedNext ? `Estimated next step: ${opts.estimatedNext}` : ``,
      ``,
      `Track your purchase: ${opts.trackUrl}`,
      ``,
      `— ${Company.legalName}`,
    ].filter(Boolean).join("\n"),
  };
}

export async function sendPurchaseProgressEmail(opts: {
  to: string;
  name: string;
  orderNumber: string;
  stageLabel: string;
  note?: string | null;
  estimatedNext?: string | null;
  reqHeaders?: Headers;
}): Promise<boolean> {
  const baseUrl = appBaseUrl(opts.reqHeaders);
  const trackUrl = `${baseUrl}/track-order?order=${encodeURIComponent(opts.orderNumber)}&email=${encodeURIComponent(opts.to)}`;
  const message = buildPurchaseProgressEmail({
    name: opts.name,
    orderNumber: opts.orderNumber,
    stageLabel: opts.stageLabel,
    note: opts.note,
    estimatedNext: opts.estimatedNext,
    trackUrl,
    baseUrl,
  });
  const result = await sendEmail({ to: opts.to, ...message });
  if (!result.sent) {
    console.log(`[email:dev] purchase progress (${opts.stageLabel}) for ${opts.to} (${result.reason})`);
  }
  return result.sent;
}

// ── Generic branded event email (centralized notification system) ──
export type EventEmailDetail = { label: string; value: string };

export function buildEventEmail(opts: {
  name: string;
  eyebrow: string;
  heading: string;
  intro: string;
  details?: EventEmailDetail[];
  note?: string | null;
  ctaLabel?: string;
  ctaUrl?: string;
  baseUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(opts.name.trim().split(/\s+/)[0] || "there");
  const detailRows = (opts.details ?? [])
    .filter((d) => d.value)
    .map(
      (d) => `
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f0e9e0;font-family:${Brand.sans};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${Brand.muted};width:42%;vertical-align:top;">${escapeHtml(d.label)}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #f0e9e0;font-family:${Brand.sans};font-size:14px;line-height:20px;color:${Brand.navy};font-weight:600;text-align:right;">${escapeHtml(d.value)}</td>
                </tr>`,
    )
    .join("");

  const body = `
              <p style="margin:0 0 14px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">Hi ${firstName},</p>
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">${escapeHtml(opts.intro)}</p>
              ${
                detailRows
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;background-color:#f7f4ee;border-radius:10px;padding:14px 18px;">
              ${detailRows}
              </table>`
                  : ""
              }
              ${opts.note ? `<p style="margin:14px 0 0;font-family:${Brand.sans};font-size:13px;line-height:20px;color:${Brand.text};background-color:#fdf6ee;border-left:4px solid ${Brand.copper};border-radius:6px;padding:12px 14px;">${escapeHtml(opts.note)}</p>` : ""}
              ${opts.ctaUrl && opts.ctaLabel ? ctaButton(opts.ctaUrl, opts.ctaLabel) : ""}
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  This is an automated notification from your Nestaro Homes account. You can manage
                  your email preferences from your dashboard at any time. Need help? Reply to this email
                  or contact us at ${Company.email}.
                </p>
              </div>`;

  const textLines = [
    `Hi ${firstName},`,
    ``,
    opts.intro,
    ``,
    ...(opts.details ?? []).filter((d) => d.value).map((d) => `${d.label}: ${d.value}`),
    opts.note ? `\nNote: ${opts.note}` : ``,
    opts.ctaUrl ? `\n${opts.ctaLabel ?? "View details"}: ${opts.ctaUrl}` : ``,
    ``,
    `${Company.name} · ${Company.email} · ${Company.phone}`,
  ];

  return {
    subject: `${opts.heading} — ${Company.name}`,
    html: layout({
      title: opts.heading,
      preheader: opts.intro.slice(0, 140),
      eyebrow: opts.eyebrow,
      heading: opts.heading,
      body,
      baseUrl: opts.baseUrl,
    }),
    text: textLines.filter((l) => l !== undefined).join("\n"),
  };
}

// ── Admin action notifications (deposits, withdrawals, …) ───────
// Sent to ADMIN_NOTIFICATION_EMAIL (default info@nestarohomes.com) whenever a
// customer transaction needs staff attention or has been finalized.
export function buildAdminActionEmail(opts: {
  eyebrow: string; // e.g. "Deposit Requires Review"
  heading: string;
  intro: string;
  details: Array<{ label: string; value: string }>;
  ctaLabel: string;
  ctaUrl: string;
  baseUrl: string;
}): { subject: string; html: string; text: string } {
  const detailRows = opts.details
    .filter((d) => d.value)
    .map(
      (d) => `
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f0e9e0;font-family:${Brand.sans};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${Brand.muted};width:42%;vertical-align:top;">${escapeHtml(d.label)}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #f0e9e0;font-family:${Brand.sans};font-size:14px;line-height:20px;color:${Brand.navy};font-weight:600;text-align:right;">${escapeHtml(d.value)}</td>
                </tr>`,
    )
    .join("");

  const body = `
              <p style="margin:0 0 6px;font-family:${Brand.sans};font-size:15px;line-height:24px;color:${Brand.text};">${escapeHtml(opts.intro)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;background-color:#f7f4ee;border-radius:10px;padding:14px 18px;">
              ${detailRows}
              </table>
              ${ctaButton(opts.ctaUrl, opts.ctaLabel)}
              <div style="border-top:1px solid #efe9e0;margin-top:28px;padding-top:18px;">
                <p style="margin:0;font-family:${Brand.sans};font-size:12px;line-height:19px;color:${Brand.muted};">
                  This is an automated staff notification from the NESTARO HOMES platform.
                  Need help? Contact ${Company.email}.
                </p>
              </div>`;

  const subject = `NESTARO HOMES — ${opts.eyebrow}`;
  const html = layout({ title: subject, preheader: opts.heading, eyebrow: opts.eyebrow, heading: opts.heading, body, baseUrl: opts.baseUrl });
  const text = [
    `NESTARO HOMES — ${opts.eyebrow}`,
    ``,
    opts.intro,
    ``,
    ...opts.details.filter((d) => d.value).map((d) => `${d.label}: ${d.value}`),
    ``,
    `${opts.ctaLabel}: ${opts.ctaUrl}`,
  ].join("\n");
  return { subject, html, text };
}
