import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Landmark, Wallet, X, Loader2, Receipt, CalendarClock, CheckCircle2, Eye, Download, FileText, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useInvestor, formatCurrency, formatDate } from "@/hooks/use-investor";
import { SectionCard, StatusBadge, ProgressBar, EmptyState } from "./shared";
import { VerificationBadgeStrip } from "@/components/invest/VerificationBadge";
import { buildSchedule } from "@/lib/mortgage-math";

type View = "mortgages" | "applications" | "history";

export default function MortgagesTab({
  walletBalance,
  onChanged,
}: {
  walletBalance: number;
  onChanged: () => void;
}) {
  const [searchParams] = useSearchParams();
  const sub = searchParams.get("sub");
  const initialView: View = sub === "applications" || sub === "history" ? sub : "mortgages";
  const [view, setView] = useState<View>(initialView);

  // Deep links from the Mortgage nav menu (?tab=mortgages&sub=…)
  useEffect(() => {
    setView(sub === "applications" || sub === "history" ? sub : "mortgages");
  }, [sub]);

  const { investor } = useInvestor();
  const mortgagesQuery = trpc.mortgage.myMortgages.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const historyQuery = trpc.mortgage.paymentHistory.useQuery(undefined, { retry: false, refetchInterval: 20_000 });

  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [detailTarget, setDetailTarget] = useState<any | null>(null);
  const [amount, setAmount] = useState("");

  const pay = trpc.mortgage.payMortgage.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.completed
          ? "Payment received — congratulations, your financing is fully paid! 🎉"
          : `Payment received. Remaining balance: ${formatCurrency(res.remainingBalance)}. Receipt ${res.receiptNo}.`,
        { duration: 7000 },
      );
      setPayTarget(null);
      mortgagesQuery.refetch();
      historyQuery.refetch();
      onChanged();
    },
    onError: (err) => toast.error(err.message),
  });

  const openPay = (m: any) => {
    setPayTarget(m);
    setAmount(
      m.status === "approved"
        ? Number(m.downPaymentAmount).toFixed(2)
        : Number(m.installmentAmount).toFixed(2),
    );
  };

  const mortgages = mortgagesQuery.data ?? [];
  const open = mortgages.filter((m) => !["completed", "rejected"].includes(m.status));
  const applications = mortgages.filter((m) => m.status === "pending");
  const closed = mortgages.filter((m) => ["completed", "rejected"].includes(m.status));
  const payments = historyQuery.data ?? [];
  const paymentsFor = (id: number) => payments.filter((p) => p.mortgageId === id);

  const scheduleFor = (m: any) =>
    buildSchedule(
      Number(m.totalPayable),
      Number(m.downPaymentAmount),
      Number(m.installmentAmount),
      m.paymentFrequency === "yearly" ? Math.max(m.durationMonths / 12, 1) : m.durationMonths,
      m.paymentFrequency,
      m.startDate ? new Date(m.startDate) : new Date(m.createdAt),
    );

  // ── Per-mortgage PDF statement ────────────────────────────────
  const downloadStatement = async (m: any) => {
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      const navy: [number, number, number] = [30, 58, 95];
      const copper: [number, number, number] = [200, 149, 108];

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...navy);
      doc.text("Nestaro Homes", 14, 18);
      doc.setFontSize(13);
      doc.text("Financing Statement", 14, 26);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Generated ${formatDate(new Date())}  ·  Reference ${m.reference}`, 14, 32);

      autoTable(doc, {
        startY: 38,
        head: [["Account", ""]],
        body: [
          ["Account holder", investor?.name ?? "—"],
          ["Email", investor?.email ?? "—"],
          ["Property", m.propertyName],
          ["Financing plan", `${m.planName} · ${m.paymentFrequency} payments`],
          ["Status", String(m.status).toUpperCase()],
          ["Application date", formatDate(m.createdAt)],
        ],
        theme: "grid",
        headStyles: { fillColor: navy },
        styles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Financial Summary", ""]],
        body: [
          ["Total contract value", formatCurrency(m.totalPayable)],
          ["Down payment", formatCurrency(m.downPaymentAmount)],
          [`${m.paymentFrequency === "yearly" ? "Yearly" : "Monthly"} installment`, formatCurrency(m.installmentAmount)],
          ["Amount paid", formatCurrency(m.amountPaid)],
          ["Remaining balance", formatCurrency(m.remainingBalance)],
          ["Progress", `${m.progress}%`],
          ["Next payment due", m.nextPaymentAt ? formatDate(m.nextPaymentAt) : "—"],
          ["Start date", m.startDate ? formatDate(m.startDate) : "—"],
        ],
        theme: "grid",
        headStyles: { fillColor: navy },
        styles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
      });

      const rows = paymentsFor(m.id);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Date", "Amount", "Wallet Before", "Wallet After", "Remaining", "Receipt No."]],
        body: rows.length
          ? rows.map((p) => [
              formatDate(p.createdAt),
              formatCurrency(p.amount),
              p.walletBalanceBefore != null ? formatCurrency(p.walletBalanceBefore) : "—",
              p.walletBalanceAfter != null ? formatCurrency(p.walletBalanceAfter) : "—",
              formatCurrency(p.remainingBalanceAfter),
              p.receiptNo,
            ])
          : [["No payments recorded yet", "", "", "", "", ""]],
        theme: "striped",
        headStyles: { fillColor: copper },
        styles: { fontSize: 8.5 },
      });

      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(
        "Nestaro Homes LLC · Portland, Oregon 97209, United States — generated for informational purposes only.",
        14,
        (doc as any).lastAutoTable.finalY + 10,
      );
      doc.save(`mortgage-statement-${m.reference}.pdf`);
      toast.success("Statement downloaded!");
    } catch {
      toast.error("Could not generate the statement. Please try again.");
    }
  };

  const renderCard = (m: any) => (
    <div key={m.id} className="bg-[#f7f4ee] rounded-xl p-5 border border-gray-100">
      <div className="flex flex-col sm:flex-row gap-4">
        {m.propertyImage && (
          <img src={m.propertyImage} alt={m.propertyName} className="w-full sm:w-36 h-32 sm:h-28 object-cover rounded-lg" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="font-bold text-[#26342b]">{m.propertyName}</p>
              <p className="text-xs text-gray-400">
                {m.planName} · {m.paymentFrequency} · <span className="font-mono">{m.reference}</span>
              </p>
            </div>
            <StatusBadge status={m.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
            <div>
              <p className="text-[11px] text-gray-400">Total Contract</p>
              <p className="font-semibold text-[#26342b]">{formatCurrency(m.totalPayable)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">Down Payment</p>
              <p className="font-semibold text-[#a6632f]">{formatCurrency(m.downPaymentAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">Paid So Far</p>
              <p className="font-semibold text-green-600">{formatCurrency(m.amountPaid)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">Remaining</p>
              <p className="font-bold text-[#26342b]">{formatCurrency(m.remainingBalance)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">{m.paymentFrequency === "yearly" ? "Yearly" : "Monthly"} Installment</p>
              <p className="font-semibold text-[#c47a45]">{formatCurrency(m.installmentAmount)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">Next Payment</p>
              <p className="font-semibold text-[#26342b]">{m.nextPaymentAt ? formatDate(m.nextPaymentAt) : "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">Start Date</p>
              <p className="font-semibold text-[#26342b]">{m.startDate ? formatDate(m.startDate) : "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">Est. Completion</p>
              <p className="font-semibold text-[#26342b]">{m.completionDate ? formatDate(m.completionDate) : "—"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ProgressBar value={m.progress} className="flex-1" />
            <span className="text-xs font-bold text-[#26342b]">{m.progress}%</span>
          </div>

          {m.adminNote && (
            <p className="text-xs text-gray-500 mt-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <span className="font-semibold text-[#26342b]">Admin note:</span> {m.adminNote}
            </p>
          )}

          {m.status === "pending" && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4" /> Pending admin approval — you'll be notified once reviewed.
            </p>
          )}
          {m.status === "suspended" && (
            <p className="text-xs text-red-500 mt-2">This financing is suspended. Please contact support.</p>
          )}

          {/* Actions: Pay · View Details · Payment History · Statement */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(m.status === "approved" || m.status === "active") && (
              <Button
                size="sm"
                className="bg-[#26342b]"
                onClick={() => openPay(m)}
              >
                <Wallet className="w-4 h-4 mr-1.5" />
                {m.status === "approved" ? "Pay Down Payment" : "Make a Payment"}
              </Button>
            )}
            <Button size="sm" variant="outline" className="border-gray-300 text-[#26342b]" onClick={() => setDetailTarget(m)}>
              <Eye className="w-4 h-4 mr-1.5" /> View Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-gray-300 text-[#26342b]"
              onClick={() => setView("history")}
            >
              <Receipt className="w-4 h-4 mr-1.5" /> Payment History
            </Button>
            <Button size="sm" variant="outline" className="border-gray-300 text-[#26342b]" onClick={() => downloadStatement(m)}>
              <Download className="w-4 h-4 mr-1.5" /> Statement
            </Button>
            {m.status === "approved" && (
              <span className="text-xs text-gray-400">First payment covers the down payment of {formatCurrency(m.downPaymentAmount)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const viewButton = (id: View, label: string, count?: number) => (
    <button
      onClick={() => setView(id)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === id ? "bg-[#26342b] text-white" : "text-gray-500 hover:text-[#26342b]"}`}
    >
      {label} {count !== undefined && count > 0 && <span className="ml-1 text-xs">({count})</span>}
    </button>
  );

  return (
    <div className="space-y-6">
      <VerificationBadgeStrip />
      <SectionCard
        title="My Financing"
        subtitle="Financed home purchases and wallet payments"
        action={
          <div className="flex flex-wrap gap-2">
            {viewButton("mortgages", "Financing", open.length)}
            {viewButton("applications", "Applications", applications.length)}
            {viewButton("history", "Payment History")}
          </div>
        }
      >
        {view === "history" ? (
          historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : payments.length === 0 ? (
            <EmptyState icon={Receipt} title="No payments yet" text="Your financing payments will appear here with full balance details and receipt numbers." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                    <th className="pb-3 pr-4 font-semibold">Date</th>
                    <th className="pb-3 pr-4 font-semibold">Property</th>
                    <th className="pb-3 pr-4 font-semibold">Amount</th>
                    <th className="pb-3 pr-4 font-semibold">Wallet Before</th>
                    <th className="pb-3 pr-4 font-semibold">Wallet After</th>
                    <th className="pb-3 pr-4 font-semibold">Remaining After</th>
                    <th className="pb-3 pr-4 font-semibold">Reference</th>
                    <th className="pb-3 pr-4 font-semibold">Receipt No.</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-[#f7f4ee] transition">
                      <td className="py-3.5 pr-4 text-gray-600 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-[#26342b]">{p.propertyName}</p>
                        <p className="text-xs text-gray-400">{p.planName}{p.method === "manual_adjustment" ? " · admin adjustment" : ""}</p>
                      </td>
                      <td className="py-3.5 pr-4 font-bold text-[#c47a45]">{formatCurrency(p.amount)}</td>
                      <td className="py-3.5 pr-4 text-gray-600">{p.walletBalanceBefore != null ? formatCurrency(p.walletBalanceBefore) : "—"}</td>
                      <td className="py-3.5 pr-4 text-gray-600">{p.walletBalanceAfter != null ? formatCurrency(p.walletBalanceAfter) : "—"}</td>
                      <td className="py-3.5 pr-4 font-semibold text-[#26342b]">{formatCurrency(p.remainingBalanceAfter)}</td>
                      <td className="py-3.5 pr-4 font-mono text-xs text-gray-500">{p.reference}</td>
                      <td className="py-3.5 pr-4 font-mono text-xs text-[#a6632f]">{p.receiptNo}</td>
                      <td className="py-3.5"><StatusBadge status="completed" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : mortgagesQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : view === "applications" ? (
          applications.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No applications under review"
              text="When you apply for financing, it will appear here until our team approves it."
              action={
                <a href="/mortgage#properties" className="inline-block">
                  <Button className="bg-[#26342b]">Apply for Financing</Button>
                </a>
              }
            />
          ) : (
            <div className="space-y-4">{applications.map(renderCard)}</div>
          )
        ) : mortgages.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No financing yet"
            text="Browse the catalog and choose the financing option on any eligible home to get started."
            action={
              <a href="/mortgage#properties" className="inline-block">
                <Button className="bg-[#26342b]">Browse Properties</Button>
              </a>
            }
          />
        ) : (
          <div className="space-y-4">
            {open.map(renderCard)}
            {closed.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 pt-2">Closed</p>
                {closed.map(renderCard)}
              </>
            )}
          </div>
        )}
      </SectionCard>

      {/* Details modal */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setDetailTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#c47a45]" /> Financing Details
              </h3>
              <button onClick={() => setDetailTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[#26342b] text-lg">{detailTarget.propertyName}</p>
                  <p className="text-xs text-gray-400">
                    {detailTarget.planName} · {detailTarget.paymentFrequency} · <span className="font-mono">{detailTarget.reference}</span>
                  </p>
                </div>
                <StatusBadge status={detailTarget.status} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="bg-[#f7f4ee] rounded-lg p-3"><p className="text-[11px] text-gray-400">Total Contract</p><p className="font-semibold text-[#26342b]">{formatCurrency(detailTarget.totalPayable)}</p></div>
                <div className="bg-[#f7f4ee] rounded-lg p-3"><p className="text-[11px] text-gray-400">Down Payment</p><p className="font-semibold text-[#a6632f]">{formatCurrency(detailTarget.downPaymentAmount)}</p></div>
                <div className="bg-[#f7f4ee] rounded-lg p-3"><p className="text-[11px] text-gray-400">Paid So Far</p><p className="font-semibold text-green-600">{formatCurrency(detailTarget.amountPaid)}</p></div>
                <div className="bg-[#f7f4ee] rounded-lg p-3"><p className="text-[11px] text-gray-400">Remaining</p><p className="font-bold text-[#26342b]">{formatCurrency(detailTarget.remainingBalance)}</p></div>
                <div className="bg-[#f7f4ee] rounded-lg p-3"><p className="text-[11px] text-gray-400">Installment</p><p className="font-semibold text-[#c47a45]">{formatCurrency(detailTarget.installmentAmount)}</p></div>
                <div className="bg-[#f7f4ee] rounded-lg p-3"><p className="text-[11px] text-gray-400">Duration</p><p className="font-semibold text-[#26342b]">{detailTarget.durationMonths} months</p></div>
                <div className="bg-[#f7f4ee] rounded-lg p-3"><p className="text-[11px] text-gray-400">Next Payment</p><p className="font-semibold text-[#26342b]">{detailTarget.nextPaymentAt ? formatDate(detailTarget.nextPaymentAt) : "—"}</p></div>
                <div className="bg-[#f7f4ee] rounded-lg p-3"><p className="text-[11px] text-gray-400">Est. Completion</p><p className="font-semibold text-[#26342b]">{detailTarget.completionDate ? formatDate(detailTarget.completionDate) : "—"}</p></div>
              </div>

              <div className="flex items-center gap-3">
                <ProgressBar value={detailTarget.progress} className="flex-1" />
                <span className="text-xs font-bold text-[#26342b]">{detailTarget.progress}%</span>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-[#c47a45]" /> Estimated Repayment Schedule
                </p>
                <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                        <th className="py-2 px-4 font-semibold">Payment</th>
                        <th className="py-2 px-4 font-semibold">Date</th>
                        <th className="py-2 px-4 font-semibold text-right">Amount</th>
                        <th className="py-2 px-4 font-semibold text-right">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {scheduleFor(detailTarget).map((r) => (
                        <tr key={r.n} className={r.n === 0 ? "bg-[#c47a45]/5" : ""}>
                          <td className="py-2 px-4 font-medium text-[#26342b]">{r.label}</td>
                          <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{formatDate(r.date)}</td>
                          <td className="py-2 px-4 text-right font-semibold text-[#26342b]">{formatCurrency(r.amount)}</td>
                          <td className="py-2 px-4 text-right text-gray-500">{formatCurrency(r.remaining)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-[#c47a45]" /> Payments on This Financing
                </p>
                {paymentsFor(detailTarget.id).length === 0 ? (
                  <p className="text-sm text-gray-400 bg-[#f7f4ee] rounded-lg px-4 py-3">No payments recorded yet.</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-sm">
                      <tbody className="divide-y">
                        {paymentsFor(detailTarget.id).map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                            <td className="py-2 px-4 font-semibold text-[#26342b]">{formatCurrency(p.amount)}</td>
                            <td className="py-2 px-4 text-gray-500">Remaining {formatCurrency(p.remainingBalanceAfter)}</td>
                            <td className="py-2 px-4 font-mono text-xs text-[#a6632f]">{p.receiptNo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {(detailTarget.status === "approved" || detailTarget.status === "active") && (
                  <Button
                    className="bg-[#26342b]"
                    onClick={() => { openPay(detailTarget); setDetailTarget(null); }}
                  >
                    <Wallet className="w-4 h-4 mr-1.5" />
                    {detailTarget.status === "approved" ? "Pay Down Payment" : "Make a Payment"}
                  </Button>
                )}
                <Button variant="outline" className="border-gray-300 text-[#26342b]" onClick={() => downloadStatement(detailTarget)}>
                  <Download className="w-4 h-4 mr-1.5" /> Download Statement
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment dialog */}
      {payTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPayTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#c47a45]" /> Financing Payment
              </h3>
              <button onClick={() => setPayTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[#f7f4ee] rounded-xl p-4 text-sm space-y-1.5">
                <p className="font-bold text-[#26342b]">{payTarget.propertyName}</p>
                <p className="text-xs text-gray-400 font-mono">{payTarget.reference}</p>
                <div className="flex justify-between pt-1"><span className="text-gray-500">Remaining balance</span><span className="font-semibold text-[#26342b]">{formatCurrency(payTarget.remainingBalance)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Your wallet balance</span><span className="font-semibold text-[#a6632f]">{formatCurrency(walletBalance)}</span></div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Amount ($)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1.5 w-full border border-gray-200 rounded-lg px-4 py-3 text-lg font-bold text-[#26342b] focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]"
                />
                {payTarget.status === "approved" && (
                  <p className="text-xs text-gray-400 mt-1.5">The first payment must cover the down payment of {formatCurrency(payTarget.downPaymentAmount)}.</p>
                )}
                {payTarget.status === "active" && (
                  <p className="text-xs text-gray-400 mt-1.5">Suggested installment: {formatCurrency(payTarget.installmentAmount)} — you may pay any amount at any time.</p>
                )}
              </div>
              <Button
                className="w-full bg-[#26342b] py-6 text-base"
                disabled={pay.isPending || !amount || Number(amount) <= 0}
                onClick={() => pay.mutate({ mortgageId: payTarget.id, amount: Number(amount) })}
              >
                {pay.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                Confirm Payment from Wallet
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
