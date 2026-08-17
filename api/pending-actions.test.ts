import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deposits,
  withdrawals,
  investments,
  liquidationRequests,
  mortgages,
  kycRequests,
  orders,
  customers,
  appointments,
  testimonials,
  investors,
} from "@db/schema";

/**
 * The real pending filters live in the SQL conditions (eq / inArray on the
 * status columns, type-checked against the schema). This fake DB returns
 * pre-filtered rows per table so we can verify the endpoint's aggregation,
 * response shape, deep-link targets and — most importantly — that the
 * counts come from the source tables rather than notification read-state.
 */
const rows = new Map<object, any[]>();
const counts = new Map<object, number>();

function rowsChain(table: object) {
  const self: any = {
    where: () => self,
    orderBy: () => self,
    limit: () => self,
    then: (resolve: any) => resolve(rows.get(table) ?? []),
  };
  return self;
}

function countChain(table: object, n: number) {
  const self: any = {
    where: () => self,
    then: (resolve: any) => resolve([{ count: n }]),
  };
  return self;
}

vi.mock("./queries/connection", () => ({
  getDb: () => ({
    select: (fields?: any) => ({
      from: (table: object) =>
        fields && typeof fields === "object" && "count" in fields
          ? countChain(table, counts.get(table) ?? 0)
          : rowsChain(table),
    }),
  }),
}));

import { investAdminRouter } from "./invest-admin-router";

const baseCtx = { req: new Request("http://test.local"), resHeaders: new Headers() };
// Legacy admin path: an investor account carrying the admin role.
const adminCtx: any = { ...baseCtx, investor: { id: 1, role: "admin", name: "Primary Admin" } };

beforeEach(() => {
  rows.clear();
  counts.clear();
  rows.set(investors, [
    { id: 7, name: "Jane Cooper" },
    { id: 8, name: "Marcus Reed" },
  ]);
  rows.set(customers, [{ id: 3, firstName: "John", lastName: "Smith" }]);
});

describe("investAdmin.pendingActions authorization", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = investAdminRouter.createCaller(baseCtx as any);
    await expect(caller.pendingActions()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects secondary admins", async () => {
    const caller = investAdminRouter.createCaller({ ...baseCtx, admin: { id: 2, role: "secondary" } } as any);
    await expect(caller.pendingActions()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("investAdmin.pendingActions aggregation", () => {
  it("returns a clean zero state when nothing is pending", async () => {
    const caller = investAdminRouter.createCaller(adminCtx);
    const res = await caller.pendingActions();
    expect(res.total).toBe(0);
    expect(res.categories).toEqual([]);
    expect(res.items).toEqual([]);
  });

  it("counts and itemizes real pending records across all workflows", async () => {
    rows.set(deposits, [
      { id: 11, investorId: 7, amount: "500.00", status: "pending", createdAt: new Date("2026-08-10T10:00:00Z") },
    ]);
    counts.set(deposits, 1);

    rows.set(withdrawals, [
      { id: 21, investorId: 8, amount: "1200.00", status: "pending", createdAt: new Date("2026-08-11T09:00:00Z") },
      { id: 22, investorId: 7, amount: "300.00", status: "approved", createdAt: new Date("2026-08-11T08:00:00Z") },
    ]);
    counts.set(withdrawals, 2);

    rows.set(investments, [
      { id: 31, investorId: 8, projectName: "Maple Grove Villas", amount: "10000.00", status: "pending", createdAt: new Date("2026-08-09T12:00:00Z") },
    ]);
    counts.set(investments, 1);

    rows.set(liquidationRequests, [
      { id: 41, investmentId: 31, investorId: 8, estimatedValue: "9500.00", status: "pending", requestedAt: new Date("2026-08-11T11:00:00Z") },
    ]);
    counts.set(liquidationRequests, 1);

    rows.set(mortgages, [
      { id: 51, investorId: 7, propertyName: "Oakwood Duplex", planName: "10-Year Plan", propertyPrice: "250000.00", status: "pending", createdAt: new Date("2026-08-10T15:00:00Z") },
    ]);
    counts.set(mortgages, 1);

    rows.set(kycRequests, [
      { id: 61, investorId: 8, tierRequested: "tier2", status: "pending", submittedAt: new Date("2026-08-10T09:00:00Z") },
    ]);
    counts.set(kycRequests, 1);

    rows.set(orders, [
      { id: 71, orderNumber: "NH-2026-0071", customerId: 3, totalAmount: "185000.00", paymentStatus: "pending", createdAt: new Date("2026-08-08T10:00:00Z") },
    ]);
    counts.set(orders, 1);

    rows.set(appointments, [
      { id: 81, customerName: "John Smith", type: "property_inspection", appointmentRef: "APT-81", status: "pending", createdAt: new Date("2026-08-11T07:00:00Z") },
    ]);
    counts.set(appointments, 1);

    rows.set(testimonials, [
      { id: 91, customerName: "Jane Cooper", rating: 5, propertyName: "Maple Grove Villas", status: "pending", createdAt: new Date("2026-08-11T06:00:00Z") },
    ]);
    counts.set(testimonials, 1);

    const caller = investAdminRouter.createCaller(adminCtx);
    const res = await caller.pendingActions();

    // Total = sum of per-category counts (9 categories with pending items)
    expect(res.total).toBe(10);
    expect(res.categories).toHaveLength(9);
    for (const c of res.categories) expect(c.count).toBeGreaterThan(0);

    // Deposit item matches the spec's example shape
    const dep = res.items.find((i) => i.key === "deposit-11");
    expect(dep).toBeDefined();
    expect(dep!.title).toBe("Pending Deposit");
    expect(dep!.message).toContain("$500.00");
    expect(dep!.message).toContain("Jane Cooper");
    expect(dep!.section).toBe("deposits");

    // Approved-but-unpaid withdrawal still requires admin action
    const wd = res.items.find((i) => i.key === "withdrawal-22");
    expect(wd!.title).toBe("Withdrawal Awaiting Payout");
    expect(wd!.section).toBe("withdrawals");

    // Deep links point at the correct existing screens
    expect(res.items.find((i) => i.key === "investment-31")!.section).toBe("investments");
    expect(res.items.find((i) => i.key === "liquidation-41")!.section).toBe("liquidations");
    expect(res.items.find((i) => i.key === "liquidation-41")!.message).toContain("Maple Grove Villas");
    expect(res.items.find((i) => i.key === "mortgage-51")!.section).toBe("mortgages");
    expect(res.items.find((i) => i.key === "kyc-61")!.section).toBe("verification");
    expect(res.items.find((i) => i.key === "order-71")!.section).toBe("property");
    expect(res.items.find((i) => i.key === "order-71")!.message).toContain("NH-2026-0071");
    expect(res.items.find((i) => i.key === "order-71")!.message).toContain("John Smith");
    expect(res.items.find((i) => i.key === "appointment-81")!.section).toBe("appointments");
    expect(res.items.find((i) => i.key === "testimonial-91")!.section).toBe("testimonials");

    // Items are newest-first
    const times = res.items.map((i) => +new Date(i.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("omits categories with zero pending items", async () => {
    rows.set(deposits, [
      { id: 11, investorId: 7, amount: "500.00", status: "pending", createdAt: new Date() },
    ]);
    counts.set(deposits, 3); // 3 pending, item list display-capped

    const caller = investAdminRouter.createCaller(adminCtx);
    const res = await caller.pendingActions();

    expect(res.total).toBe(3);
    expect(res.categories).toHaveLength(1);
    expect(res.categories[0]).toMatchObject({ key: "deposits", label: "Deposits", count: 3, section: "deposits" });
  });
});
