import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  ShieldCheck, Eye, Loader2, FileText, Download, CheckCircle2, XCircle,
  AlertTriangle, ArrowUpCircle, ArrowDownCircle, Ban, RotateCcw, History,
} from "lucide-react";
import { SectionCard } from "../dashboard/shared";
import { formatDateTime } from "@/hooks/use-investor";
import VerificationBadge from "@/components/invest/VerificationBadge";
import { KYC_TIERS, kycDocTypeLabel, kycStatusLabel, kycTierLabel } from "@contracts/kyc";

const reqStatusStyles: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  more_info: "bg-amber-100 text-amber-700",
};

function DocPreview({ doc }: { doc: { id: number; name: string; docType: string; dataUrl: string } }) {
  const isImage = doc.dataUrl.startsWith("data:image/");
  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-[#26342b] flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-[#c47a45] shrink-0" />
          <span className="truncate">{kycDocTypeLabel(doc.docType)}</span>
        </p>
        <a
          href={doc.dataUrl}
          download={doc.name}
          className="shrink-0 text-xs font-medium text-[#26342b] hover:underline flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </a>
      </div>
      <p className="text-xs text-gray-400 mb-2 truncate">{doc.name}</p>
      {isImage ? (
        <img src={doc.dataUrl} alt={doc.name} className="w-full max-h-56 object-contain rounded-lg bg-gray-50" />
      ) : (
        <div className="w-full h-20 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
          PDF document — use Download to view
        </div>
      )}
    </div>
  );
}

export default function AdminVerification() {
  const utils = trpc.useUtils();
  const listQuery = trpc.kyc.verificationRequests.useQuery(undefined, { refetchInterval: 20_000 });
  const [detailId, setDetailId] = useState<number | null>(null);
  const detailQuery = trpc.kyc.verificationDetail.useQuery(
    { requestId: detailId ?? 0 },
    { enabled: detailId !== null, retry: false }
  );

  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [tierNote, setTierNote] = useState("");

  const invalidate = () => {
    utils.kyc.verificationRequests.invalidate();
    utils.kyc.verificationDetail.invalidate();
    utils.investAdmin.investors.invalidate();
  };

  const reviewMutation = trpc.kyc.reviewVerification.useMutation({
    onSuccess: (_d, v) => {
      toast.success(
        v.decision === "approve" ? "Verification approved — investor notified." :
        v.decision === "reject" ? "Verification rejected — investor notified." :
        "More information requested — investor notified."
      );
      setNotes("");
      setReason("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const tierMutation = trpc.kyc.setVerificationTier.useMutation({
    onSuccess: () => {
      toast.success("Verification tier updated — investor notified.");
      setTierNote("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const suspendMutation = trpc.kyc.suspendVerification.useMutation({
    onSuccess: (_d, v) => {
      toast.success(v.suspend ? "Verification suspended." : "Verification restored.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = listQuery.data ?? [];
  const detail = detailQuery.data;
  const busy = reviewMutation.isPending || tierMutation.isPending || suspendMutation.isPending;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Investor Verification"
        subtitle="Review KYC documents and manage investor verification tiers"
      >
        {listQuery.isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#26342b]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <ShieldCheck className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="font-medium">No verification requests yet</p>
            <p className="text-sm text-gray-400 mt-1">Requests appear here when investors submit KYC documents.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="pb-3 pr-4 font-semibold">Investor</th>
                  <th className="pb-3 pr-4 font-semibold">Tier Requested</th>
                  <th className="pb-3 pr-4 font-semibold">Current Tier</th>
                  <th className="pb-3 pr-4 font-semibold">Submitted</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 pr-4 font-semibold">Documents</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[#f7f4ee]">
                    <td className="py-3.5 pr-4">
                      <p className="font-semibold text-[#26342b]">{r.investorName}</p>
                      <p className="text-xs text-gray-400">{r.investorEmail}</p>
                    </td>
                    <td className="py-3.5 pr-4 font-medium text-gray-700">{kycTierLabel(r.tierRequested)}</td>
                    <td className="py-3.5 pr-4">
                      <VerificationBadge tier={r.currentTier} size="sm" />
                    </td>
                    <td className="py-3.5 pr-4 text-gray-500">{formatDateTime(new Date(r.submittedAt))}</td>
                    <td className="py-3.5 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${reqStatusStyles[r.status]}`}>
                        {kycStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-gray-500">{r.documentCount}</td>
                    <td className="py-3.5">
                      <button
                        onClick={() => { setDetailId(r.id); setNotes(""); setReason(""); }}
                        className="px-3 py-1.5 rounded-lg bg-[#26342b] text-white text-xs font-medium hover:bg-[#3d5045] transition flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Detail modal */}
      {detailId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            {detailQuery.isLoading || !detail ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#26342b]" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#26342b]">
                      {detail.investor?.name ?? "Investor"} — {kycTierLabel(detail.request.tierRequested)} Request
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">{detail.investor?.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {detail.investor && (
                        <VerificationBadge tier={detail.investor.verificationTier} status={detail.investor.verificationStatus} size="sm" />
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${reqStatusStyles[detail.request.status]}`}>
                        {kycStatusLabel(detail.request.status)}
                      </span>
                      <span className="text-xs text-gray-400">
                        Submitted {formatDateTime(new Date(detail.request.submittedAt))}
                      </span>
                      {detail.request.reviewedAt && (
                        <span className="text-xs text-gray-400">
                          · Reviewed {formatDateTime(new Date(detail.request.reviewedAt))} by {detail.request.reviewedByName}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setDetailId(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>

                {detail.request.sourceOfFunds && (
                  <div className="mt-5 rounded-xl bg-[#f7f4ee] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Source of Funds Declaration</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.request.sourceOfFunds}</p>
                  </div>
                )}

                {/* Documents */}
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Uploaded Documents ({detail.documents.length})
                  </p>
                  {detail.documents.length === 0 ? (
                    <p className="text-sm text-gray-400">No documents attached.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {detail.documents.map((d) => (
                        <DocPreview key={d.id} doc={d} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Review actions */}
                {(detail.request.status === "pending" || detail.request.status === "more_info") && (
                  <div className="mt-6 border-t border-gray-100 pt-5">
                    <p className="text-sm font-semibold text-[#26342b] mb-3">Review Decision</p>
                    <div className="space-y-3">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        placeholder="Admin notes (shared with investor when requesting more info)…"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30 resize-y"
                      />
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        placeholder="Rejection reason (required when rejecting — sent to the investor)…"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30 resize-y"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => reviewMutation.mutate({ requestId: detail.request.id, decision: "approve", notes: notes || undefined })}
                          disabled={busy}
                          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => reviewMutation.mutate({ requestId: detail.request.id, decision: "more_info", notes: notes || undefined })}
                          disabled={busy}
                          className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Request More Info
                        </button>
                        <button
                          onClick={() => {
                            if (!reason.trim()) {
                              toast.error("A rejection reason is required.");
                              return;
                            }
                            reviewMutation.mutate({ requestId: detail.request.id, decision: "reject", notes: notes || undefined, rejectionReason: reason.trim() });
                          }}
                          disabled={busy}
                          className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tier management */}
                {detail.investor && (
                  <div className="mt-6 border-t border-gray-100 pt-5">
                    <p className="text-sm font-semibold text-[#26342b] mb-3">Tier Management</p>
                    <textarea
                      value={tierNote}
                      onChange={(e) => setTierNote(e.target.value)}
                      rows={1}
                      maxLength={2000}
                      placeholder="Optional note for the investor…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30 resize-y mb-3"
                    />
                    <div className="flex flex-wrap gap-2">
                      {KYC_TIERS.filter((t) => t.key !== detail.investor!.verificationTier).map((t) => (
                        <button
                          key={t.key}
                          onClick={() => tierMutation.mutate({ investorId: detail.investor!.id, tier: t.key, note: tierNote || undefined })}
                          disabled={busy}
                          className="px-3.5 py-2 rounded-lg bg-[#26342b] text-white text-xs font-medium hover:bg-[#3d5045] transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {t.key > detail.investor!.verificationTier ? (
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownCircle className="w-3.5 h-3.5" />
                          )}
                          Set {t.label}
                        </button>
                      ))}
                      {detail.investor.verificationStatus === "suspended" ? (
                        <button
                          onClick={() => suspendMutation.mutate({ investorId: detail.investor!.id, suspend: false, note: tierNote || undefined })}
                          disabled={busy}
                          className="px-3.5 py-2 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Lift Suspension
                        </button>
                      ) : (
                        <button
                          onClick={() => suspendMutation.mutate({ investorId: detail.investor!.id, suspend: true, note: tierNote || undefined })}
                          disabled={busy}
                          className="px-3.5 py-2 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Suspend Verification
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* History */}
                <div className="mt-6 border-t border-gray-100 pt-5">
                  <p className="text-sm font-semibold text-[#26342b] mb-3 flex items-center gap-2">
                    <History className="w-4 h-4 text-[#c47a45]" />
                    Verification History
                  </p>
                  {detail.history.length === 0 ? (
                    <p className="text-sm text-gray-400">No history yet.</p>
                  ) : (
                    <div className="space-y-3 max-h-56 overflow-y-auto pr-2">
                      {detail.history.map((h) => (
                        <div key={h.id} className="border-l-2 border-[#c47a45]/30 pl-3">
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold capitalize">{h.action.replace(/_/g, " ")}</span>
                            {h.fromTier && h.toTier && ` — ${kycTierLabel(h.fromTier)} → ${kycTierLabel(h.toTier)}`}
                          </p>
                          {h.note && <p className="text-xs text-gray-500 mt-0.5">{h.note}</p>}
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {formatDateTime(new Date(h.createdAt))}
                            {h.actorName && ` · by ${h.actorName}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
