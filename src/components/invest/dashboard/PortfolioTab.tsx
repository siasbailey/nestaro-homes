import { useState } from "react";
import { Briefcase, CircleDollarSign, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/hooks/use-investor";
import { SectionCard, StatusBadge, ProgressBar, EmptyState } from "./shared";
import LiquidateDialog from "./LiquidateDialog";

export default function PortfolioTab({
  portfolio,
  setTab,
  onChanged,
}: {
  portfolio: any[];
  setTab: (tab: string) => void;
  onChanged?: () => void;
}) {
  const [liquidateId, setLiquidateId] = useState<number | null>(null);
  const active = portfolio.filter((p) => p.status === "active");
  const history = portfolio.filter((p) => p.status !== "active");

  const liquidateAction = (inv: any, fullWidth = false) => {
    if (inv.status !== "active") return <span className="text-gray-300">—</span>;
    if (inv.pendingLiquidation) {
      return fullWidth ? (
        <p className="text-center text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg py-2">
          Liquidation request pending review
        </p>
      ) : (
        <span className="text-xs font-semibold text-amber-600">Early withdrawal pending</span>
      );
    }
    return (
      <Button
        size="sm"
        variant="outline"
        className={`border-[#c47a45] text-[#a6632f] hover:bg-[#c47a45]/10 hover:text-[#a6632f] ${fullWidth ? "w-full" : ""}`}
        onClick={() => setLiquidateId(inv.id)}
      >
        <CircleDollarSign className="w-4 h-4 mr-1.5" />
        Liquidate
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="My Plans"
        subtitle={`${active.length} active · ${history.length} completed`}
        action={
          <Button onClick={() => setTab("invest")} size="sm" className="bg-[#26342b]">
            New Investment
          </Button>
        }
      >
        {portfolio.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Your portfolio is empty"
            text="Join one of our home plans to start building credit toward your tiny home."
            action={
              <Button onClick={() => setTab("invest")} className="bg-[#26342b]">
                Browse Investment Plans
              </Button>
            }
          />
        ) : (
          <>
            {active.length > 0 && (
              <div className="mb-5 flex items-center gap-2.5 bg-[#c47a45]/10 border border-[#c47a45]/30 rounded-xl px-4 py-3">
                <Coins className="w-4 h-4 text-[#a6632f] shrink-0" />
                <p className="text-xs text-[#26342b] leading-relaxed">
                  Your ROI starts in the same month your investment becomes active — no waiting
                  period. Payments then continue monthly until maturity.
                </p>
              </div>
            )}

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                    <th className="pb-3 pr-4 font-semibold">Project Name</th>
                    <th className="pb-3 pr-4 font-semibold">Plan Amount</th>
                    <th className="pb-3 pr-4 font-semibold">Monthly Credit</th>
                    <th className="pb-3 pr-4 font-semibold">Credit Paid</th>
                    <th className="pb-3 pr-4 font-semibold">Credit</th>
                    <th className="pb-3 pr-4 font-semibold">Duration</th>
                    <th className="pb-3 pr-4 font-semibold">Next Payment</th>
                    <th className="pb-3 pr-4 font-semibold">Completion Date</th>
                    <th className="pb-3 pr-4 font-semibold">Status</th>
                    <th className="pb-3 pr-4 font-semibold w-32">Progress</th>
                    <th className="pb-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {portfolio.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#f7f4ee] transition">
                      <td className="py-4 pr-4">
                        <p className="font-semibold text-[#26342b]">{inv.projectName}</p>
                        <p className="text-xs text-gray-400">
                          {inv.planName} Plan · started {formatDate(inv.startDate)}
                        </p>
                      </td>
                      <td className="py-4 pr-4 font-medium">{formatCurrency(inv.amount)}</td>
                      <td className="py-4 pr-4 font-semibold text-[#a6632f]">
                        {inv.status === "active" || inv.status === "suspended"
                          ? `${formatCurrency(inv.monthlyProfit)}/mo`
                          : "—"}
                        {inv.profitPaused === "yes" && inv.status === "active" && (
                          <span className="text-xs text-amber-500 block">paused</span>
                        )}
                      </td>
                      <td className="py-4 pr-4 text-green-600 font-semibold">
                        +{formatCurrency(inv.computedEstimatedEarnings)}
                        <span className="text-xs text-gray-400 block">
                          Month {inv.profitsPaid ?? 0} of {inv.payoutCount ?? inv.durationMonths}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <span className="font-bold text-[#c47a45]">
                          {inv.status === "active"
                            ? `${inv.computedRoi.toFixed(1)}%`
                            : `${Number(inv.roi).toFixed(1)}%`}
                        </span>
                        <span className="text-xs text-gray-400 block">target {inv.targetReturn}%</span>
                      </td>
                      <td className="py-4 pr-4 text-gray-600">
                        {inv.durationDaysEffective ?? inv.durationMonths * 30} days
                        {inv.durationDays != null && <span className="text-xs text-gray-400 block">flexible</span>}
                      </td>
                      <td className="py-4 pr-4 text-gray-600">
                        {inv.status === "active" && inv.nextProfitAt
                          ? formatDate(inv.nextProfitAt)
                          : "—"}
                      </td>
                      <td className="py-4 pr-4 text-gray-600">
                        {formatDate(inv.maturityDate)}
                        {inv.status === "active" && (
                          <span className="text-xs text-gray-400 block">
                            {inv.remainingDays} days left
                          </span>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={inv.progress} className="w-20" />
                          <span className="text-xs font-semibold text-[#26342b]">{inv.progress}%</span>
                        </div>
                      </td>
                      <td className="py-4">{liquidateAction(inv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-4">
              {portfolio.map((inv) => (
                <div key={inv.id} className="bg-[#f7f4ee] rounded-xl p-5 border border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-[#26342b]">{inv.projectName}</p>
                      <p className="text-xs text-gray-500">
                        {inv.planName} Plan · {inv.durationDaysEffective ?? inv.durationMonths * 30} days · started {formatDate(inv.startDate)}
                      </p>
                    </div>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div>
                      <p className="text-xs text-gray-400">Amount</p>
                      <p className="font-semibold text-[#26342b]">{formatCurrency(inv.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Monthly Credit</p>
                      <p className="font-bold text-[#a6632f]">
                        {inv.status === "active" || inv.status === "suspended"
                          ? formatCurrency(inv.monthlyProfit)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Credit Paid</p>
                      <p className="font-semibold text-green-600">+{formatCurrency(inv.computedEstimatedEarnings)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Next Payment</p>
                      <p className="font-semibold text-[#26342b]">
                        {inv.status === "active" && inv.nextProfitAt
                          ? formatDate(inv.nextProfitAt)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Completion</p>
                      <p className="font-semibold text-[#26342b]">
                        {formatDate(inv.maturityDate)}
                        {inv.status === "active" && (
                          <span className="text-xs text-gray-400 block">{inv.remainingDays} days left</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressBar value={inv.progress} className="flex-1" />
                    <span className="text-xs font-bold text-[#26342b]">{inv.progress}%</span>
                  </div>
                  {inv.status === "active" && (
                    <div className="mt-4">{liquidateAction(inv, true)}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {liquidateId !== null && (
        <LiquidateDialog
          investmentId={liquidateId}
          onClose={() => setLiquidateId(null)}
          onSuccess={() => onChanged?.()}
        />
      )}
    </div>
  );
}
