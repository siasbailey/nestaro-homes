import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-6 border transition-all duration-300 hover:shadow-lg",
        accent
          ? "bg-gradient-to-br from-[#c47a45] to-[#a6632f] border-transparent text-white"
          : "bg-white border-gray-200",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-sm font-medium break-words", accent ? "text-white/80" : "text-gray-500")}>
            {label}
          </p>
          <p
            className={cn(
              "text-xl sm:text-2xl font-bold font-serif mt-1.5 break-words [overflow-wrap:anywhere]",
              accent ? "text-white" : "text-[#26342b]",
            )}
          >
            {value}
          </p>
          {sub && (
            <p className={cn("text-xs mt-1.5 break-words", accent ? "text-white/70" : "text-gray-400")}>
              {sub}
            </p>
          )}
        </div>
        <div
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
            accent ? "bg-white/20" : "bg-[#26342b]/5",
          )}
        >
          <Icon className={cn("w-5 h-5", accent ? "text-white" : "text-[#26342b]")} />
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    matured: "bg-blue-100 text-blue-800",
    cancelled: "bg-gray-100 text-gray-700",
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    paid: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    credited: "bg-green-100 text-green-800",
    verified: "bg-green-100 text-green-800",
    unverified: "bg-gray-100 text-gray-700",
    open: "bg-blue-100 text-blue-800",
    funding: "bg-yellow-100 text-yellow-800",
    funded: "bg-green-100 text-green-800",
    suspended: "bg-red-100 text-red-800",
    liquidated: "bg-purple-100 text-purple-800",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize",
        styles[status] ?? "bg-gray-100 text-gray-700",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-white rounded-2xl border border-gray-200 p-4 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-[#26342b] font-serif break-words">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5 break-words">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 bg-[#26342b]/5 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-[#26342b]/40" />
      </div>
      <p className="font-semibold text-[#26342b]">{title}</p>
      <p className="text-sm text-gray-500 mt-1 max-w-sm">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("w-full h-2 bg-gray-100 rounded-full overflow-hidden", className)}>
      <div
        className="h-full bg-gradient-to-r from-[#26342b] to-[#c47a45] rounded-full transition-all duration-500"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

// ── Wallet & Transaction Summary ────────────────────────────────
// Shared between the Overview tab and the Wallet tab. Presentation
// only — all figures come from the existing dashboard stats.
import { ArrowDownCircle, ArrowUpCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/hooks/use-investor";

export function WalletSummary({
  stats,
  setTab,
}: {
  stats: any;
  setTab: (tab: string) => void;
}) {
  return (
    <SectionCard
      title="Wallet & Transaction Summary"
      subtitle="Your liquid funds and account totals at a glance"
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => setTab("deposit")} className="bg-[#26342b] hover:bg-[#3d5045] text-white">
            <ArrowDownCircle className="w-4 h-4 mr-1.5" />
            Deposit
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTab("withdraw")} className="border-[#26342b] text-[#26342b]">
            <ArrowUpCircle className="w-4 h-4 mr-1.5" />
            Withdraw
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setTab("transactions")} className="text-[#c47a45] hover:text-[#a6632f]">
            View Transactions
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {[
          { label: "Wallet Balance", value: formatCurrency(stats?.walletBalance ?? 0), hint: "Liquid funds available" },
          { label: "Total Deposited", value: formatCurrency(stats?.totalDeposited ?? 0), hint: "All-time deposits" },
          { label: "Total Withdrawn", value: formatCurrency(stats?.totalWithdrawn ?? 0), hint: `${stats?.withdrawalCount ?? 0} withdrawal${(stats?.withdrawalCount ?? 0) === 1 ? "" : "s"}` },
          { label: "Plan Funding", value: formatCurrency(stats?.totalInvested ?? 0), hint: "Moved into plans" },
          { label: "Total Credits Received", value: formatCurrency(stats?.totalMonthlyProfitEarned ?? 0), hint: "Credits paid to wallet" },
          { label: "Pending Deposits", value: String(stats?.pendingDepositsCount ?? 0), hint: formatCurrency(stats?.pendingDepositsAmount ?? 0) },
          { label: "Pending Withdrawals", value: String(stats?.pendingWithdrawalsCount ?? 0), hint: formatCurrency(stats?.pendingWithdrawalsAmount ?? 0) },
        ].map((item) => (
          <div key={item.label} className="bg-[#f7f4ee] border border-[#c47a45]/15 rounded-xl px-3 sm:px-4 py-3.5 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 break-words">{item.label}</p>
            <p className="text-base sm:text-lg font-bold font-serif text-[#26342b] mt-1 break-words [overflow-wrap:anywhere]">{item.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 break-words">{item.hint}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
