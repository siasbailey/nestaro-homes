import { Coins, CalendarClock, TrendingUp, Wallet } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate } from "@/hooks/use-investor";
import { StatCard, SectionCard, StatusBadge, EmptyState } from "./shared";

export default function ProfitsTab() {
  const profitsQuery = trpc.investor.profits.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const profits = profitsQuery.data ?? [];

  const paid = profits.filter((p: any) => p.status === "paid");
  const totalPaid = paid.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const now = new Date();
  const thisMonth = paid
    .filter((p: any) => {
      const d = new Date(p.paidAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s: number, p: any) => s + Number(p.amount), 0);
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard
          icon={Coins}
          label="Total Credits Paid"
          value={formatCurrency(totalPaid)}
          sub={`${paid.length} monthly payment${paid.length === 1 ? "" : "s"} received`}
          accent
        />
        <StatCard
          icon={TrendingUp}
          label="Credits This Month"
          value={formatCurrency(thisMonth)}
          sub={now.toLocaleString("en-US", { month: "long", year: "numeric" })}
        />
        <StatCard
          icon={CalendarClock}
          label="Payments Received"
          value={String(paid.length)}
          sub="Credited monthly to your wallet"
        />
      </div>

      <SectionCard
        title="Monthly Credit Payments"
        subtitle="Home credits paid to your wallet every month"
      >
        {profitsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : profits.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No profit payments yet"
            text="Once your plan is approved and active, home credits are paid to your wallet every month."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                    <th className="pb-3 pr-4 font-semibold">Plan</th>
                    <th className="pb-3 pr-4 font-semibold">Month</th>
                    <th className="pb-3 pr-4 font-semibold">Credit Rate</th>
                    <th className="pb-3 pr-4 font-semibold">Amount</th>
                    <th className="pb-3 pr-4 font-semibold">Paid On</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {profits.map((p: any) => (
                    <tr key={p.id} className="hover:bg-[#f7f4ee] transition">
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-[#26342b]">{p.projectName}</p>
                        <p className="text-xs text-gray-400">Plan #{p.investmentId}</p>
                      </td>
                      <td className="py-3.5 pr-4 font-medium">
                        Month {p.monthNumber}
                      </td>
                      <td className="py-3.5 pr-4 text-[#c47a45] font-semibold">
                        {Number(p.roiPercent).toFixed(2)}%
                      </td>
                      <td className="py-3.5 pr-4 font-bold text-green-600">
                        +{formatCurrency(p.amount)}
                      </td>
                      <td className="py-3.5 pr-4 text-gray-600">{formatDate(p.paidAt)}</td>
                      <td className="py-3.5">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {profits.map((p: any) => (
                <div
                  key={p.id}
                  className="bg-[#f7f4ee] rounded-xl p-4 border border-gray-100 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#26342b] truncate">{p.projectName}</p>
                    <p className="text-xs text-gray-400">
                      Month {p.monthNumber} · {formatDate(p.paidAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-green-600">+{formatCurrency(p.amount)}</p>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
