import { Link } from "react-router";
import {
  Wallet, TrendingUp, Briefcase, DollarSign, Percent, ArrowRight, Bell,
  Coins, CalendarClock, Snowflake, Gauge, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate } from "@/hooks/use-investor";
import { StatCard, SectionCard, StatusBadge, ProgressBar, EmptyState, WalletSummary } from "./shared";
import { VerificationBadgeStrip } from "@/components/invest/VerificationBadge";

const CHART_COLORS = ["#26342b", "#c47a45", "#3d5045", "#8aa5c0"];

export default function OverviewTab({
  dashboard,
  setTab,
}: {
  dashboard: any;
  setTab: (tab: string) => void;
}) {
  const { data: transactions } = trpc.investor.transactions.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const { data: notifications } = trpc.investor.notifications.useQuery(undefined, { retry: false, refetchInterval: 20_000 });

  const stats = dashboard?.stats;
  const portfolio = dashboard?.portfolio ?? [];
  const activePortfolio = portfolio.filter((p: any) => p.status === "active");

  // Build a synthetic growth curve for active investments
  const growthData = (() => {
    const points: { month: string; value: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("en-US", { month: "short" });
      let value = 0;
      for (const inv of activePortfolio) {
        const start = new Date(inv.startDate);
        if (start <= d) {
          const maturity = new Date(inv.maturityDate);
          const total = Math.max(maturity.getTime() - start.getTime(), 1);
          const elapsed = Math.min(Math.max(d.getTime() - start.getTime(), 0), total);
          const pct = elapsed / total;
          value += Number(inv.amount) + (inv.projectedEarnings * pct);
        }
      }
      points.push({ month: label, value: Math.round(value * 100) / 100 });
    }
    // Current month uses live value
    if (points.length) points[points.length - 1].value = Math.round((stats?.portfolioValue ?? 0) * 100) / 100;
    return points;
  })();

  const allocationData = activePortfolio.map((inv: any) => ({
    name: inv.planName,
    value: Number(inv.amount),
  }));

  const overallRoi =
    stats && stats.totalInvested > 0
      ? ((stats.estimatedEarnings / stats.totalInvested) * 100).toFixed(1)
      : "0.0";

  const nextPaymentDays = stats?.nextPaymentDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(stats.nextPaymentDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  // Average maturity progress across active plans (0-100).
  const investmentProgress =
    activePortfolio.length > 0
      ? Math.round(
          activePortfolio.reduce((sum: number, inv: any) => sum + Number(inv.progress ?? 0), 0) /
            activePortfolio.length,
        )
      : 0;

  return (
    <div className="space-y-6">
      <VerificationBadgeStrip />
      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Briefcase}
          label="Plans Value"
          value={formatCurrency(stats?.portfolioValue ?? 0)}
          sub={`${stats?.activeInvestments ?? 0} active plan${(stats?.activeInvestments ?? 0) === 1 ? "" : "s"}`}
        />
        {/* Main wallet card — one single balance, with quick actions */}
        <div className="rounded-2xl p-6 border border-transparent bg-gradient-to-br from-[#c47a45] to-[#a6632f] text-white transition-all duration-300 hover:shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Wallet Balance</p>
              <p className="text-2xl font-bold font-serif mt-1.5 text-white">
                {formatCurrency(stats?.walletBalance ?? 0)}
              </p>
              <p className="text-xs mt-1.5 text-white/70">Available to invest or withdraw</p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-white/20">
              <Wallet className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/20">
            <button
              onClick={() => setTab("deposit")}
              className="flex items-center gap-1 text-[11px] font-semibold bg-white/20 hover:bg-white/30 rounded-full px-2.5 py-1.5 transition"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" /> Deposit
            </button>
            <button
              onClick={() => setTab("withdraw")}
              className="flex items-center gap-1 text-[11px] font-semibold bg-white/20 hover:bg-white/30 rounded-full px-2.5 py-1.5 transition"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" /> Withdraw
            </button>
          </div>
        </div>
        <StatCard
          icon={TrendingUp}
          label="Total Earnings"
          value={formatCurrency(stats?.totalEarnings ?? 0)}
          sub={`Projected ${formatCurrency(stats?.estimatedEarnings ?? 0)} across active plans`}
        />
        <StatCard
          icon={Percent}
          label="Overall Credit"
          value={`${overallRoi}%`}
          sub={`${formatCurrency(stats?.totalInvested ?? 0)} total in plans`}
        />
      </div>

      {/* Secondary stats: Active Investments / Monthly Earnings / Next Payment / Investment Progress */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Briefcase}
          label="Active Plans"
          value={String(stats?.activeInvestments ?? 0)}
          sub={
            (stats?.pendingInvestments ?? 0) > 0
              ? `${stats.pendingInvestments} pending approval`
              : `${formatCurrency(stats?.portfolioValue ?? 0)} committed`
          }
        />
        <StatCard
          icon={Coins}
          label="Monthly Earnings"
          value={formatCurrency(stats?.monthlyEarnings ?? 0)}
          sub={`Credited this month · ${formatCurrency(stats?.monthlyIncome ?? 0)} expected monthly`}
          accent
        />
        <StatCard
          icon={CalendarClock}
          label="Next Payment"
          value={stats?.nextPaymentDate ? formatDate(stats.nextPaymentDate) : "—"}
          sub={
            nextPaymentDays != null
              ? nextPaymentDays === 0
                ? "Due today"
                : `in ${nextPaymentDays} day${nextPaymentDays === 1 ? "" : "s"}`
              : "No active payout schedule"
          }
        />
        <StatCard
          icon={Gauge}
          label="Plan Progress"
          value={`${investmentProgress}%`}
          sub={
            activePortfolio.length > 0
              ? `Average across ${activePortfolio.length} active plan${activePortfolio.length === 1 ? "" : "s"}`
              : "No active plans yet"
          }
        />
      </div>

      {/* Frozen wallet warning */}
      {stats?.walletFrozen && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Snowflake className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Your wallet is currently frozen.</span> Withdrawals and
            new investments are temporarily disabled. Please contact support.
          </p>
        </div>
      )}

      {/* Wallet & Transaction Summary */}
      <WalletSummary stats={stats} setTab={setTab} />

      {/* Charts row */}
      <div className="grid lg:grid-cols-5 gap-6">
        <SectionCard
          title="Plan Growth"
          subtitle="Projected value over the last 6 months"
          className="lg:col-span-3"
        >
          {activePortfolio.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#26342b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#26342b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), "Plans Value"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#26342b"
                    strokeWidth={2.5}
                    fill="url(#portfolioGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No growth data yet"
              text="Start your first home plan to see your growth chart."
              action={
                <Button onClick={() => setTab("invest")} size="sm" className="bg-[#26342b]">
                  Start Investing
                </Button>
              }
            />
          )}
        </SectionCard>

        <SectionCard title="Allocation" subtitle="By home plan" className="lg:col-span-2">
          {allocationData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {allocationData.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={Briefcase}
              title="No allocation yet"
              text="Your plan allocation appears here once you invest."
            />
          )}
        </SectionCard>
      </div>

      {/* Active investments + side panels */}
      <div className="grid lg:grid-cols-5 gap-6">
        <SectionCard
          title="Active Plans"
          subtitle="Live accrual progress"
          className="lg:col-span-3"
          action={
            <Button variant="ghost" size="sm" onClick={() => setTab("portfolio")} className="text-[#26342b]">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          }
        >
          {activePortfolio.length > 0 ? (
            <div className="space-y-4">
              {activePortfolio.slice(0, 3).map((inv: any) => (
                <div key={inv.id} className="bg-[#f7f4ee] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-[#26342b]">{inv.projectName}</p>
                      <p className="text-xs text-gray-500">
                        {inv.planName} Plan · matures {formatDate(inv.maturityDate)}
                      </p>
                    </div>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressBar value={inv.progress} className="flex-1" />
                    <span className="text-xs font-semibold text-[#26342b] w-10 text-right">
                      {inv.progress}%
                    </span>
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>Committed {formatCurrency(inv.amount)}</span>
                    <span className="text-green-600 font-semibold">
                      +{formatCurrency(inv.computedEstimatedEarnings)} earned
                    </span>
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs">
                    <span className="text-[#a6632f] font-semibold">
                      {formatCurrency(inv.monthlyProfit)}/month
                    </span>
                    <span className="text-gray-500">
                      {inv.nextProfitAt
                        ? `Next payment ${formatDate(inv.nextProfitAt)}`
                        : `${inv.remainingDays} days remaining`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Briefcase}
              title="No active plans"
              text="Choose a plan and put your wallet balance to work."
              action={
                <Button onClick={() => setTab("invest")} size="sm" className="bg-[#26342b]">
                  Browse Plans
                </Button>
              }
            />
          )}
        </SectionCard>

        <div className="lg:col-span-2 space-y-6">
          {/* Quick actions */}
          <SectionCard title="Quick Actions">
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => setTab("deposit")} className="bg-[#26342b] h-11">
                <DollarSign className="w-4 h-4 mr-2" /> Deposit
              </Button>
              <Button onClick={() => setTab("withdraw")} variant="outline" className="border-[#26342b] text-[#26342b] h-11">
                <Wallet className="w-4 h-4 mr-2" /> Withdraw
              </Button>
              <Button onClick={() => setTab("invest")} variant="outline" className="border-[#c47a45] text-[#a6632f] h-11">
                <TrendingUp className="w-4 h-4 mr-2" /> Home Plans
              </Button>
              <Button onClick={() => setTab("referrals")} variant="outline" className="border-gray-300 text-gray-600 h-11">
                <Bell className="w-4 h-4 mr-2" /> Refer & Earn
              </Button>
            </div>
          </SectionCard>

          {/* Latest notifications */}
          <SectionCard
            title="Notifications"
            action={
              <Button variant="ghost" size="sm" onClick={() => setTab("notifications")} className="text-[#26342b]">
                All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            }
          >
            {notifications && notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.slice(0, 3).map((n: any) => (
                  <div key={n.id} className="flex gap-3">
                    <span
                      className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                        n.isRead === "no" ? "bg-[#c47a45]" : "bg-gray-200"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#26342b] truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">You're all caught up.</p>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Recent transactions */}
      <SectionCard
        title="Recent Transactions"
        action={
          <Button variant="ghost" size="sm" onClick={() => setTab("transactions")} className="text-[#26342b]">
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        }
      >
        {transactions && transactions.length > 0 ? (
          <div className="divide-y">
            {transactions.slice(0, 5).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      tx.direction === "credit" ? "bg-green-100" : "bg-red-100"
                    }`}
                  >
                    {tx.direction === "credit" ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <Wallet className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#26342b] truncate">{tx.description}</p>
                    <p className="text-xs text-gray-400">{formatDate(tx.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-bold ${
                      tx.direction === "credit" ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {tx.direction === "credit" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </p>
                  <StatusBadge status={tx.status} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Wallet}
            title="No transactions yet"
            text="Deposits, plans, and credits will appear here."
          />
        )}
      </SectionCard>

      <p className="text-xs text-gray-400 text-center">
        Need help? Visit the <Link to="/faq" className="text-[#26342b] underline">FAQ</Link> or contact support.
      </p>
    </div>
  );
}
