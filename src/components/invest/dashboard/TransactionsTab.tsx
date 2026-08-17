import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Receipt,
  Search,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate, formatDateTime } from "@/hooks/use-investor";
import { SectionCard, StatusBadge, EmptyState } from "./shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Wallet Activity ─────────────────────────────────────────────
// One wallet, many transaction types. Every row is a ledger entry:
// credits (+$) put money into the wallet, debits (−$) take it out.
// Filters are applied server-side over the full history.

const GROUP_FILTERS = [
  { id: "all", label: "All" },
  { id: "deposits", label: "Deposits" },
  { id: "withdrawals", label: "Withdrawals" },
  { id: "funding", label: "Plan Funding" },
  { id: "earnings", label: "Home Credits" },
  { id: "liquidations", label: "Early Withdrawals" },
  { id: "property", label: "Property Payments" },
  { id: "mortgage", label: "Mortgage Payments" },
  { id: "referral", label: "Referral Earnings" },
  { id: "refunds", label: "Refunds" },
  { id: "other", label: "Other" },
] as const;

const STATUS_FILTERS = [
  { id: "all", label: "All Statuses" },
  { id: "completed", label: "Completed" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
] as const;

const PAGE_SIZE = 15;

/** Friendly type label — mirrors the backend grouping rules. */
export function walletActivityLabel(tx: any): string {
  if (tx.type === "refund") {
    const ref = String(tx.reference ?? "");
    const desc = String(tx.description ?? "").toLowerCase();
    if (ref.startsWith("LIQ-") || desc.includes("liquidation")) return "Early Withdrawal";
    return "Refund";
  }
  switch (tx.type) {
    case "deposit":
      return "Deposit";
    case "withdrawal":
      return "Withdrawal";
    case "investment":
      return "Plan Funding";
    case "earning":
      return "Home Credit";
    case "mortgage_payment":
      return "Mortgage Payment";
    case "referral_bonus":
      return "Referral Earnings";
    case "adjustment":
      return "Adjustment";
    default:
      return String(tx.type ?? "Other").replace(/_/g, " ");
  }
}

export default function TransactionsTab() {
  const [group, setGroup] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);

  // Debounce the search box so we don't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change returns to page 1.
  useEffect(() => {
    setPage(1);
  }, [group, status, search, dateFrom, dateTo]);

  const queryInput = useMemo(
    () => ({
      group: group as any,
      status: status as any,
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [group, status, search, dateFrom, dateTo, page],
  );

  const { data, isLoading } = trpc.investor.walletActivity.useQuery(queryInput, {
    retry: false,
    refetchInterval: 20_000,
  });

  const items: any[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = group !== "all" || status !== "all" || !!search || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setGroup("all");
    setStatus("all");
    setSearchInput("");
    setSearch("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <>
      <SectionCard
        title="Wallet Activity"
        subtitle={`${total} transaction${total === 1 ? "" : "s"} across your wallet`}
        action={
          <div className="flex flex-wrap gap-2">
            {GROUP_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setGroup(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  group === f.id
                    ? "bg-[#26342b] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {/* Filter bar: search, status, date range */}
        <div className="flex flex-col lg:flex-row gap-3 mb-5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search description or reference…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-gray-700"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
                aria-label="From date"
              />
              <span className="text-xs text-gray-400">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
                aria-label="To date"
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[#c47a45]">
                Clear
              </Button>
            )}
          </div>
        </div>

        {items.length > 0 ? (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                    <th className="pb-3 pr-4 font-semibold">Type</th>
                    <th className="pb-3 pr-4 font-semibold">Description</th>
                    <th className="pb-3 pr-4 font-semibold">Reference</th>
                    <th className="pb-3 pr-4 font-semibold">Date</th>
                    <th className="pb-3 pr-4 font-semibold">Status</th>
                    <th className="pb-3 pr-4 font-semibold text-right">Amount</th>
                    <th className="pb-3 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((tx: any) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-[#f7f4ee] transition cursor-pointer"
                      onClick={() => setSelected(tx)}
                    >
                      <td className="py-3.5 pr-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                            tx.direction === "credit"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {tx.direction === "credit" ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {walletActivityLabel(tx)}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-gray-600 max-w-xs truncate">{tx.description}</td>
                      <td className="py-3.5 pr-4 text-xs text-gray-400 font-mono">{tx.reference || "—"}</td>
                      <td className="py-3.5 pr-4 text-gray-600">{formatDate(tx.createdAt)}</td>
                      <td className="py-3.5 pr-4">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td
                        className={`py-3.5 pr-4 text-right font-bold ${
                          tx.direction === "credit" ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {tx.direction === "credit" ? "+" : "−"}
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(tx);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#26342b] hover:text-[#c47a45] transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y">
              {items.map((tx: any) => (
                <button
                  key={tx.id}
                  onClick={() => setSelected(tx)}
                  className="w-full text-left py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#26342b]">{walletActivityLabel(tx)}</p>
                    <p className="text-xs text-gray-500 truncate">{tx.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-bold ${
                        tx.direction === "credit" ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {tx.direction === "credit" ? "+" : "−"}
                      {formatCurrency(tx.amount)}
                    </p>
                    <StatusBadge status={tx.status} />
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-2 border-t">
                <p className="text-xs text-gray-400">
                  Page {page} of {totalPages} · {total} transaction{total === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Receipt}
            title={isLoading ? "Loading activity…" : "No transactions found"}
            text={
              hasFilters
                ? "Nothing matches these filters. Try widening the date range or clearing the search."
                : "Make your first deposit to get started — every wallet movement will appear here."
            }
          />
        )}
      </SectionCard>

      {/* Transaction details modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#26342b]">
              {selected ? walletActivityLabel(selected) : "Transaction"}
            </DialogTitle>
            <DialogDescription>Full details for this wallet transaction.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div
                className={`rounded-xl px-5 py-4 text-center ${
                  selected.direction === "credit" ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <p
                  className={`text-3xl font-bold font-serif ${
                    selected.direction === "credit" ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {selected.direction === "credit" ? "+" : "−"}
                  {formatCurrency(selected.amount)}
                </p>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide font-semibold">
                  {selected.direction === "credit" ? "Credit — money into your wallet" : "Debit — money out of your wallet"}
                </p>
              </div>
              <dl className="divide-y text-sm">
                {[
                  ["Type", walletActivityLabel(selected)],
                  ["Description", selected.description || "—"],
                  ["Reference", selected.reference || "—"],
                  ["Status", <StatusBadge key="s" status={selected.status} />],
                  ["Date", formatDateTime(selected.createdAt)],
                  ["Direction", selected.direction === "credit" ? "Credit" : "Debit"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-start justify-between gap-4 py-2.5">
                    <dt className="text-gray-400 text-xs uppercase tracking-wide font-semibold shrink-0 pt-0.5">
                      {label}
                    </dt>
                    <dd className="text-right text-gray-700 break-words max-w-[240px]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
