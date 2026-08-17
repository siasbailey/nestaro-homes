import {
  Users, DollarSign, TrendingUp, ArrowDownToLine, ArrowUpFromLine, UserCheck,
  BellRing, CheckCircle2, ChevronRight,
} from "lucide-react";
import { useSearchParams } from "react-router";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { trpc } from "@/providers/trpc";
import { formatCurrency } from "@/hooks/use-investor";
import { StatCard, SectionCard } from "../dashboard/shared";

export default function AdminOverview() {
  const { data: stats } = trpc.investAdmin.stats.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const { data: analytics } = trpc.investAdmin.analytics.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const { data: pending } = trpc.investAdmin.pendingActions.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const [, setSearchParams] = useSearchParams();

  // Jump to the relevant management screen (with its pending filter where
  // the screen supports one) — same deep-link contract as the header bell.
  const goTo = (section: string, filter?: string) =>
    setSearchParams(filter ? { section, filter } : { section });

  const total = pending?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Pending actions summary — real unresolved records, grouped by category */}
      <SectionCard
        title="Pending Actions"
        subtitle={
          total > 0
            ? `${total} item${total === 1 ? "" : "s"} waiting for admin review or completion`
            : "Nothing is waiting for admin action"
        }
        action={
          total > 0 ? (
            <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-full px-3 py-1">
              <BellRing className="w-3.5 h-3.5" /> {total} pending
            </span>
          ) : undefined
        }
      >
        {total === 0 ? (
          <div className="flex items-center gap-3 py-2 text-sm text-gray-500">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            All caught up — deposits, withdrawals, approvals and requests are all handled.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {(pending?.categories ?? []).map((c) => (
              <button
                key={c.key}
                onClick={() => goTo(c.section, c.filter)}
                className="flex items-center justify-between gap-3 bg-[#f7f4ee] hover:bg-[#c47a45]/10 border border-transparent hover:border-[#c47a45]/30 rounded-xl px-4 py-3 transition text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#26342b] truncate">{c.label}</span>
                  <span className="block text-xs text-gray-500">
                    {c.count} pending
                  </span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="bg-red-500 text-white text-[11px] font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5">
                    {c.count > 99 ? "99+" : c.count}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </span>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Customers" value={String(stats?.totalInvestors ?? 0)} sub={`${stats?.activeInvestors ?? 0} active · ${stats?.suspendedInvestors ?? 0} suspended`} />
        <StatCard icon={TrendingUp} label="Total in Plans" value={formatCurrency(stats?.totalInvested ?? 0)} sub={`${stats?.activeInvestmentsCount ?? 0} active investments`} accent />
        <StatCard icon={ArrowDownToLine} label="Deposits" value={formatCurrency(stats?.totalDeposited ?? 0)} sub={`${stats?.pendingDepositsCount ?? 0} pending (${formatCurrency(stats?.pendingDepositsAmount ?? 0)})`} />
        <StatCard icon={ArrowUpFromLine} label="Withdrawals Paid" value={formatCurrency(stats?.totalWithdrawn ?? 0)} sub={`${stats?.pendingWithdrawalsCount ?? 0} pending (${formatCurrency(stats?.pendingWithdrawalsAmount ?? 0)})`} />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="ROI Paid This Month" value={formatCurrency(stats?.monthlyProfitPaid ?? 0)} sub={`${formatCurrency(stats?.totalRoiPaid ?? 0)} all-time`} />
        <StatCard icon={UserCheck} label="Referral Bonuses" value={formatCurrency(stats?.totalReferralBonuses ?? 0)} sub={`${stats?.totalReferrals ?? 0} referrals total`} />
        <StatCard icon={Users} label="Pending KYC" value={String(stats?.pendingKyc ?? 0)} sub="Verifications awaiting review" />
        <StatCard icon={TrendingUp} label="Home Plans" value={`${stats?.activeInvestmentsCount ?? 0} active`} sub={`${stats?.pendingInvestmentsCount ?? 0} pending · ${stats?.completedInvestmentsCount ?? 0} completed · ${stats?.suspendedInvestmentsCount ?? 0} suspended`} />
      </div>

      <SectionCard title="Platform Analytics" subtitle="Last 6 months — deposits, withdrawals, investments">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip
                formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="deposits" name="Deposits" fill="#26342b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="investments" name="Home Plans" fill="#c47a45" radius={[4, 4, 0, 0]} />
              <Bar dataKey="withdrawals" name="Withdrawals" fill="#8aa5c0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
    </div>
  );
}
