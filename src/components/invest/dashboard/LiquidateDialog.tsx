import { X, AlertTriangle, CircleDollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { formatCurrency, formatDate } from "@/hooks/use-investor";

interface LiquidateDialogProps {
  investmentId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LiquidateDialog({ investmentId, onClose, onSuccess }: LiquidateDialogProps) {
  const estimateQuery = trpc.investor.liquidationEstimate.useQuery(
    { investmentId },
    { retry: false },
  );
  const est = estimateQuery.data;

  const requestMutation = trpc.investor.requestLiquidation.useMutation({
    onSuccess: () => {
      toast.success("Early withdrawal request submitted for review");
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-[#26342b] font-serif flex items-center gap-2">
            <CircleDollarSign className="w-5 h-5 text-[#c47a45]" />
            Liquidate Investment
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {estimateQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#26342b] animate-spin" />
            </div>
          ) : estimateQuery.isError || !est ? (
            <p className="text-center text-red-500 py-8">
              {estimateQuery.error?.message ?? "Could not load liquidation estimate"}
            </p>
          ) : (
            <>
              <div className="bg-[#f7f4ee] rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Plan</p>
                <p className="font-bold text-[#26342b]">{est.projectName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {est.planName} Plan · started {formatDate(est.startDate)} · matures {formatDate(est.maturityDate)}
                </p>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Plan Amount</span>
                  <span className="font-semibold text-[#26342b]">{formatCurrency(est.principal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Credit Earned to Date</span>
                  <span className="font-semibold text-green-600">+{formatCurrency(est.profitEarned)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly Credit</span>
                  <span className="font-semibold text-[#26342b]">{formatCurrency(est.monthlyProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Accrued This Month</span>
                  <span className="font-semibold text-[#26342b]">{formatCurrency(est.accruedProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Early Withdrawal Adjustment ({est.penaltyPercent}%)</span>
                  <span className="font-semibold text-red-500">−{formatCurrency(est.penaltyAmount)}</span>
                </div>
                <div className="border-t pt-2.5 flex justify-between items-center">
                  <span className="font-bold text-[#26342b]">Estimated Payout</span>
                  <span className="text-xl font-bold text-[#c47a45]">{formatCurrency(est.estimatedValue)}</span>
                </div>
              </div>

              <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-5">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Liquidation ends this investment immediately: no further monthly profits will be
                  earned, and a {est.penaltyPercent}% early-exit penalty applies. The final payout
                  is confirmed by our team upon approval and credited to your wallet.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-[#26342b]"
                  disabled={requestMutation.isPending || est.alreadyPending}
                  onClick={() => requestMutation.mutate({ investmentId })}
                >
                  {requestMutation.isPending
                    ? "Submitting..."
                    : est.alreadyPending
                      ? "Request Already Pending"
                      : "Confirm Early Withdrawal"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
