import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  investors,
  notificationPreferences,
  investmentPlans,
  deposits,
  products,
  mortgagePlans,
  mortgages,
} from "@db/schema";

/**
 * End-to-end email verification for the Resend integration.
 *
 * A local HTTP stub plays the role of the Resend API (via the RESEND_BASE_URL
 * test hook). Every send goes through the real Resend SDK → real HTTP → stub,
 * so these tests prove: the API key is used, the sender is correct, the
 * connection works, emails are delivered, and provider failures are handled
 * without crashing business logic. The DB is faked (same pattern as
 * pending-actions.test.ts) so the real router mutations can run.
 */

type Captured = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  auth?: string;
};

const sentEmails: Captured[] = [];
let stubStatus = 200;
let stub: http.Server;
let stubUrl = "";

// ── Fake DB (table-aware rows, drizzle-shaped chains) ───────────
const rows = new Map<object, any[]>();

function chainFor(table: object): any {
  const self: any = {};
  for (const m of ["where", "orderBy", "limit", "groupBy", "having", "offset", "innerJoin", "leftJoin", "for"]) {
    self[m] = () => self;
  }
  self.then = (resolve: any) => resolve(rows.get(table) ?? []);
  return self;
}

const fakeDb: any = {
  select: (_fields?: any) => ({ from: (t: object) => chainFor(t) }),
  insert: (_t: object) => ({
    values: (_v: any) => ({
      $returningId: async () => [{ id: 4242 }],
      then: (resolve: any) => resolve([{ insertId: 4242, affectedRows: 1 }]),
    }),
  }),
  update: (_t: object) => ({
    set: (_v: any) => ({
      where: (..._a: any[]) => ({ then: (resolve: any) => resolve([{ affectedRows: 1 }]) }),
    }),
  }),
  delete: (_t: object) => ({ where: () => ({ then: (resolve: any) => resolve([{ affectedRows: 1 }]) }) }),
  transaction: async (fn: any) => fn(fakeDb),
};

vi.mock("./queries/connection", () => ({
  getDb: () => fakeDb,
}));

import { investorRouter } from "./investor-router";
import { ordersRouter } from "./orders-router";
import { mortgageRouter } from "./mortgage-router";
import {
  sendEmail,
  buildVerificationEmail,
  buildPasswordResetEmail,
  buildInvestorEmailChangeEmail,
  buildAdminActionEmail,
  DEFAULT_FROM_EMAIL,
} from "./lib/email";
import { notifyAdminEmail } from "./lib/notify";

const ADMIN_INBOX = "info@nestarohomes.com";

const investor = {
  id: 7,
  name: "Jane Cooper",
  email: "jane@example.com",
  phone: "+1 415 555 0132",
  country: "United States",
  status: "active",
  walletFrozen: "no",
  kycStatus: "verified",
  verificationStatus: "verified",
  verificationTier: "tier2",
  walletBalance: "50000.00",
};

function investorCtx(): any {
  return { req: new Request("http://test.local"), resHeaders: new Headers(), investor };
}

async function waitForEmails(n: number, timeoutMs = 6000): Promise<void> {
  const start = Date.now();
  while (sentEmails.length < n && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 25));
  }
}

beforeAll(async () => {
  stub = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.method === "POST" && req.url === "/emails") {
        try {
          const parsed = JSON.parse(body);
          sentEmails.push({ ...parsed, auth: req.headers.authorization });
        } catch {
          /* ignore malformed */
        }
      }
      if (stubStatus === 200) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: "email_stub_1" }));
      } else {
        res.writeHead(stubStatus, { "content-type": "application/json" });
        res.end(JSON.stringify({ statusCode: stubStatus, name: "validation_error", message: "The from address is not verified" }));
      }
    });
  });
  await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
  stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

  process.env.RESEND_API_KEY = "re_test_1234567890abcdef";
  process.env.RESEND_BASE_URL = stubUrl;
  process.env.ADMIN_NOTIFICATION_EMAIL = ADMIN_INBOX;
  process.env.APP_URL = "http://localhost:3000";
  delete process.env.RESEND_FROM_EMAIL; // exercise the default verified sender
});

afterAll(async () => {
  await new Promise((r) => stub.close(r));
});

beforeEach(() => {
  sentEmails.length = 0;
  rows.clear();
  stubStatus = 200;
  rows.set(investors, [investor]);
  rows.set(notificationPreferences, []); // defaults: all email categories enabled
});

// ────────────────────────────────────────────────────────────────
// 1. Transport: connection, key, sender, payload, error handling
// ────────────────────────────────────────────────────────────────
describe("Resend transport", () => {
  it("connects to Resend with the API key and sends with the verified sender", async () => {
    const result = await sendEmail({ to: "buyer@example.com", subject: "Hello", html: "<p>Hi</p>", text: "Hi" });
    expect(result).toEqual({ sent: true });
    expect(sentEmails).toHaveLength(1);
    const mail = sentEmails[0];
    expect(mail.auth).toBe("Bearer re_test_1234567890abcdef");
    expect(mail.from).toBe(DEFAULT_FROM_EMAIL);
    expect(mail.from).toBe("NESTARO HOMES <no-reply@nestarohomes.com>");
    expect(mail.to).toBe("buyer@example.com");
    expect(mail.subject).toBe("Hello");
    expect(mail.html).toBe("<p>Hi</p>");
    expect(mail.text).toBe("Hi");
  });

  it("returns resend-not-configured and sends nothing when the API key is missing", async () => {
    // Fresh module instance — the cached client in the main module must not leak in.
    vi.resetModules();
    const fresh = await import("./lib/email");
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const result = await fresh.sendEmail({ to: "x@example.com", subject: "s", html: "<p>h</p>", text: "h" });
      expect(result).toEqual({ sent: false, reason: "resend-not-configured" });
      expect(sentEmails).toHaveLength(0);
    } finally {
      process.env.RESEND_API_KEY = saved;
    }
  });

  it("handles a Resend rejection (422) without throwing", async () => {
    stubStatus = 422;
    const result = await sendEmail({ to: "buyer@example.com", subject: "x", html: "<p>x</p>", text: "x" });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("provider-error");
  });

  it("handles a network failure without throwing", async () => {
    vi.resetModules();
    const fresh = await import("./lib/email");
    const savedUrl = process.env.RESEND_BASE_URL;
    process.env.RESEND_BASE_URL = "http://127.0.0.1:1"; // closed port
    try {
      const result = await fresh.sendEmail({ to: "buyer@example.com", subject: "x", html: "<p>x</p>", text: "x" });
      expect(result.sent).toBe(false);
      // SDK may surface the failure as a caught exception or an error response —
      // either way the result is controlled and nothing throws.
      expect(["send-failed", "provider-error"]).toContain(result.reason);
    } finally {
      process.env.RESEND_BASE_URL = savedUrl;
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 2. Branded templates: auth emails + admin action layout
// ────────────────────────────────────────────────────────────────
describe("email templates", () => {
  it("verification email carries the link and NESTARO branding", () => {
    const msg = buildVerificationEmail({ name: "Jane", verifyUrl: "http://localhost:3000/invest/verify?token=abc", baseUrl: "http://localhost:3000" });
    expect(msg.subject).toContain("Nestaro Homes");
    expect(msg.subject).toMatch(/verify/i);
    expect(msg.html).toContain("http://localhost:3000/invest/verify?token=abc");
    expect(msg.html.toLowerCase()).toContain("#26342b"); // brand navy
    expect(msg.html).not.toMatch(/₦|Naira|OPay|\+234/i);
    expect(msg.text).toContain("http://localhost:3000/invest/verify?token=abc");
  });

  it("password reset email carries the reset link", () => {
    const msg = buildPasswordResetEmail({ name: "Jane", resetUrl: "http://localhost:3000/invest/reset?token=xyz", baseUrl: "http://localhost:3000" });
    expect(msg.html).toContain("http://localhost:3000/invest/reset?token=xyz");
    expect(msg.subject).toMatch(/password/i);
  });

  it("email-change verification carries the confirm link", () => {
    const msg = buildInvestorEmailChangeEmail({ name: "Jane", newEmail: "new@example.com", verifyUrl: "http://localhost:3000/invest/confirm-email?token=q", baseUrl: "http://localhost:3000" });
    expect(msg.html).toContain("http://localhost:3000/invest/confirm-email?token=q");
    expect(msg.html).toContain("new@example.com");
  });

  it("admin action email renders details, CTA and the NESTARO subject line", () => {
    const msg = buildAdminActionEmail({
      eyebrow: "Deposit Requires Review",
      heading: "Pending Deposit — $500.00",
      intro: "Jane submitted a deposit.",
      details: [
        { label: "Customer", value: "Jane Cooper · jane@example.com" },
        { label: "Amount", value: "$500.00" },
      ],
      ctaLabel: "Review Deposit",
      ctaUrl: "http://localhost:3000/admin/dashboard?section=deposits",
      baseUrl: "http://localhost:3000",
    });
    expect(msg.subject).toBe("NESTARO HOMES — Deposit Requires Review");
    expect(msg.html).toContain("Jane Cooper · jane@example.com");
    expect(msg.html).toContain("$500.00");
    expect(msg.html).toContain("http://localhost:3000/admin/dashboard?section=deposits");
  });
});

// ────────────────────────────────────────────────────────────────
// 3. notifyAdminEmail helper: recipient + failure containment
// ────────────────────────────────────────────────────────────────
describe("notifyAdminEmail", () => {
  it("sends staff mail to ADMIN_NOTIFICATION_EMAIL", async () => {
    const result = await notifyAdminEmail({
      eyebrow: "Deposit Requires Review",
      heading: "Pending Deposit — $500.00",
      intro: "Jane Cooper submitted a deposit of $500.00 via Zelle.",
      details: [
        { label: "Customer", value: "Jane Cooper · jane@example.com" },
        { label: "Amount", value: "$500.00" },
        { label: "Payment Method", value: "Zelle" },
        { label: "Reference", value: "DEP-TEST-1" },
        { label: "Status", value: "Pending Review" },
      ],
      adminLink: "/admin/dashboard?section=deposits",
      ctaLabel: "Review Deposit",
    });
    expect(result.sent).toBe(true);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe(ADMIN_INBOX);
    expect(sentEmails[0].subject).toBe("NESTARO HOMES — Deposit Requires Review");
    expect(sentEmails[0].html).toContain("DEP-TEST-1");
    expect(sentEmails[0].html).toContain("http://localhost:3000/admin/dashboard?section=deposits");
  });

  it("provider failure returns a controlled result and never throws", async () => {
    stubStatus = 422;
    const result = await notifyAdminEmail({
      eyebrow: "Withdrawal Requires Review",
      heading: "x",
      intro: "x",
      details: [],
      adminLink: "/admin/dashboard?section=withdrawals",
    });
    expect(result.sent).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// 4. Workflow wiring: real router mutations fire real emails
// ────────────────────────────────────────────────────────────────
describe("workflow emails through Resend", () => {
  it("deposit: customer confirmation + admin 'Deposit Requires Review'", async () => {
    const caller = investorRouter.createCaller(investorCtx());
    const res = await caller.deposit({ amount: 500, method: "zelle" });
    expect(res.success).toBe(true);
    expect(res.reference).toMatch(/^DEP-/);

    await waitForEmails(2);
    const admin = sentEmails.find((e) => e.to === ADMIN_INBOX);
    const customer = sentEmails.find((e) => e.to === investor.email);
    expect(admin).toBeTruthy();
    expect(admin!.subject).toBe("NESTARO HOMES — Deposit Requires Review");
    expect(admin!.html).toContain("Jane Cooper");
    expect(admin!.html).toContain("$500.00");
    expect(admin!.html).toContain("Zelle");
    expect(admin!.html).toContain(res.reference);
    expect(admin!.html).toContain("Pending Review");
    expect(admin!.html).toContain("/admin/dashboard?section=deposits");
    expect(customer).toBeTruthy();
    expect(customer!.html).toContain("$500.00");
    expect(customer!.html).toContain(res.reference);
  });

  it("deposit below the $50 minimum is rejected before any email", async () => {
    const caller = investorRouter.createCaller(investorCtx());
    await expect(caller.deposit({ amount: 10, method: "bank" })).rejects.toThrow(/Minimum deposit/);
    await new Promise((r) => setTimeout(r, 150));
    expect(sentEmails).toHaveLength(0);
  });

  it("legacy opay method is rejected for new deposits", async () => {
    const caller = investorRouter.createCaller(investorCtx());
    await expect(caller.deposit({ amount: 500, method: "opay" as any })).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 150));
    expect(sentEmails).toHaveLength(0);
  });

  it("withdrawal: customer confirmation + admin 'Withdrawal Requires Review'", async () => {
    rows.set(deposits, [{ approvedTotal: "10000.00" }]); // qualifying deposit gate
    const caller = investorRouter.createCaller(investorCtx());
    const destination = "Zelle: jane@example.com • Name: Jane Cooper";
    const res = await caller.withdraw({ amount: 200, method: "zelle", destination });
    expect(res.success).toBe(true);

    await waitForEmails(2);
    const admin = sentEmails.find((e) => e.to === ADMIN_INBOX);
    const customer = sentEmails.find((e) => e.to === investor.email);
    expect(admin).toBeTruthy();
    expect(admin!.subject).toBe("NESTARO HOMES — Withdrawal Requires Review");
    expect(admin!.html).toContain("$200.00");
    expect(admin!.html).toContain("Zelle");
    expect(admin!.html).toContain(destination);
    expect(admin!.html).toContain(res.reference);
    expect(admin!.html).toContain("/admin/dashboard?section=withdrawals");
    expect(customer).toBeTruthy();
    expect(customer!.html).toContain("$200.00");
  });

  it("investment: customer confirmation + admin 'Investment Requires Review'", async () => {
    rows.set(investmentPlans, [
      { id: 3, name: "Growth", minAmount: "100.00", durationMonths: 6, isActive: "yes" },
    ]);
    const caller = investorRouter.createCaller(investorCtx());
    const res = await caller.invest({ planId: 3, amount: 5000 });
    expect(res.success).toBe(true);

    await waitForEmails(2);
    const admin = sentEmails.find((e) => e.to === ADMIN_INBOX);
    const customer = sentEmails.find((e) => e.to === investor.email);
    expect(admin).toBeTruthy();
    expect(admin!.subject).toBe("NESTARO HOMES — Investment Requires Review");
    expect(admin!.html).toContain("$5,000.00");
    expect(admin!.html).toContain("Growth");
    expect(admin!.html).toContain("/admin/dashboard?section=investments");
    expect(customer).toBeTruthy();
    expect(customer!.html).toContain("$5,000.00");
  });

  it("property purchase: buyer confirmation + admin 'New Property Purchase'", async () => {
    rows.set(investors, []); // buyer has no investor account → no extra document emails
    const caller = ordersRouter.createCaller({ req: new Request("http://test.local"), resHeaders: new Headers() } as any);
    const res = await caller.create({
      customer: {
        firstName: "John",
        lastName: "Smith",
        email: "john@example.com",
        phone: "+1 212 555 0147",
        country: "United States",
        state: "Texas",
        city: "Austin",
        postalCode: "73301",
      },
      items: [{ productId: 1, productName: "Maple Grove Villa", quantity: 1, unitPrice: 250000, totalPrice: 250000 }],
      paymentMethod: "bank",
      totalAmount: 250000,
    });
    expect(res.orderNumber).toMatch(/^FH-NG-/);

    await waitForEmails(2);
    const admin = sentEmails.find((e) => e.to === ADMIN_INBOX);
    const buyer = sentEmails.find((e) => e.to === "john@example.com");
    expect(admin).toBeTruthy();
    expect(admin!.subject).toBe("NESTARO HOMES — New Property Purchase");
    expect(admin!.html).toContain("John Smith");
    expect(admin!.html).toContain("$250,000.00");
    expect(admin!.html).toContain("Maple Grove Villa");
    expect(admin!.html).toContain("Bank Transfer");
    expect(admin!.html).toContain("Pending Payment Verification");
    expect(buyer).toBeTruthy();
    expect(buyer!.html).toContain("Maple Grove Villa");
  });

  it("mortgage application: customer confirmation + admin 'Mortgage Application Requires Review'", async () => {
    rows.set(products, [
      {
        id: 9,
        name: "Oakwood Duplex",
        isActive: "yes",
        mortgageEnabled: "yes",
        mortgagePlanIds: "[4]",
        price: "250000.00",
        minDownPaymentPercent: "20",
        images: [],
      },
    ]);
    rows.set(mortgagePlans, [
      {
        id: 4,
        name: "10-Year Plan",
        status: "active",
        planType: "yearly",
        durationValue: 10,
        downPaymentPercent: "20",
        interestPercent: "15",
        paymentFrequency: "monthly",
      },
    ]);
    rows.set(mortgages, []); // no open application
    const caller = mortgageRouter.createCaller(investorCtx());
    const res = await caller.applyForMortgage({ productId: 9, planId: 4 });
    expect(res.success).toBe(true);

    await waitForEmails(2);
    const admin = sentEmails.find((e) => e.to === ADMIN_INBOX);
    const customer = sentEmails.find((e) => e.to === investor.email);
    expect(admin).toBeTruthy();
    expect(admin!.subject).toBe("NESTARO HOMES — Mortgage Application Requires Review");
    expect(admin!.html).toContain("Oakwood Duplex");
    expect(admin!.html).toContain("10-Year Plan");
    expect(admin!.html).toContain(res.reference);
    expect(admin!.html).toContain("/admin/dashboard?section=mortgages");
    expect(customer).toBeTruthy();
    expect(customer!.html).toContain("Oakwood Duplex");
  });

  it("business logic still succeeds when Resend is down (no crash, controlled result)", async () => {
    stubStatus = 500;
    const caller = investorRouter.createCaller(investorCtx());
    const res = await caller.deposit({ amount: 500, method: "bank" });
    expect(res.success).toBe(true); // deposit is recorded despite provider failure
    await waitForEmails(2, 3000); // attempts are made but rejected by the provider
    expect(sentEmails.every((e) => e.subject)).toBe(true); // stub saw well-formed payloads
  });
});
