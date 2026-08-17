import { useState } from "react";
import {
  RefreshCw, TrendingUp, DollarSign, CalendarCheck, Search, Undo2, Wallet,
  Snowflake, Sun, Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate } from "@/hooks/use-investor";
import { StatCard, SectionCard, StatusBadge, EmptyState } from "../dashboard/shared";
import InvestorAvatar from "@/components/invest/InvestorAvatar";

// ── Profit Payments (history + settlement engine) ───────────────
export function AdminProfits() {
  const { data: payments, refetch } = trpc.investAdmin.profitPayments.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const { data: stats } = trpc.investAdmin.stats.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const [result, setResult] = useState<string | null>(null);

  const settle = trpc.investAdmin.settleInvestments.useMutation({
    onSuccess: (data) => {
      toast.success("Settlement complete");
      setResult(
        data.skipped
          ? "A settlement run is already in progress. Try again in a moment."
          : `${data.profitsPaid} monthly profit${data.profitsPaid === 1 ? "" : "s"} credited · ${data.settled} investment${data.settled === 1 ? "" : "s"} matured and principal returned.`,
      );
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Profit Paid This Month" value={formatCurrency(stats?.monthlyProfitPaid ?? 0)} sub="Across all investors" accent />
        <StatCard icon={DollarSign} label="Total ROI Paid (All Time)" value={formatCurrency(stats?.totalRoiPaid ?? 0)} sub={`${stats?.totalProfitPayments ?? 0} monthly payments`} />
        <StatCard icon={CalendarCheck} label="Scheduled Engine" value="Hourly" sub="Automatic settlement runs every hour" />
      </div>

      <SectionCard title="Monthly ROI Engine" subtitle="Credits due profits and returns matured principal">
        <div className="max-w-2xl space-y-4">
          <div className="bg-[#f7f4ee] rounded-xl p-5 text-sm text-gray-600 leading-relaxed">
            <p className="font-semibold text-[#26342b] mb-2">How monthly ROI works</p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Monthly profit = investment amount × (ROI% ÷ duration months).</li>
              <li>The engine runs automatically every hour and credits any due profits to investor wallets.</li>
              <li>At the end date, the principal is returned and the investment is marked completed.</li>
              <li>You can also run a settlement manually at any time below.</li>
            </ul>
          </div>
          {result && (
            <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl p-4">{result}</div>
          )}
          <Button onClick={() => settle.mutate()} disabled={settle.isPending} className="bg-[#26342b]">
            <RefreshCw className={`w-4 h-4 mr-2 ${settle.isPending ? "animate-spin" : ""}`} />
            {settle.isPending ? "Settling..." : "Run Settlement Now"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Profit Payment History" subtitle={`${payments?.length ?? 0} payments`}>
        {payments && payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[750px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                  <th className="pb-3 pr-4 font-semibold">Investor</th>
                  <th className="pb-3 pr-4 font-semibold">Project</th>
                  <th className="pb-3 pr-4 font-semibold">Month</th>
                  <th className="pb-3 pr-4 font-semibold">Rate</th>
                  <th className="pb-3 pr-4 font-semibold">Paid At</th>
                  <th className="pb-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-[#f7f4ee] transition">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2">
                        <InvestorAvatar name={p.investorName} avatar={p.investorAvatar} size="xs" />
                        <span className="font-semibold text-[#26342b]">{p.investorName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-gray-600">{p.projectName}</td>
                    <td className="py-3.5 pr-4 text-gray-600">Month {p.monthNumber}</td>
                    <td className="py-3.5 pr-4 text-gray-600">{Number(p.roiPercent).toFixed(2)}%</td>
                    <td className="py-3.5 pr-4 text-gray-500">{formatDate(p.paidAt)}</td>
                    <td className="py-3.5 text-right font-bold text-green-600">+{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={TrendingUp} title="No profit payments yet" text="Monthly profit payments will appear here once the engine credits them." />
        )}
      </SectionCard>
    </div>
  );
}

// ── Wallet Management ───────────────────────────────────────────
export function AdminWallets() {
  const [search, setSearch] = useState("");
  const { data: investors } = trpc.investAdmin.investors.useQuery(
    { search: search || undefined },
    { retry: false, refetchInterval: 20_000 },
  );
  const [selected, setSelected] = useState<any | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"credit" | "debit">("credit");

  const { data: detail, refetch: refetchDetail } = trpc.investAdmin.investorDetail.useQuery(
    { investorId: selected?.id ?? 0 },
    { enabled: !!selected, retry: false },
  );

  const adjustWallet = trpc.investAdmin.adjustWallet.useMutation({
    onSuccess: () => {
      toast.success("Wallet adjusted");
      setAdjustAmount("");
      setAdjustReason("");
      refetchDetail();
    },
    onError: (err) => toast.error(err.message),
  });

  const reverseTx = trpc.investAdmin.reverseTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaction reversed");
      refetchDetail();
    },
    onError: (err) => toast.error(err.message),
  });

  const setFrozen = trpc.investAdmin.setWalletFrozen.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(vars.frozen ? "Wallet frozen" : "Wallet unfrozen");
      refetchDetail();
    },
    onError: (err) => toast.error(err.message),
  });

  const recalculate = trpc.investAdmin.recalculateInvestor.useMutation({
    onSuccess: (res) => {
      if (res.drift === 0) {
        toast.success(`Ledger verified — no drift (${res.ledgerBalance.toFixed(2)})`);
      } else {
        toast.warning(
          `Drift found: stored ${res.storedBalance.toFixed(2)} vs ledger ${res.ledgerBalance.toFixed(2)} (${res.drift > 0 ? "+" : ""}${res.drift.toFixed(2)}). ${res.fixed ? "Corrected." : "Click Fix to correct."}`,
        );
      }
      refetchDetail();
    },
    onError: (err) => toast.error(err.message),
  });

  const totalBalances = (investors ?? []).reduce((s: number, i: any) => s + Number(i.walletBalance), 0);

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Investor picker */}
      <div className="lg:col-span-2">
        <SectionCard
          title="Investor Wallets"
          subtitle={`Total held: ${formatCurrency(totalBalances)}`}
          action={
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 w-36" />
            </div>
          }
        >
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {(investors ?? []).map((inv: any) => (
              <button
                key={inv.id}
                onClick={() => setSelected(inv)}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition flex items-center justify-between gap-3 ${
                  selected?.id === inv.id ? "border-[#26342b] bg-[#26342b]/[0.04]" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <InvestorAvatar name={inv.name} avatar={inv.avatar} size="sm" />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#26342b] text-sm truncate">
                      {inv.name}
                      {inv.walletFrozen === "yes" && <Snowflake className="w-3 h-3 inline ml-1 text-blue-400" />}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{inv.email}</p>
                  </div>
                </div>
                <p className="font-bold text-[#26342b] text-sm shrink-0">{formatCurrency(inv.walletBalance)}</p>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Wallet detail */}
      <div className="lg:col-span-3 space-y-6">
        {selected ? (
          <>
            <SectionCard
              title={`${selected.name}'s Wallet`}
              subtitle={`Balance: ${formatCurrency(detail?.investor?.walletBalance ?? selected.walletBalance)}`}
            >
              {/* Wallet controls: freeze + reconcile */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setFrozen.isPending}
                  onClick={() =>
                    setFrozen.mutate({
                      investorId: selected.id,
                      frozen: detail?.financials?.walletFrozen !== true,
                    })
                  }
                  className={
                    detail?.financials?.walletFrozen
                      ? "border-green-300 text-green-600"
                      : "border-blue-300 text-blue-600"
                  }
                >
                  {detail?.financials?.walletFrozen ? (
                    <><Sun className="w-3.5 h-3.5 mr-1" /> Unfreeze Wallet</>
                  ) : (
                    <><Snowflake className="w-3.5 h-3.5 mr-1" /> Freeze Wallet</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={recalculate.isPending}
                  className="border-gray-300 text-gray-600"
                  onClick={() => recalculate.mutate({ investorId: selected.id, fix: false })}
                >
                  <Calculator className="w-3.5 h-3.5 mr-1" /> Verify Ledger
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={recalculate.isPending}
                  className="border-[#c47a45] text-[#a6632f]"
                  onClick={() => recalculate.mutate({ investorId: selected.id, fix: true })}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Recalculate & Fix
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => setAdjustDirection("credit")}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition ${
                    adjustDirection === "credit" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"
                  }`}
                >
                  + Credit Funds
                </button>
                <button
                  onClick={() => setAdjustDirection("debit")}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition ${
                    adjustDirection === "debit" ? "border-red-400 bg-red-50 text-red-600" : "border-gray-200 text-gray-500"
                  }`}
                >
                  − Debit Funds
                </button>
              </div>
              <div className="flex gap-3">
                <Input type="number" min={1} value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="Amount" />
                <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Reason" />
                <Button
                  disabled={adjustWallet.isPending}
                  className="bg-[#26342b] shrink-0"
                  onClick={() => {
                    const amount = Number(adjustAmount);
                    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
                    if (adjustReason.trim().length < 3) { toast.error("Provide a reason"); return; }
                    adjustWallet.mutate({ investorId: selected.id, amount, direction: adjustDirection, reason: adjustReason.trim() });
                  }}
                >
                  <Wallet className="w-4 h-4 mr-1" /> Apply
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Wallet History" subtitle={`${detail?.transactions?.length ?? 0} transactions`}>
              {detail?.transactions && detail.transactions.length > 0 ? (
                <div className="divide-y max-h-[420px] overflow-y-auto">
                  {detail.transactions.map((tx: any) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700 truncate">{tx.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(tx.createdAt)} · {tx.reference || "—"} · <StatusBadge status={tx.status} />
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className={`text-sm font-bold ${tx.direction === "credit" ? "text-green-600" : "text-red-500"}`}>
                          {tx.direction === "credit" ? "+" : "−"}{formatCurrency(tx.amount)}
                        </p>
                        {tx.status === "completed" && (
                          <button
                            className="text-xs font-semibold text-[#a6632f] hover:underline flex items-center gap-1"
                            onClick={() => {
                              const reason = window.prompt("Reason for reversal:");
                              if (reason && reason.trim().length >= 3) {
                                reverseTx.mutate({ transactionId: tx.id, reason: reason.trim() });
                              }
                            }}
                          >
                            <Undo2 className="w-3.5 h-3.5" /> Reverse
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Wallet} title="No transactions" text="This investor has no wallet activity yet." />
              )}
            </SectionCard>
          </>
        ) : (
          <SectionCard title="Select an Investor">
            <EmptyState icon={Wallet} title="No wallet selected" text="Pick an investor on the left to view and manage their wallet." />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
