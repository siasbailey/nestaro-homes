import { useState, useEffect } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, X, Settings2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate } from "@/hooks/use-investor";
import { PAYMENT_METHOD_LABELS } from "@contracts/constants";
import { SectionCard, StatusBadge, EmptyState } from "../dashboard/shared";
import InvestorAvatar from "@/components/invest/InvestorAvatar";

/** Editor for the payment instructions investors see per deposit method. */
export function AdminPaymentInstructions() {
  const { data, refetch } = trpc.investAdmin.paymentInstructions.useQuery(undefined, { retry: false });
  const [form, setForm] = useState({ bank: "", zelle: "", crypto: "" });

  useEffect(() => {
    if (data) setForm({ bank: data.bank, zelle: data.zelle, crypto: data.crypto });
  }, [data]);

  const update = trpc.investAdmin.updatePaymentInstructions.useMutation({
    onSuccess: () => {
      toast.success("Deposit payment instructions updated — customers see them immediately.");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const dirty = data && (form.bank !== data.bank || form.zelle !== data.zelle || form.crypto !== data.crypto);

  return (
    <SectionCard
      title="Deposit Payment Instructions"
      subtitle="Shown to customers on the deposit page for each method (bank / Zelle / crypto)"
      action={<Settings2 className="w-5 h-5 text-[#c47a45]" />}
    >
      <div className="space-y-4">
        {(
          [
            ["bank", "Bank Transfer Instructions"],
            ["zelle", "Zelle Instructions"],
            ["crypto", "Cryptocurrency Instructions"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <Label htmlFor={`pi-${key}`}>{label}</Label>
            <textarea
              id={`pi-${key}`}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              rows={4}
              maxLength={4000}
              placeholder={"Account details + step-by-step payment guidance for customers..."}
              className="mt-1.5 w-full rounded-md border border-input px-3 py-2 text-sm"
            />
          </div>
        ))}
        <Button
          onClick={() => update.mutate(form)}
          disabled={update.isPending || !dirty}
          className="bg-[#26342b]"
        >
          {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Instructions
        </Button>
      </div>
    </SectionCard>
  );
}

const statusFilters = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export function AdminDeposits() {
  const [filter, setFilter] = useState("pending");
  const { data: deposits, refetch } = trpc.investAdmin.deposits.useQuery(
    { status: filter },
    { retry: false, refetchInterval: 20_000 },
  );

  const review = trpc.investAdmin.reviewDeposit.useMutation({
    onSuccess: () => {
      toast.success("Deposit updated");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
    <SectionCard
      title="Deposit Requests"
      subtitle={`${deposits?.length ?? 0} shown`}
      action={
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                filter === f.id ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      {deposits && deposits.length > 0 ? (
        <div className="space-y-3">
          {deposits.map((d: any) => (
            <div key={d.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#f7f4ee] rounded-xl p-4">
              <div className="min-w-0">
                <p className="font-bold text-[#26342b]">
                  {formatCurrency(d.amount)}
                  <span className="text-xs text-gray-400 font-normal ml-2">via {PAYMENT_METHOD_LABELS[d.method] ?? d.method}</span>
                </p>
                <div className="flex items-center gap-2 mt-1.5 min-w-0">
                  <InvestorAvatar name={d.investorName} avatar={d.investorAvatar} size="xs" />
                  <p className="text-xs text-gray-500 min-w-0 [overflow-wrap:anywhere]">
                    {d.investorName} · {d.investorEmail}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 [overflow-wrap:anywhere]">
                  {formatDate(d.createdAt)} · Ref {d.reference}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <StatusBadge status={d.status} />
                {d.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => review.mutate({ depositId: d.id, decision: "approved" })}
                      disabled={review.isPending}
                      className="bg-green-600 hover:bg-green-700 h-8"
                    >
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const note = window.prompt("Reason for rejection (optional):") ?? "";
                        review.mutate({ depositId: d.id, decision: "rejected", note });
                      }}
                      disabled={review.isPending}
                      className="border-red-300 text-red-500 h-8"
                    >
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ArrowDownToLine}
          title="No deposits found"
          text="Deposit requests matching this filter will appear here."
        />
      )}
    </SectionCard>
    <AdminPaymentInstructions />
    </div>
  );
}

const withdrawalFilters = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
  { id: "rejected", label: "Rejected" },
];

export function AdminWithdrawals() {
  const [filter, setFilter] = useState("pending");
  const { data: withdrawals, refetch } = trpc.investAdmin.withdrawals.useQuery(
    { status: filter },
    { retry: false, refetchInterval: 20_000 },
  );

  const review = trpc.investAdmin.reviewWithdrawal.useMutation({
    onSuccess: () => {
      toast.success("Withdrawal updated");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <SectionCard
      title="Withdrawal Requests"
      subtitle={`${withdrawals?.length ?? 0} shown`}
      action={
        <div className="flex gap-2 flex-wrap">
          {withdrawalFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                filter === f.id ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      {withdrawals && withdrawals.length > 0 ? (
        <div className="space-y-3">
          {withdrawals.map((w: any) => (
            <div key={w.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#f7f4ee] rounded-xl p-4">
              <div className="min-w-0">
                <p className="font-bold text-[#26342b]">
                  {formatCurrency(w.amount)}
                  <span className="text-xs text-gray-400 font-normal ml-2">via {PAYMENT_METHOD_LABELS[w.method] ?? w.method}</span>
                </p>
                <div className="flex items-center gap-2 mt-1.5 min-w-0">
                  <InvestorAvatar name={w.investorName} avatar={w.investorAvatar} size="xs" />
                  <p className="text-xs text-gray-500 min-w-0 [overflow-wrap:anywhere]">
                    {w.investorName} · {w.investorEmail}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 break-words [overflow-wrap:anywhere]">
                  To: {w.destination}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 [overflow-wrap:anywhere]">
                  {formatDate(w.createdAt)} · Ref {w.reference}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <StatusBadge status={w.status} />
                {w.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => review.mutate({ withdrawalId: w.id, decision: "approved" })}
                      disabled={review.isPending}
                      className="bg-[#26342b] h-8"
                    >
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const note = window.prompt("Reason for rejection (optional):") ?? "";
                        review.mutate({ withdrawalId: w.id, decision: "rejected", note });
                      }}
                      disabled={review.isPending}
                      className="border-red-300 text-red-500 h-8"
                    >
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </>
                )}
                {w.status === "approved" && (
                  <Button
                    size="sm"
                    onClick={() => review.mutate({ withdrawalId: w.id, decision: "paid" })}
                    disabled={review.isPending}
                    className="bg-green-600 hover:bg-green-700 h-8"
                  >
                    <Check className="w-4 h-4 mr-1" /> Mark Paid
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ArrowUpFromLine}
          title="No withdrawals found"
          text="Withdrawal requests matching this filter will appear here."
        />
      )}
    </SectionCard>
  );
}
