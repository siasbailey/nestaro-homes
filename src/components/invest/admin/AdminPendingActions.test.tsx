import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import AdminPendingActions, { type PendingActionsData } from "./AdminPendingActions";

const sample: PendingActionsData = {
  total: 4,
  categories: [
    { key: "deposits", label: "Deposits", count: 2, section: "deposits" },
    { key: "withdrawals", label: "Withdrawals", count: 1, section: "withdrawals" },
    { key: "mortgages", label: "Financing", count: 1, section: "mortgages" },
  ],
  items: [
    {
      key: "deposit-11",
      category: "deposits",
      categoryLabel: "Deposits",
      title: "Pending Deposit",
      message: "$500.00 deposit from Jane Cooper requires review",
      createdAt: new Date(),
      section: "deposits",
    },
    {
      key: "withdrawal-21",
      category: "withdrawals",
      categoryLabel: "Withdrawals",
      title: "Pending Withdrawal",
      message: "$1,200.00 withdrawal from Marcus Reed requires review",
      createdAt: new Date(),
      section: "withdrawals",
    },
  ],
};

describe("AdminPendingActions indicator", () => {
  it("shows a badge with the real pending count", () => {
    const html = renderToString(
      <AdminPendingActions data={sample} onNavigate={() => {}} onOpenNotifications={() => {}} />
    );
    // Badge carries the DB-backed total
    expect(html).toContain(">4</span>");
    expect(html).toContain("Pending actions");
  });

  it("caps very large counts at 99+", () => {
    const html = renderToString(
      <AdminPendingActions
        data={{ ...sample, total: 140 }}
        onNavigate={() => {}}
        onOpenNotifications={() => {}}
      />
    );
    expect(html).toContain("99+");
  });

  it("shows no badge when there is nothing pending", () => {
    const html = renderToString(
      <AdminPendingActions
        data={{ total: 0, categories: [], items: [] }}
        onNavigate={() => {}}
        onOpenNotifications={() => {}}
      />
    );
    expect(html).not.toContain("99+");
    expect(html).toContain("all caught up");
  });

  it("renders without data (loading state) as a quiet bell", () => {
    const html = renderToString(
      <AdminPendingActions data={undefined} onNavigate={() => {}} onOpenNotifications={() => {}} />
    );
    expect(html).toContain("Pending actions");
    expect(html).not.toContain("bg-red-500 text-white text-[10px]");
  });
});
