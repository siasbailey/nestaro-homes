import { useState } from "react";
import { X, CheckCircle2, XCircle, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useInvestor } from "@/hooks/use-investor";

const reasons = [
  "I no longer need the service",
  "I found another provider",
  "Poor user experience",
  "Technical problems",
  "Privacy concerns",
  "Returns did not meet expectations",
  "Other",
];

export default function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const { logout } = useInvestor();
  const eligibilityQuery = trpc.investor.deletionEligibility.useQuery(undefined, { retry: false });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  const deleteAccount = trpc.investor.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Your account has been permanently deleted. We're sorry to see you go.", { duration: 8000 });
      logout();
      window.location.href = "/";
    },
    onError: (err) => toast.error(err.message),
  });

  const checks = eligibilityQuery.data?.checks;
  const eligible = eligibilityQuery.data?.eligible ?? false;

  const checkRows = checks
    ? [
        { ok: checks.activeInvestments === 0, label: "No active plans" },
        { ok: checks.pendingInvestments === 0, label: "No pending plans" },
        { ok: checks.pendingWithdrawals === 0, label: "No pending withdrawal requests" },
        { ok: checks.pendingDeposits === 0, label: "No pending deposit requests" },
        { ok: checks.pendingLiquidations === 0, label: "No pending early withdrawal requests" },
        { ok: checks.walletBalance <= 0, label: "Wallet balance has been withdrawn" },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-lg font-bold text-red-600 font-serif flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Delete Your Account
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {/* Step 1 — eligibility checks */}
          {step === 1 && (
            <>
              <p className="text-sm text-gray-600 font-semibold mb-4">
                Are you sure you want to delete your account? This action cannot be undone.
              </p>
              {eligibilityQuery.isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-8 h-8 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-5">
                    {checkRows.map((c) => (
                      <div key={c.label} className="flex items-center gap-2.5 text-sm">
                        {c.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                        <span className={c.ok ? "text-gray-600" : "text-red-600 font-medium"}>{c.label}</span>
                      </div>
                    ))}
                  </div>

                  {!eligible && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
                      <p className="text-sm font-semibold text-amber-800 mb-1.5">Before deleting your account, you must:</p>
                      <ul className="text-xs text-amber-800 space-y-1 list-disc pl-4">
                        <li>Request early withdrawal on all active plans and wait for approval.</li>
                        <li>Withdraw your available wallet balance.</li>
                        <li>Ensure all pending financial requests have been completed.</li>
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      disabled={!eligible}
                      onClick={() => setStep(2)}
                    >
                      Continue
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Step 2 — feedback */}
          {step === 2 && (
            <>
              <p className="text-sm font-semibold text-gray-700 mb-3">Why are you deleting your account?</p>
              <div className="space-y-2 mb-4">
                {reasons.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition ${
                      reason === r ? "border-[#26342b] bg-[#26342b]/5 font-semibold text-[#26342b]" : "border-gray-200 text-gray-600"
                    }`}
                  >
                    <input type="radio" name="delete-reason" checked={reason === r} onChange={() => setReason(r)} className="accent-[#26342b]" />
                    {r === "Other" ? "Other (please specify below)" : r}
                  </label>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Additional comments (optional)..."
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30 focus:border-[#26342b] resize-none mb-5"
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={!reason} onClick={() => setStep(3)}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {/* Step 3 — final confirmation */}
          {step === 3 && (
            <>
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-4 mb-5">
                <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 font-medium leading-relaxed">
                  This action is permanent. Your account and personal data will be permanently deleted
                  and cannot be recovered.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={deleteAccount.isPending}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={deleteAccount.isPending}
                  onClick={() => deleteAccount.mutate({ reason, comment: comment.trim() || undefined })}
                >
                  {deleteAccount.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-1.5" />
                  )}
                  Permanently Delete My Account
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
