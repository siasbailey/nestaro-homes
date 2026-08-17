import { useMemo, useState } from "react";
import { Building2, Bitcoin, Smartphone, ArrowUpFromLine, ShieldCheck, Star, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate } from "@/hooks/use-investor";
import { PAYMENT_METHOD_LABELS } from "@contracts/constants";
import { SectionCard, StatusBadge, EmptyState } from "./shared";

const methods = [
  { id: "bank" as const, label: "Bank Transfer", icon: Building2, placeholder: "Bank name, account name & account number" },
  { id: "zelle" as const, label: "Zelle", icon: Smartphone, placeholder: "Zelle email / phone number + account name" },
  { id: "crypto" as const, label: "Cryptocurrency", icon: Bitcoin, placeholder: "Network (e.g. USDT TRC20) + wallet address" },
];

type SavedAccount = {
  id: number;
  method: "bank" | "zelle" | "crypto" | "opay";
  label: string;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  cryptoNetwork: string | null;
  walletAddress: string | null;
  isDefault: "yes" | "no";
};

export function accountSummary(a: SavedAccount): string {
  if (a.method === "bank") return `${a.bankName ?? ""} • ${a.accountNumber ?? ""} • ${a.accountName ?? ""}`;
  if (a.method === "zelle" || a.method === "opay") return `${a.accountNumber ?? ""} • ${a.accountName ?? ""}`;
  return `${a.cryptoNetwork ?? ""} • ${a.walletAddress ?? ""}`;
}

export default function WithdrawTab({
  walletBalance,
  kycStatus,
  onWithdrawn,
}: {
  walletBalance: number;
  kycStatus: string;
  onWithdrawn: () => void;
}) {
  const [amountStr, setAmountStr] = useState("");
  const [method, setMethod] = useState<"bank" | "zelle" | "crypto">("bank");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [destination, setDestination] = useState("");
  const amount = Number(amountStr) || 0;

  const { data: withdrawals, refetch } = trpc.investor.withdrawals.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const { data: accounts } = trpc.investor.withdrawalAccounts.useQuery(undefined, { retry: false });

  const methodAccounts = useMemo(
    () => ((accounts ?? []) as SavedAccount[]).filter((a) => a.method === method),
    [accounts, method],
  );
  const selectedAccount =
    methodAccounts.find((a) => a.id === selectedAccountId) ??
    methodAccounts.find((a) => a.isDefault === "yes") ??
    null;
  const useManual = manualMode || methodAccounts.length === 0;

  const withdraw = trpc.investor.withdraw.useMutation({
    onSuccess: (data) => {
      toast.success(`Withdrawal request submitted. Reference: ${data.reference}`);
      setAmountStr("");
      setDestination("");
      refetch();
      onWithdrawn();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleWithdraw = () => {
    if (amount < 50) {
      toast.error("Minimum withdrawal is $50");
      return;
    }
    if (amount > walletBalance) {
      toast.error("Insufficient wallet balance");
      return;
    }
    if (useManual) {
      if (destination.trim().length < 4) {
        toast.error("Please enter a valid destination");
        return;
      }
      withdraw.mutate({ amount, method, destination: destination.trim() });
    } else {
      if (!selectedAccount) {
        toast.error("Please select a saved account");
        return;
      }
      withdraw.mutate({ amount, method, withdrawalAccountId: selectedAccount.id });
    }
  };

  const selectedMethod = methods.find((m) => m.id === method)!;

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 min-w-0">
        <SectionCard title="Request a Withdrawal" subtitle={`Available: ${formatCurrency(walletBalance)}`}>
          <div className="space-y-5">
            <div>
              <Label htmlFor="withdraw-amount">Amount ($)</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <Input
                  id="withdraw-amount"
                  type="number"
                  min={50}
                  max={walletBalance}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="500"
                  className="pl-8 h-12 font-bold text-lg"
                />
                <button
                  onClick={() => setAmountStr(String(walletBalance))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#c47a45] hover:text-[#a6632f]"
                >
                  MAX
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Minimum $50</p>
            </div>

            <div>
              <Label>Destination Method</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {methods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMethod(m.id);
                      setSelectedAccountId(null);
                      setManualMode(false);
                    }}
                    className={`p-3.5 rounded-xl border-2 text-center transition ${
                      method === m.id
                        ? "border-[#26342b] bg-[#26342b]/[0.04]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <m.icon className={`w-5 h-5 mx-auto mb-1.5 ${method === m.id ? "text-[#26342b]" : "text-gray-400"}`} />
                    <p className="text-xs font-semibold text-[#26342b]">{m.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {methodAccounts.length > 0 && (
              <div>
                <Label htmlFor="saved-account">Saved {selectedMethod.label} Accounts</Label>
                <select
                  id="saved-account"
                  value={useManual ? "manual" : (selectedAccount?.id ?? "")}
                  onChange={(e) => {
                    if (e.target.value === "manual") {
                      setManualMode(true);
                      setSelectedAccountId(null);
                    } else {
                      setManualMode(false);
                      setSelectedAccountId(Number(e.target.value));
                    }
                  }}
                  className="mt-1.5 w-full min-w-0 h-12 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {methodAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {accountSummary(a)}
                      {a.isDefault === "yes" ? " ★" : ""}
                    </option>
                  ))}
                  <option value="manual">Use a different account…</option>
                </select>
                {!useManual && selectedAccount && (
                  <div className="mt-2 flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600">
                    {selectedAccount.isDefault === "yes" && <Star className="w-3.5 h-3.5 text-[#c47a45] shrink-0 mt-0.5 fill-[#c47a45]" />}
                    <span className="break-all">{accountSummary(selectedAccount)}</span>
                  </div>
                )}
              </div>
            )}

            {useManual && (
              <div>
                <Label htmlFor="destination">{selectedMethod.label} Details</Label>
                <Input
                  id="destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={selectedMethod.placeholder}
                  className="mt-1.5 h-12"
                />
                {methodAccounts.length === 0 && (
                  <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                    <PlusCircle className="w-3 h-3" /> Tip: save this account in Settings → Withdrawal Accounts for faster withdrawals.
                  </p>
                )}
              </div>
            )}

            {kycStatus !== "verified" && (
              <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                Withdrawals above $5,000 require identity verification. Complete verification in
                Settings to unlock higher limits.
              </div>
            )}

            <Button
              onClick={handleWithdraw}
              disabled={withdraw.isPending || !amountStr}
              className="w-full h-12 bg-[#26342b] transition text-base font-semibold"
            >
              <ArrowUpFromLine className="w-5 h-5 mr-2" />
              {withdraw.isPending ? "Submitting..." : `Withdraw ${amount > 0 ? formatCurrency(amount) : ""}`}
            </Button>
            <p className="text-[11px] text-gray-400 text-center">
              Withdrawals are reviewed and typically processed within 1-3 business days.
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="lg:col-span-3 min-w-0">
        <SectionCard title="Withdrawal History" subtitle={`${withdrawals?.length ?? 0} requests`}>
          {withdrawals && withdrawals.length > 0 ? (
            <div className="divide-y">
              {withdrawals.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#26342b]">
                      {formatCurrency(w.amount)}
                      <span className="text-xs text-gray-400 font-normal ml-2">
                        via {PAYMENT_METHOD_LABELS[w.method] ?? w.method}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                      {formatDate(w.createdAt)} · To {w.destination}
                    </p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ArrowUpFromLine}
              title="No withdrawals yet"
              text="Your withdrawal requests and their processing status will appear here."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
