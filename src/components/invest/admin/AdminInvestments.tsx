import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Search, Check, X, Pause, Play, CalendarPlus, TrendingUp, DollarSign, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate } from "@/hooks/use-investor";
import { SectionCard, StatusBadge, EmptyState, ProgressBar } from "../dashboard/shared";
import InvestorAvatar from "@/components/invest/InvestorAvatar";

const filters = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
  { id: "matured", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export default function AdminInvestments() {
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const isValidFilter = (v: string | null): v is string => !!v && filters.some((f) => f.id === v);
  const [filter, setFilter] = useState(() => (isValidFilter(urlFilter) ? urlFilter : "all"));
  const [search, setSearch] = useState("");

  // Deep links from the pending-actions indicator carry ?filter=pending
  useEffect(() => {
    if (isValidFilter(urlFilter)) setFilter(urlFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter]);
  const { data: items, refetch } = trpc.investAdmin.investments.useQuery(
    { status: filter, search: search || undefined },
    { retry: false, refetchInterval: 20_000 },
  );

  const invalidate = () => refetch();
  const onError = (err: any) => toast.error(err.message);
  const onSuccess = (msg: string) => () => {
    toast.success(msg);
    invalidate();
  };

  const approve = trpc.investAdmin.approveInvestment.useMutation({ onSuccess: onSuccess("Plan approved and activated"), onError });
  const reject = trpc.investAdmin.rejectInvestment.useMutation({ onSuccess: onSuccess("Plan rejected, principal refunded"), onError });
  const setStatus = trpc.investAdmin.setInvestmentStatus.useMutation({ onSuccess: onSuccess("Plan updated"), onError });
  const extend = trpc.investAdmin.extendInvestment.useMutation({ onSuccess: onSuccess("Duration extended"), onError });
  const setRoi = trpc.investAdmin.setCustomRoi.useMutation({ onSuccess: onSuccess("ROI updated"), onError });
  const setPaused = trpc.investAdmin.setProfitPaused.useMutation({ onSuccess: onSuccess("Profit payments updated"), onError });
  const creditNow = trpc.investAdmin.creditProfitNow.useMutation({
    onSuccess: (data) => {
      toast.success(`Credited ${formatCurrency(data.amount)} to the investor's wallet`);
      invalidate();
    },
    onError,
  });

  const busy = approve.isPending || reject.isPending || setStatus.isPending || extend.isPending || setRoi.isPending || setPaused.isPending || creditNow.isPending;

  return (
    <SectionCard
      title="Home Plan Control"
      subtitle={`${items?.length ?? 0} investments`}
      action={
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer, project or ID..."
              className="pl-9 w-52"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  filter === f.id ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {items && items.length > 0 ? (
        <div className="space-y-4">
          {items.map((inv: any) => (
            <div key={inv.id} className="bg-[#f7f4ee] rounded-xl p-5 border border-gray-100">
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <p className="font-bold text-[#26342b] break-words [overflow-wrap:anywhere]">
                    #{inv.id} · {inv.projectName}
                  </p>
                  <div className="flex items-center gap-2 mt-1 min-w-0">
                    <InvestorAvatar name={inv.investorName} avatar={inv.investorAvatar} size="xs" />
                    <p className="text-xs text-gray-500 min-w-0 [overflow-wrap:anywhere]">
                      {inv.investorName} · {inv.investorEmail} · {inv.planName} Plan
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {inv.profitPaused === "yes" && (
                    <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                      Profits Paused
                    </span>
                  )}
                  <StatusBadge status={inv.status === "matured" ? "completed" : inv.status} />
                </div>
              </div>

              {/* Data grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm mb-4">
                <div><p className="text-[11px] text-gray-400">Amount</p><p className="font-bold text-[#26342b]">{formatCurrency(inv.amount)}</p></div>
                <div><p className="text-[11px] text-gray-400">ROI %</p><p className="font-bold text-[#c47a45]">{inv.effectiveReturn}%{inv.customReturnRate ? " (custom)" : ""}</p></div>
                <div><p className="text-[11px] text-gray-400">Monthly Profit</p><p className="font-bold text-green-600">{formatCurrency(inv.monthlyProfit)}</p></div>
                <div><p className="text-[11px] text-gray-400">Profits Paid</p><p className="font-bold text-[#26342b]">{inv.profitsPaid}/{inv.payoutCount ?? inv.durationMonths}</p></div>
                <div><p className="text-[11px] text-gray-400">Remaining Payments</p><p className="font-bold text-[#26342b]">{Math.max((inv.payoutCount ?? inv.durationMonths) - inv.profitsPaid, 0)}</p></div>
                <div><p className="text-[11px] text-gray-400">Total ROI Paid</p><p className="font-bold text-green-600">{formatCurrency(inv.totalProfitPaid)}</p></div>
                <div><p className="text-[11px] text-gray-400">Last ROI Paid</p><p className="font-semibold text-[#26342b]">{inv.lastProfitAt ? formatDate(inv.lastProfitAt) : "—"}</p></div>
                <div><p className="text-[11px] text-gray-400">Next ROI Due</p><p className="font-semibold text-[#26342b]">{inv.status === "active" && inv.nextProfitAt ? formatDate(inv.nextProfitAt) : "—"}</p></div>
                <div><p className="text-[11px] text-gray-400">Start Date</p><p className="font-semibold text-[#26342b]">{formatDate(inv.startDate)}</p></div>
                <div><p className="text-[11px] text-gray-400">End Date</p><p className="font-semibold text-[#26342b]">{formatDate(inv.maturityDate)}</p></div>
                <div><p className="text-[11px] text-gray-400">Duration</p><p className="font-semibold text-[#26342b]">{inv.durationDaysEffective ?? inv.durationMonths * 30} days{inv.durationDays ? " (flexible)" : ""}</p></div>
              </div>

              {inv.status === "active" && (
                <div className="flex items-center gap-3 mb-4">
                  <ProgressBar value={inv.progress} className="flex-1" />
                  <span className="text-xs font-bold text-[#26342b]">{inv.progress}%</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {inv.status === "pending" && (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => approve.mutate({ investmentId: inv.id })} className="bg-green-600 hover:bg-green-700 h-8 text-xs">
                      <Check className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} className="border-red-300 text-red-500 h-8 text-xs"
                      onClick={() => {
                        const note = window.prompt("Reason for rejection (optional):") ?? "";
                        reject.mutate({ investmentId: inv.id, note });
                      }}>
                      <X className="w-3.5 h-3.5 mr-1" /> Reject & Refund
                    </Button>
                  </>
                )}
                {inv.status === "active" && (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => creditNow.mutate({ investmentId: inv.id })} className="bg-[#26342b] h-8 text-xs">
                      <DollarSign className="w-3.5 h-3.5 mr-1" /> Credit Profit Now
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} className="border-[#26342b] text-[#26342b] h-8 text-xs"
                      onClick={() => {
                        const rate = window.prompt(`Set custom ROI % (current: ${inv.effectiveReturn}%). Leave empty to use plan rate:`, "");
                        if (rate === null) return;
                        const trimmed = rate.trim();
                        if (trimmed === "") {
                          setRoi.mutate({ investmentId: inv.id, returnRate: null });
                        } else {
                          const num = Number(trimmed);
                          if (!num || num <= 0 || num > 1000) { toast.error("Enter a valid percentage"); return; }
                          setRoi.mutate({ investmentId: inv.id, returnRate: num });
                        }
                      }}>
                      <TrendingUp className="w-3.5 h-3.5 mr-1" /> Set ROI
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} className="border-[#26342b] text-[#26342b] h-8 text-xs"
                      onClick={() => {
                        const months = window.prompt("Extend by how many months? (1-24)", "6");
                        if (months === null) return;
                        const num = Number(months);
                        if (!num || num < 1 || num > 24) { toast.error("Enter 1-24"); return; }
                        extend.mutate({ investmentId: inv.id, months: num });
                      }}>
                      <CalendarPlus className="w-3.5 h-3.5 mr-1" /> Extend
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy}
                      className={`h-8 text-xs ${inv.profitPaused === "yes" ? "border-green-300 text-green-600" : "border-amber-300 text-amber-600"}`}
                      onClick={() => setPaused.mutate({ investmentId: inv.id, paused: inv.profitPaused !== "yes" })}>
                      {inv.profitPaused === "yes" ? (<><Play className="w-3.5 h-3.5 mr-1" /> Resume Profits</>) : (<><Pause className="w-3.5 h-3.5 mr-1" /> Pause Profits</>)}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} className="border-red-300 text-red-500 h-8 text-xs"
                      onClick={() => setStatus.mutate({ investmentId: inv.id, action: "suspend" })}>
                      <Lock className="w-3.5 h-3.5 mr-1" /> Suspend
                    </Button>
                  </>
                )}
                {inv.status === "suspended" && (
                  <Button size="sm" disabled={busy} className="bg-green-600 hover:bg-green-700 h-8 text-xs"
                    onClick={() => setStatus.mutate({ investmentId: inv.id, action: "activate" })}>
                    <Play className="w-3.5 h-3.5 mr-1" /> Reactivate
                  </Button>
                )}
                {inv.status === "matured" && (
                  <Button size="sm" variant="outline" disabled={busy} className="border-gray-300 text-gray-600 h-8 text-xs"
                    onClick={() => setStatus.mutate({ investmentId: inv.id, action: "close" })}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Close
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={TrendingUp} title="No plans found" text="Plans matching this filter will appear here." />
      )}
    </SectionCard>
  );
}
