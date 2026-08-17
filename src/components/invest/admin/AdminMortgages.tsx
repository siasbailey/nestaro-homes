import { useMemo, useState } from "react";
import {
  Landmark, Clock, CheckCircle2, Banknote, Wallet, CalendarClock, Search, Eye,
  X, Loader2, FileText, Download, TrendingUp, Home, AlertTriangle, Ban, PlayCircle, BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate, formatDateTime } from "@/hooks/use-investor";
import { StatusBadge, ProgressBar } from "@/components/invest/dashboard/shared";
import InvestorAvatar from "@/components/invest/InvestorAvatar";

const statusFilters = ["all", "pending", "approved", "active", "suspended", "completed", "rejected"] as const;

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

export default function AdminMortgages() {
  const [view, setView] = useState<"mortgages" | "reports">("mortgages");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [exporting, setExporting] = useState(false);

  const statsQuery = trpc.adminMortgage.mortgageStats.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const listQuery = trpc.adminMortgage.mortgageList.useQuery(
    { status: statusFilter, search: search.trim() || undefined },
    { retry: false, refetchInterval: 20_000 },
  );
  const reportQuery = trpc.adminMortgage.mortgageReport.useQuery(undefined, {
    retry: false,
    enabled: view === "reports",
  });
  const detailQuery = trpc.adminMortgage.mortgageDetail.useQuery(
    { mortgageId: selected?.id ?? 0 },
    { retry: false, enabled: !!selected },
  );

  const invalidate = () => {
    statsQuery.refetch();
    listQuery.refetch();
    detailQuery.refetch();
  };

  const review = trpc.adminMortgage.reviewMortgage.useMutation({
    onSuccess: (_d, v) => {
      toast.success(`Mortgage ${v.action}d successfully`);
      setNote("");
      invalidate();
      if (v.action === "approve" || v.action === "reject") setSelected(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const adjust = trpc.adminMortgage.adjustMortgage.useMutation({
    onSuccess: (res) => {
      toast.success(`Adjustment posted. Remaining balance: ${formatCurrency(res.remainingBalance)}`);
      setAdjAmount("");
      setAdjNote("");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const rows = listQuery.data ?? [];
  const stats = statsQuery.data;
  const detail = detailQuery.data;

  const exportRows = () => ({
    columns: ["Reference", "Customer", "Email", "Property", "Plan", "Price", "Total Payable", "Paid", "Remaining", "Installment", "Frequency", "Status", "Applied", "Next Payment"],
    rows: rows.map((m: any) => [
      m.reference, m.investorName, m.investorEmail, m.propertyName, m.planName,
      Number(m.propertyPrice).toFixed(2), Number(m.totalPayable).toFixed(2),
      Number(m.amountPaid).toFixed(2), Number(m.remainingBalance).toFixed(2),
      Number(m.installmentAmount).toFixed(2), m.paymentFrequency, m.status,
      formatDate(m.createdAt),
      m.nextPaymentAt ? formatDate(m.nextPaymentAt) : "",
    ]),
  });

  const exportCsv = () => {
    setExporting(true);
    try {
      const { columns, rows: body } = exportRows();
      const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [columns.map(esc).join(","), ...body.map((r: any[]) => r.map(esc).join(","))].join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nestaro-mortgages-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel (CSV) report downloaded");
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { columns, rows: body } = exportRows();
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(18);
      doc.setTextColor(30, 58, 95);
      doc.text("Nestaro Homes Mortgage Report", 14, 18);
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
      doc.save(`nestaro-mortgages-${statusFilter}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF report downloaded");
    } finally {
      setExporting(false);
    }
  };

  const reviewActions = useMemo(() => {
    if (!detail) return [];
    const acts: { action: "approve" | "reject" | "suspend" | "resume" | "complete"; label: string; icon: any; cls: string }[] = [];
    if (detail.status === "pending") {
      acts.push({ action: "approve", label: "Approve", icon: CheckCircle2, cls: "bg-[#26342b] text-white" });
      acts.push({ action: "reject", label: "Reject", icon: Ban, cls: "border-red-300 text-red-600" });
    }
    if (detail.status === "approved" || detail.status === "active") {
      acts.push({ action: "suspend", label: "Suspend", icon: AlertTriangle, cls: "border-amber-300 text-amber-600" });
      acts.push({ action: "complete", label: "Mark Completed", icon: BadgeCheck, cls: "border-green-300 text-green-600" });
    }
    if (detail.status === "suspended") {
      acts.push({ action: "resume", label: "Resume", icon: PlayCircle, cls: "border-green-300 text-green-600" });
      acts.push({ action: "complete", label: "Mark Completed", icon: BadgeCheck, cls: "border-green-300 text-green-600" });
    }
    return acts;
  }, [detail]);

  const report = reportQuery.data;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Landmark} label="Total Mortgages" value={String(stats?.total ?? 0)} tone="bg-[#26342b]/5 text-[#26342b]" />
        <StatCard icon={Clock} label="Pending Review" value={String(stats?.pending ?? 0)} tone="bg-amber-50 text-amber-600" />
        <StatCard icon={TrendingUp} label="Active" value={String(stats?.active ?? 0)} tone="bg-green-50 text-green-600" />
        <StatCard icon={CheckCircle2} label="Completed" value={String(stats?.completed ?? 0)} tone="bg-blue-50 text-blue-600" />
        <StatCard icon={Banknote} label="Revenue Collected" value={formatCurrency(stats?.revenue ?? 0)} tone="bg-[#c47a45]/10 text-[#a6632f]" />
        <StatCard icon={Wallet} label="Outstanding" value={formatCurrency(stats?.outstanding ?? 0)} tone="bg-red-50 text-red-500" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex gap-2">
            <button onClick={() => setView("mortgages")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === "mortgages" ? "bg-[#26342b] text-white" : "bg-[#f7f4ee] text-gray-600"}`}>
              Mortgages
            </button>
            <button onClick={() => setView("reports")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === "reports" ? "bg-[#26342b] text-white" : "bg-[#f7f4ee] text-gray-600"}`}>
              Reports & Analytics
            </button>
          </div>
          <div className="flex-1" />
          {view === "mortgages" && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customer, property, ID..."
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full xl:w-64 focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]"
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting || rows.length === 0}>
                <Download className="w-4 h-4 mr-1.5" /> Excel / CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf} disabled={exporting || rows.length === 0}>
                {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />} PDF
              </Button>
            </>
          )}
        </div>

        {view === "mortgages" ? (
          <>
            <div className="flex flex-wrap gap-2 mb-5">
              {statusFilters.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                    statusFilter === f ? "bg-[#26342b] text-white shadow" : "bg-[#f7f4ee] text-gray-600 hover:text-[#26342b]"
                  }`}
                >
                  {f}
                  {f === "pending" && (stats?.pending ?? 0) > 0 && (
                    <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{stats?.pending}</span>
                  )}
                </button>
              ))}
            </div>

            {listQuery.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-16">
                <Landmark className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-[#26342b]">No mortgages found</p>
                <p className="text-sm text-gray-500 mt-1">Nothing matches the current filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                      <th className="pb-3 pr-4 font-semibold">Reference</th>
                      <th className="pb-3 pr-4 font-semibold">Customer</th>
                      <th className="pb-3 pr-4 font-semibold">Property / Plan</th>
                      <th className="pb-3 pr-4 font-semibold">Total Payable</th>
                      <th className="pb-3 pr-4 font-semibold">Paid</th>
                      <th className="pb-3 pr-4 font-semibold">Remaining</th>
                      <th className="pb-3 pr-4 font-semibold">Progress</th>
                      <th className="pb-3 pr-4 font-semibold">Next Payment</th>
                      <th className="pb-3 pr-4 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((m: any) => (
                      <tr key={m.id} className="hover:bg-[#f7f4ee] transition">
                        <td className="py-4 pr-4 font-mono text-xs text-gray-500">{m.reference}</td>
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2.5">
                            <InvestorAvatar name={m.investorName} avatar={m.investorAvatar} size="sm" />
                            <div className="min-w-0">
                              <p className="font-semibold text-[#26342b] truncate">{m.investorName}</p>
                              <p className="text-xs text-gray-400 truncate">{m.investorEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <p className="font-medium text-[#26342b]">{m.propertyName}</p>
                          <p className="text-xs text-gray-400">{m.planName} · {m.paymentFrequency}</p>
                        </td>
                        <td className="py-4 pr-4 font-medium">{formatCurrency(m.totalPayable)}</td>
                        <td className="py-4 pr-4 text-green-600 font-semibold">{formatCurrency(m.amountPaid)}</td>
                        <td className="py-4 pr-4 font-bold text-[#26342b]">{formatCurrency(m.remainingBalance)}</td>
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={m.progress} className="w-16" />
                            <span className="text-xs font-semibold text-[#26342b]">{m.progress}%</span>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-gray-600">{m.nextPaymentAt ? formatDate(m.nextPaymentAt) : "—"}</td>
                        <td className="py-4 pr-4"><StatusBadge status={m.status} /></td>
                        <td className="py-4">
                          <Button size="sm" variant="outline" onClick={() => { setSelected(m); setNote(m.adminNote ?? ""); }}>
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* Reports view */
          reportQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !report ? null : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Home} label="Outright Purchases" value={String(report.totalOutright)} tone="bg-[#26342b]/5 text-[#26342b]" />
                <StatCard icon={Landmark} label="Mortgage Purchases" value={String(report.totalMortgagePurchases)} tone="bg-[#c47a45]/10 text-[#a6632f]" />
                <StatCard icon={Banknote} label="Collections This Month" value={formatCurrency(report.monthlyCollections)} tone="bg-green-50 text-green-600" />
                <StatCard icon={Banknote} label="Collections This Year" value={formatCurrency(report.yearlyCollections)} tone="bg-blue-50 text-blue-600" />
              </div>
              <div>
                <h4 className="font-bold text-[#26342b] mb-3 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[#c47a45]" /> Collections — Last 12 Months
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                        <th className="pb-2 pr-4 font-semibold">Month</th>
                        <th className="pb-3 font-semibold">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {report.series.map((r) => (
                        <tr key={r.month} className="hover:bg-[#f7f4ee]">
                          <td className="py-2.5 pr-4 text-gray-600">{r.month}</td>
                          <td className="py-2.5 font-semibold text-[#26342b]">{formatCurrency(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#c47a45]" /> {selected.reference}
              </h3>
              <div className="flex items-center gap-3">
                <StatusBadge status={selected.status} />
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {detailQuery.isLoading || !detail ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-[#f7f4ee] rounded-xl p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Customer</p>
                    <div className="flex items-center gap-3 mb-1.5">
                      <InvestorAvatar name={detail.investor?.name} avatar={detail.investor?.avatar} size="md" />
                      <div className="min-w-0">
                        <p className="font-bold text-[#26342b] truncate">{detail.investor?.name}</p>
                        <p className="text-xs text-gray-500 truncate">{detail.investor?.email}</p>
                      </div>
                    </div>
                    {detail.investor?.phone && <p className="text-xs text-gray-500">{detail.investor.phone}</p>}
                    {detail.investor?.country && <p className="text-xs text-gray-500">{detail.investor.country}</p>}
                  </div>
                  <div className="bg-[#f7f4ee] rounded-xl p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Mortgage</p>
                    <p className="font-bold text-[#26342b]">{detail.propertyName}</p>
                    <p className="text-xs text-gray-500">
                      {detail.planName} · {detail.durationMonths} months · {detail.paymentFrequency} installments of {formatCurrency(detail.installmentAmount)}
                    </p>
                    <p className="text-xs text-gray-500">Applied {formatDate(detail.createdAt)}{detail.startDate && ` · started ${formatDate(detail.startDate)}`}</p>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 space-y-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Property Price</span><span className="font-semibold text-[#26342b]">{formatCurrency(detail.propertyPrice)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Down Payment</span><span className="font-semibold text-[#a6632f]">{formatCurrency(detail.downPaymentAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total Contract Value</span><span className="font-bold text-[#26342b]">{formatCurrency(detail.totalPayable)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Amount Paid</span><span className="font-semibold text-green-600">{formatCurrency(detail.amountPaid)}</span></div>
                  <div className="flex justify-between border-t pt-2.5"><span className="font-bold text-[#26342b]">Remaining Balance</span><span className="text-lg font-bold text-[#c47a45]">{formatCurrency(detail.remainingBalance)}</span></div>
                  <div className="flex items-center gap-3 pt-1">
                    <ProgressBar value={Math.min(Math.round((Number(detail.amountPaid) / (Number(detail.totalPayable) || 1)) * 100), 100)} className="flex-1" />
                    <span className="text-xs font-bold text-[#26342b]">{Math.min(Math.round((Number(detail.amountPaid) / (Number(detail.totalPayable) || 1)) * 100), 100)}%</span>
                  </div>
                </div>

                {/* Actions */}
                {reviewActions.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin Note</label>
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1.5 w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45] resize-none" placeholder="Optional note (shared with the customer)..." />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {reviewActions.map((a) => (
                        <Button
                          key={a.action}
                          variant={a.action === "approve" ? "default" : "outline"}
                          size="sm"
                          className={a.cls}
                          disabled={review.isPending}
                          onClick={() => review.mutate({ mortgageId: detail.id, action: a.action, note: note.trim() || undefined })}
                        >
                          <a.icon className="w-4 h-4 mr-1.5" /> {a.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual adjustment */}
                {["approved", "active", "suspended"].includes(detail.status) && (
                  <div className="bg-[#f7f4ee] rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Manual Payment Adjustment</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" min="1" step="0.01" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} placeholder="Amount ($)" className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]" />
                      <input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="Reason (required)" className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]" />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#26342b] text-[#26342b]"
                      disabled={adjust.isPending || !adjAmount || adjNote.trim().length < 3}
                      onClick={() => adjust.mutate({ mortgageId: detail.id, amount: Number(adjAmount), note: adjNote.trim() })}
                    >
                      {adjust.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Banknote className="w-4 h-4 mr-1.5" />}
                      Post Adjustment (no wallet charge)
                    </Button>
                  </div>
                )}

                {/* Payments */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Payment History ({detail.payments.length})</p>
                  {detail.payments.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No payments recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b bg-[#f7f4ee]">
                            <th className="py-2.5 px-3 font-semibold">Date</th>
                            <th className="py-2.5 px-3 font-semibold">Amount</th>
                            <th className="py-2.5 px-3 font-semibold">Remaining After</th>
                            <th className="py-2.5 px-3 font-semibold">Method</th>
                            <th className="py-2.5 px-3 font-semibold">Receipt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {detail.payments.map((p: any) => (
                            <tr key={p.id}>
                              <td className="py-2.5 px-3 text-gray-600">{formatDate(p.createdAt)}</td>
                              <td className="py-2.5 px-3 font-semibold text-[#c47a45]">{formatCurrency(p.amount)}</td>
                              <td className="py-2.5 px-3 font-semibold text-[#26342b]">{formatCurrency(p.remainingBalanceAfter)}</td>
                              <td className="py-2.5 px-3 text-gray-500 capitalize">{p.method === "manual_adjustment" ? "Adjustment" : "Wallet"}</td>
                              <td className="py-2.5 px-3 font-mono text-xs text-[#a6632f]">{p.receiptNo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
