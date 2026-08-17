import { useMemo, useState } from "react";
import {
  CircleDollarSign, Clock, CheckCircle2, XCircle, BadgeCheck, Banknote,
  Search, Eye, X, Download, FileText, Loader2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate, formatDateTime } from "@/hooks/use-investor";
import { StatusBadge } from "@/components/invest/dashboard/shared";
import InvestorAvatar from "@/components/invest/InvestorAvatar";

type LiquidationRow = {
  id: number;
  investmentId: number;
  investorId: number;
  principalAmount: string;
  profitEarned: string;
  penaltyAmount: string;
  accruedProfit: string;
  estimatedValue: string;
  penaltyPercent: number;
  finalAmount: string | null;
  status: "pending" | "approved" | "rejected" | "completed";
  adminNote: string | null;
  requestedAt: string | Date;
  processedAt: string | Date | null;
  investorName: string;
  investorEmail: string;
  investorAvatar?: string | null;
  projectName: string;
  planName: string;
  roi: string;
  maturityDate: string | Date | null;
  investmentStatus: string;
};

const statusTabs = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "completed", label: "Completed" },
] as const;

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-[#26342b] font-serif truncate">{value}</p>
      </div>
    </div>
  );
}

export default function AdminLiquidations() {
  const [statusFilter, setStatusFilter] = useState<(typeof statusTabs)[number]["id"]>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LiquidationRow | null>(null);
  const [finalAmount, setFinalAmount] = useState("");
  const [note, setNote] = useState("");
  const [exporting, setExporting] = useState(false);

  const listQuery = trpc.investAdmin.liquidationRequests.useQuery(
    { search: search.trim() || undefined },
    { retry: false, refetchInterval: 20_000 },
  );
  const statsQuery = trpc.investAdmin.liquidationStats.useQuery(undefined, {
    retry: false,
    refetchInterval: 20_000,
  });

  const rows = (listQuery.data ?? []) as LiquidationRow[];
  const stats = statsQuery.data;

  const filtered = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter],
  );

  const review = trpc.investAdmin.reviewLiquidation.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(
        vars.decision === "approved"
          ? "Liquidation approved — wallet credited"
          : "Liquidation request rejected",
      );
      listQuery.refetch();
      statsQuery.refetch();
      setSelected(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const openDetail = (r: LiquidationRow) => {
    setSelected(r);
    setFinalAmount(Number(r.finalAmount ?? r.estimatedValue).toFixed(2));
    setNote(r.adminNote ?? "");
  };

  const decide = (decision: "approved" | "rejected") => {
    if (!selected) return;
    if (decision === "rejected" && !note.trim()) {
      toast.error("Please add a note explaining the rejection reason");
      return;
    }
    review.mutate({
      requestId: selected.id,
      decision,
      finalAmount:
        decision === "approved" && finalAmount.trim()
          ? Number(finalAmount)
          : undefined,
      note: note.trim() || undefined,
    });
  };

  const buildExportRows = () => ({
    columns: [
      "Request ID", "Customer", "Email", "Plan", "Plan", "Amount",
      "Profit Earned", "Penalty", "Accrued", "Est. Value", "Final Payout",
      "Status", "Requested", "Processed", "Admin Note",
    ],
    rows: filtered.map((r) => [
      `LIQ-${String(r.id).padStart(4, "0")}`,
      r.investorName,
      r.investorEmail,
      r.projectName,
      r.planName,
      Number(r.principalAmount).toFixed(2),
      Number(r.profitEarned).toFixed(2),
      Number(r.penaltyAmount).toFixed(2),
      Number(r.accruedProfit).toFixed(2),
      Number(r.estimatedValue).toFixed(2),
      r.finalAmount != null ? Number(r.finalAmount).toFixed(2) : "",
      r.status,
      formatDate(r.requestedAt),
      r.processedAt ? formatDate(r.processedAt) : "",
      r.adminNote ?? "",
    ]),
  });

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { columns, rows: body } = buildExportRows();
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(18);
      doc.setTextColor(30, 58, 95);
      doc.text("Nestaro Homes Liquidation Report", 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`Generated: ${formatDateTime(new Date())} · Filter: ${statusFilter}`, 14, 26);
      autoTable(doc, {
        startY: 32,
        head: [columns],
        body,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [30, 58, 95] },
        alternateRowStyles: { fillColor: [250, 248, 245] },
      });
      doc.save(`nestaro-liquidations-${statusFilter}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF report downloaded");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = () => {
    setExporting(true);
    try {
      const { columns, rows: body } = buildExportRows();
      const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [columns.map(escape).join(","), ...body.map((r) => r.map(escape).join(","))].join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nestaro-liquidations-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel (CSV) report downloaded");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const approvedCount = rows.filter((r) => r.status === "approved").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={CircleDollarSign} label="Total Requests" value={String(stats?.total ?? 0)} tone="bg-[#26342b]/5 text-[#26342b]" />
        <StatCard icon={Clock} label="Pending" value={String(stats?.pending ?? 0)} tone="bg-amber-50 text-amber-600" />
        <StatCard icon={BadgeCheck} label="Approved" value={String(approvedCount)} tone="bg-blue-50 text-blue-600" />
        <StatCard icon={XCircle} label="Rejected" value={String(stats?.rejected ?? 0)} tone="bg-red-50 text-red-600" />
        <StatCard icon={CheckCircle2} label="Completed" value={String(stats?.completed ?? 0)} tone="bg-green-50 text-green-600" />
        <StatCard icon={Banknote} label="Total Liquidated" value={formatCurrency(stats?.totalLiquidated ?? 0)} tone="bg-[#c47a45]/10 text-[#a6632f]" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        {/* Header: filters + search + export */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setStatusFilter(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  statusFilter === t.id
                    ? "bg-[#26342b] text-white shadow"
                    : "bg-[#f7f4ee] text-gray-600 hover:text-[#26342b]"
                }`}
              >
                {t.label}
                {t.id === "pending" && (stats?.pending ?? 0) > 0 && (
                  <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {stats?.pending}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, plan or ID..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full xl:w-64 focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting || filtered.length === 0}>
              <Download className="w-4 h-4 mr-1.5" /> Excel / CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={exporting || filtered.length === 0}>
              {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />}
              PDF
            </Button>
          </div>
        </div>

        {/* Table */}
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <CircleDollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-[#26342b]">No liquidation requests</p>
            <p className="text-sm text-gray-500 mt-1">
              {statusFilter === "pending"
                ? "There are no requests waiting for review."
                : "Nothing matches the current filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                  <th className="pb-3 pr-4 font-semibold">Request</th>
                  <th className="pb-3 pr-4 font-semibold">Investor</th>
                  <th className="pb-3 pr-4 font-semibold">Investment</th>
                  <th className="pb-3 pr-4 font-semibold">Invested</th>
                  <th className="pb-3 pr-4 font-semibold">ROI Earned</th>
                  <th className="pb-3 pr-4 font-semibold">Liquidation Value</th>
                  <th className="pb-3 pr-4 font-semibold">Requested</th>
                  <th className="pb-3 pr-4 font-semibold">Processed</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[#f7f4ee] transition">
                    <td className="py-4 pr-4 font-mono text-xs text-gray-500">
                      LIQ-{String(r.id).padStart(4, "0")}
                    </td>
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-2.5">
                        <InvestorAvatar name={r.investorName} avatar={r.investorAvatar} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-[#26342b] truncate">{r.investorName}</p>
                          <p className="text-xs text-gray-400 truncate">{r.investorEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <p className="font-medium text-[#26342b]">{r.projectName}</p>
                      <p className="text-xs text-gray-400">{r.planName} Plan</p>
                    </td>
                    <td className="py-4 pr-4 font-medium">{formatCurrency(r.principalAmount)}</td>
                    <td className="py-4 pr-4 text-green-600 font-semibold">
                      +{formatCurrency(r.profitEarned)}
                    </td>
                    <td className="py-4 pr-4">
                      <p className="font-bold text-[#c47a45]">
                        {formatCurrency(r.finalAmount ?? r.estimatedValue)}
                      </p>
                      {r.finalAmount != null && Number(r.finalAmount) !== Number(r.estimatedValue) && (
                        <p className="text-xs text-gray-400 line-through">{formatCurrency(r.estimatedValue)}</p>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-gray-600">{formatDate(r.requestedAt)}</td>
                    <td className="py-4 pr-4 text-gray-600">
                      {r.processedAt ? formatDate(r.processedAt) : "—"}
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-4">
                      <Button size="sm" variant="outline" onClick={() => openDetail(r)}>
                        <Eye className="w-4 h-4 mr-1" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2">
                <CircleDollarSign className="w-5 h-5 text-[#c47a45]" />
                Liquidation LIQ-{String(selected.id).padStart(4, "0")}
              </h3>
              <div className="flex items-center gap-3">
                <StatusBadge status={selected.status} />
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Investor + investment */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-[#f7f4ee] rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Investor</p>
                  <div className="flex items-center gap-3">
                    <InvestorAvatar name={selected.investorName} avatar={selected.investorAvatar} size="md" />
                    <div className="min-w-0">
                      <p className="font-bold text-[#26342b] truncate">{selected.investorName}</p>
                      <p className="text-xs text-gray-500 truncate">{selected.investorEmail}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#f7f4ee] rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Investment</p>
                  <p className="font-bold text-[#26342b]">{selected.projectName}</p>
                  <p className="text-xs text-gray-500">
                    {selected.planName} Plan · ROI {Number(selected.roi).toFixed(1)}% ·{" "}
                    {selected.maturityDate ? `matures ${formatDate(selected.maturityDate)}` : "no maturity"}
                  </p>
                  <p className="text-xs mt-1">
                    <StatusBadge status={selected.investmentStatus} />
                  </p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2.5 text-sm">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Liquidation Breakdown</p>
                <div className="flex justify-between">
                  <span className="text-gray-500">Invested Amount</span>
                  <span className="font-semibold text-[#26342b]">{formatCurrency(selected.principalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Profit Earned to Date</span>
                  <span className="font-semibold text-green-600">+{formatCurrency(selected.profitEarned)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Accrued (partial month)</span>
                  <span className="font-semibold text-[#26342b]">{formatCurrency(selected.accruedProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Early-Exit Penalty ({selected.penaltyPercent}%)</span>
                  <span className="font-semibold text-red-500">−{formatCurrency(selected.penaltyAmount)}</span>
                </div>
                <div className="border-t pt-2.5 flex justify-between items-center">
                  <span className="font-bold text-[#26342b]">Estimated Payout</span>
                  <span className="text-lg font-bold text-[#c47a45]">{formatCurrency(selected.estimatedValue)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-[#f7f4ee] rounded-xl p-3">
                  <p className="text-xs text-gray-400">Requested</p>
                  <p className="font-semibold text-[#26342b]">{formatDate(selected.requestedAt)}</p>
                </div>
                <div className="bg-[#f7f4ee] rounded-xl p-3">
                  <p className="text-xs text-gray-400">Processed</p>
                  <p className="font-semibold text-[#26342b]">
                    {selected.processedAt ? formatDate(selected.processedAt) : "—"}
                  </p>
                </div>
              </div>

              {selected.status === "pending" ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Final Payout Amount ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={finalAmount}
                      onChange={(e) => setFinalAmount(e.target.value)}
                      className="mt-1.5 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Pre-filled with the estimated value — adjust if needed before approving.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Admin Note {selected.status === "pending" && "(required for rejection)"}
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder="Internal note / message to the customer..."
                      className="mt-1.5 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45] resize-none"
                    />
                  </div>
                  <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Approving closes the investment immediately and credits the final payout to the
                      investor's wallet. This action cannot be undone.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                      disabled={review.isPending}
                      onClick={() => decide("rejected")}
                    >
                      <XCircle className="w-4 h-4 mr-1.5" /> Reject
                    </Button>
                    <Button
                      className="flex-1 bg-[#26342b]"
                      disabled={review.isPending}
                      onClick={() => decide("approved")}
                    >
                      {review.isPending ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      )}
                      Approve & Pay Out
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {selected.finalAmount != null && (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex justify-between items-center">
                      <span className="text-sm font-semibold text-green-800">Final payout credited</span>
                      <span className="text-lg font-bold text-green-700">
                        {formatCurrency(selected.finalAmount)}
                      </span>
                    </div>
                  )}
                  {selected.adminNote && (
                    <div className="bg-[#f7f4ee] rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Admin Note</p>
                      <p className="text-sm text-gray-600">{selected.adminNote}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
