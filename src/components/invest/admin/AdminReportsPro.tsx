import { useState } from "react";
import { FileText, Download, ShoppingBag, TrendingUp, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate, formatDateTime } from "@/hooks/use-investor";
import { StatCard, SectionCard } from "../dashboard/shared";

type ReportType = "investment" | "orders" | "profits" | "transactions";

const reportOptions: { id: ReportType; label: string }[] = [
  { id: "investment", label: "Investment Platform" },
  { id: "orders", label: "Property Orders" },
  { id: "profits", label: "Monthly Profit Payments" },
  { id: "transactions", label: "Transaction Ledger" },
];

export default function AdminReportsPro() {
  const { data: stats } = trpc.investAdmin.stats.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const { data: analytics } = trpc.investAdmin.analytics.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const { data: property } = trpc.admin.propertyAnalytics.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const [reportType, setReportType] = useState<ReportType>("investment");
  const [exporting, setExporting] = useState(false);

  const buildRows = async (): Promise<{ columns: string[]; rows: string[][] }> => {
    if (reportType === "investment") {
      return {
        columns: ["Metric", "Value"],
        rows: [
          ["Total Investors", String(stats?.totalInvestors ?? 0)],
          ["Active Investors", String(stats?.activeInvestors ?? 0)],
          ["Total Invested", formatCurrency(stats?.totalInvested ?? 0)],
          ["Active Investments", String(stats?.activeInvestmentsCount ?? 0)],
          ["Completed Investments", String(stats?.completedInvestmentsCount ?? 0)],
          ["Total Deposited", formatCurrency(stats?.totalDeposited ?? 0)],
          ["Total Withdrawn", formatCurrency(stats?.totalWithdrawn ?? 0)],
          ["Total ROI Paid", formatCurrency(stats?.totalRoiPaid ?? 0)],
          ["Profit Paid This Month", formatCurrency(stats?.monthlyProfitPaid ?? 0)],
          ["Referral Bonuses", formatCurrency(stats?.totalReferralBonuses ?? 0)],
          ["Net Platform Position", formatCurrency(stats?.platformEarnings ?? 0)],
        ],
      };
    }
    if (reportType === "orders") {
      return {
        columns: ["Metric", "Value"],
        rows: [
          ["Total Orders", String(property?.totalOrders ?? 0)],
          ["Completed Orders", String(property?.completedOrders ?? 0)],
          ["Pending Orders", String(property?.pendingOrders ?? 0)],
          ["Failed Payments", String(property?.failedPayments ?? 0)],
          ["Total Revenue", formatCurrency(property?.totalRevenue ?? 0)],
          ...(property?.statusOverview ?? []).map((s: any) => [`Status: ${s.status.replace(/_/g, " ")}`, String(s.count)]),
        ],
      };
    }
    // profits & transactions fetch live data
    if (reportType === "profits") {
      const res = await fetch("/api/trpc/investAdmin.profitPayments?batch=1&input=%7B%7D", { credentials: "include" }).then((r) => r.json());
      const payments = res?.[0]?.result?.data ?? [];
      return {
        columns: ["ID", "Investor", "Project", "Month", "Rate %", "Amount", "Paid At"],
        rows: payments.map((p: any) => [String(p.id), p.investorName, p.projectName, `Month ${p.monthNumber}`, String(p.roiPercent), formatCurrency(p.amount), formatDate(p.paidAt)]),
      };
    }
    const res = await fetch("/api/trpc/investAdmin.transactions?batch=1&input=%7B%7D", { credentials: "include" }).then((r) => r.json());
    const txs = res?.[0]?.result?.data ?? [];
    return {
      columns: ["ID", "Investor", "Type", "Direction", "Amount", "Status", "Date", "Description"],
      rows: txs.map((t: any) => [String(t.id), t.investorName, t.type, t.direction, formatCurrency(t.amount), t.status, formatDate(t.createdAt), t.description]),
    };
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { columns, rows } = await buildRows();
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      const title = `Nestaro Homes ${reportOptions.find((r) => r.id === reportType)?.label} Report`;
      doc.setFontSize(18);
      doc.setTextColor(30, 58, 95);
      doc.text(title, 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`Generated: ${formatDateTime(new Date())}`, 14, 28);
      autoTable(doc, {
        startY: 34,
        head: [columns],
        body: rows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 95] },
        alternateRowStyles: { fillColor: [250, 248, 245] },
      });
      doc.save(`nestaro-${reportType}-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF report downloaded");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { columns, rows } = await buildRows();
      const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [columns.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nestaro-${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel (CSV) report downloaded");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Property analytics */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={ShoppingBag} label="Property Orders" value={String(property?.totalOrders ?? 0)} sub={`${property?.completedOrders ?? 0} completed · ${property?.pendingOrders ?? 0} pending`} />
        <StatCard icon={BarChart3} label="Property Revenue" value={formatCurrency(property?.totalRevenue ?? 0)} sub="Non-cancelled orders" accent />
        <StatCard icon={TrendingUp} label="Total Invested" value={formatCurrency(stats?.totalInvested ?? 0)} sub={`${stats?.activeInvestmentsCount ?? 0} active investments`} />
        <StatCard icon={Download} label="Net Platform Position" value={formatCurrency(stats?.platformEarnings ?? 0)} sub="Deposits − withdrawals − active principal" />
      </div>

      {/* Combined chart */}
      <SectionCard title="Combined Revenue Overview" subtitle="Property revenue vs platform cash flow (last 6 months)">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={(analytics ?? []).map((a: any, i: number) => ({
                ...a,
                propertyRevenue: property?.monthlyRevenue?.[i]?.revenue ?? 0,
              }))}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="propertyRevenue" name="Property Revenue" fill="#c47a45" radius={[4, 4, 0, 0]} />
              <Bar dataKey="deposits" name="Investor Deposits" fill="#26342b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="investments" name="Investments" fill="#8aa5c0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Export */}
      <SectionCard title="Downloadable Reports" subtitle="Generate PDF or Excel reports for any dataset">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Report Type</p>
            <div className="flex gap-2 flex-wrap">
              {reportOptions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReportType(r.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    reportType === r.id ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={exportPdf} disabled={exporting} className="bg-[#26342b]">
              <FileText className="w-4 h-4 mr-2" />
              {exporting ? "Generating..." : "Export PDF"}
            </Button>
            <Button onClick={exportExcel} disabled={exporting} variant="outline" className="border-[#26342b] text-[#26342b]">
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
