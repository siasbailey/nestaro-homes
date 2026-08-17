import { useState } from "react";
import { Link } from "react-router";
import {
  Building2, KeyRound, Landmark, ChevronDown, ChevronUp, FileText, Download,
  ExternalLink, CalendarClock, CheckCircle2, Clock, Circle,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate, formatDateTime } from "@/hooks/use-investor";
import { SectionCard, StatCard, EmptyState, ProgressBar } from "./shared";
import {
  PURCHASE_STAGES,
  purchaseStageIndex,
  purchaseStageLabel,
  purchaseStageNext,
} from "@contracts/purchase-stages";

const paymentMethodLabels: Record<string, string> = {
  paypal: "PayPal",
  bank: "Bank Transfer",
  crypto: "Cryptocurrency",
};

const stageBadgeColors: Record<string, string> = {
  purchase_request: "bg-blue-100 text-blue-800",
  payment_verification: "bg-teal-100 text-teal-800",
  purchase_agreement: "bg-indigo-100 text-indigo-800",
  legal_documentation: "bg-purple-100 text-purple-800",
  property_allocation: "bg-amber-100 text-amber-800",
  title_documentation: "bg-pink-100 text-pink-800",
  final_inspection: "bg-cyan-100 text-cyan-800",
  handover_preparation: "bg-orange-100 text-orange-800",
  handed_over: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function StageBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        stageBadgeColors[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status === "cancelled" ? "Cancelled" : purchaseStageLabel(status)}
    </span>
  );
}

function OrderTimeline({ order }: { order: any }) {
  const historyByStage = new Map<string, any>();
  for (const h of order.history ?? []) {
    if (!historyByStage.has(h.status)) historyByStage.set(h.status, h);
  }
  const currentIdx = purchaseStageIndex(order.orderStatus);

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Progress Timeline
      </p>
      <ol className="relative border-l-2 border-gray-200 ml-2 space-y-4">
        {PURCHASE_STAGES.map((stage, idx) => {
          const done = currentIdx >= 0 && idx < currentIdx;
          const current = idx === currentIdx;
          const entry = historyByStage.get(stage.key);
          return (
            <li key={stage.key} className="ml-5 relative">
              <span className="absolute -left-[27px] top-0.5">
                {done ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 bg-white rounded-full" />
                ) : current ? (
                  <Clock className="w-5 h-5 text-[#c47a45] bg-white rounded-full" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300 bg-white rounded-full" />
                )}
              </span>
              <p
                className={`text-sm font-medium ${
                  current ? "text-[#26342b]" : done ? "text-gray-700" : "text-gray-400"
                }`}
              >
                {stage.label}
                {current && (
                  <span className="ml-2 text-xs font-semibold text-[#c47a45]">Current stage</span>
                )}
              </p>
              {entry?.createdAt && (done || current) && (
                <p className="text-xs text-gray-400">{formatDateTime(entry.createdAt)}</p>
              )}
              {current && entry?.note && (
                <p className="text-xs text-gray-500 mt-0.5">{entry.note}</p>
              )}
              {current && purchaseStageNext(stage.key) && (
                <p className="text-xs text-[#26342b]/70 mt-0.5">
                  Next: {purchaseStageNext(stage.key)}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PurchaseCard({ order, investorEmail }: { order: any; investorEmail: string }) {
  const [open, setOpen] = useState(false);
  const currentIdx = purchaseStageIndex(order.orderStatus);
  const progress = order.orderStatus === "cancelled" ? 0 : ((currentIdx + 1) / 9) * 100;
  const propertyName = order.items?.[0]?.productName ?? "Property Purchase";
  const extraItems = (order.items?.length ?? 0) - 1;
  const trackUrl = `/track-order?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(investorEmail)}`;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-4 sm:p-5 hover:bg-gray-50 transition"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-[#26342b] font-serif truncate">
              {propertyName}
              {extraItems > 0 && (
                <span className="text-gray-400 font-normal text-sm"> +{extraItems} more</span>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{order.orderNumber}</p>
            <p className="text-xs text-gray-500 mt-1">
              Purchased {formatDate(order.createdAt)} ·{" "}
              {paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod} · Outright Purchase
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-[#26342b]">{formatCurrency(Number(order.totalAmount))}</p>
            <div className="mt-1"><StageBadge status={order.orderStatus} /></div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={progress} className="flex-1" />
          <span className="text-xs text-gray-500 flex-shrink-0">
            {order.orderStatus === "cancelled" ? "—" : `Stage ${currentIdx + 1} of 9`}
          </span>
          {open ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 sm:p-5 bg-gray-50/50">
          {order.orderStatus === "cancelled" && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
              This purchase was cancelled. Contact our team if you have any questions.
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3 text-sm mb-2">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-400">Purchase Price</p>
              <p className="font-semibold text-[#26342b]">{formatCurrency(Number(order.totalAmount))}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-400">Payment Method</p>
              <p className="font-semibold text-[#26342b]">
                {paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod} (Outright)
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-400">Payment Status</p>
              <p className="font-semibold text-[#26342b] capitalize">{order.paymentStatus}</p>
            </div>
          </div>

          <OrderTimeline order={order} />

          {/* Documents */}
          <div className="mt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Purchase Documents ({order.documents?.length ?? 0})
            </p>
            {order.documents?.length ? (
              <div className="space-y-2">
                {order.documents.map((d: any) => (
                  <a
                    key={d.id}
                    href={d.dataUrl}
                    download={d.name}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-[#c47a45] transition"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#c47a45] flex-shrink-0" />
                      <span className="text-sm truncate">{d.name}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
                      {d.uploadedAt ? formatDate(d.uploadedAt) : ""}
                      <Download className="w-4 h-4 text-[#26342b]" />
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No documents yet — your purchase agreement, title documents and handover papers will
                appear here as they are issued.
              </p>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Link
              to={trackUrl}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#26342b] hover:text-[#c47a45] transition"
            >
              Open full tracking page <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MortgagePurchaseCard({ mortgage, onGoToMortgages }: { mortgage: any; onGoToMortgages?: () => void }) {
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-blue-100 text-blue-800",
    active: "bg-green-100 text-green-800",
    suspended: "bg-orange-100 text-orange-800",
    rejected: "bg-red-100 text-red-800",
    completed: "bg-emerald-100 text-emerald-800",
  };
  return (
    <div className="border border-gray-200 rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[#26342b] font-serif truncate">{mortgage.propertyName}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{mortgage.reference}</p>
          <p className="text-xs text-gray-500 mt-1">
            {mortgage.planName} · {mortgage.paymentFrequency === "monthly" ? "Monthly" : "Yearly"} plan ·
            Mortgage Purchase
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-[#26342b]">{formatCurrency(Number(mortgage.propertyPrice))}</p>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 capitalize ${
              statusColors[mortgage.status] ?? "bg-gray-100 text-gray-700"
            }`}
          >
            {mortgage.status}
          </span>
        </div>
      </div>

      <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400">Remaining Balance</p>
          <p className="font-semibold text-[#26342b]">
            {formatCurrency(Number(mortgage.remainingBalance))}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400">Payment Progress</p>
          <p className="font-semibold text-[#26342b]">{mortgage.progress}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400">Next Payment Due</p>
          <p className="font-semibold text-[#26342b] flex items-center gap-1">
            <CalendarClock className="w-3.5 h-3.5 text-[#c47a45]" />
            {mortgage.nextPaymentAt ? formatDate(mortgage.nextPaymentAt) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressBar value={mortgage.progress} className="flex-1" />
        <span className="text-xs text-gray-500 flex-shrink-0">
          {formatCurrency(Number(mortgage.amountPaid))} paid
        </span>
      </div>

      {onGoToMortgages && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onGoToMortgages}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#26342b] hover:text-[#c47a45] transition"
          >
            Manage in My Mortgages <Landmark className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function PurchasesTab({
  investorEmail,
  setTab,
}: {
  investorEmail: string;
  setTab?: (tab: string) => void;
}) {
  const purchasesQuery = trpc.investor.myPurchases.useQuery();
  const mortgagesQuery = trpc.mortgage.myMortgages.useQuery();

  const orders = purchasesQuery.data ?? [];
  const mortgages = mortgagesQuery.data ?? [];
  const activeOrders = orders.filter(
    (o: any) => o.orderStatus !== "handed_over" && o.orderStatus !== "cancelled"
  );
  const handedOver = orders.filter((o: any) => o.orderStatus === "handed_over");
  const isLoading = purchasesQuery.isLoading || mortgagesQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Building2}
          label="Property Purchases"
          value={String(orders.length + mortgages.length)}
          sub={orders.length + mortgages.length === 1 ? "property in your portfolio" : "properties in your portfolio"}
        />
        <StatCard
          icon={Clock}
          label="In Progress"
          value={String(activeOrders.length + mortgages.filter((m: any) => m.status !== "completed").length)}
          sub="moving through documentation"
        />
        <StatCard
          icon={KeyRound}
          label="Handed Over"
          value={String(handedOver.length + mortgages.filter((m: any) => m.status === "completed").length)}
          sub="completed & handed over"
          accent
        />
      </div>

      {isLoading ? (
        <SectionCard title="My Property Purchases">
          <p className="text-sm text-gray-400 py-8 text-center">Loading your purchases…</p>
        </SectionCard>
      ) : orders.length === 0 && mortgages.length === 0 ? (
        <SectionCard title="My Property Purchases">
          <EmptyState
            icon={Building2}
            title="No property purchases yet"
            text="When you buy a property outright or with a mortgage, it will appear here with its full purchase progress, documents, and payment details."
            action={
              <Link
                to="/#catalog"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#26342b] text-white text-sm font-medium hover:bg-[#3d5045] transition"
              >
                Browse Properties
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <>
          {orders.length > 0 && (
            <SectionCard
              title="Outright Purchases"
              subtitle="Properties you bought outright — follow each purchase through documentation to handover."
            >
              <div className="space-y-4">
                {orders.map((o: any) => (
                  <PurchaseCard key={o.id} order={o} investorEmail={investorEmail} />
                ))}
              </div>
            </SectionCard>
          )}

          {mortgages.length > 0 && (
            <SectionCard
              title="Mortgage Purchases"
              subtitle="Properties you are buying with a mortgage — balances, progress and next payments."
            >
              <div className="space-y-4">
                {mortgages.map((m: any) => (
                  <MortgagePurchaseCard
                    key={m.id}
                    mortgage={m}
                    onGoToMortgages={setTab ? () => setTab("mortgages") : undefined}
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
