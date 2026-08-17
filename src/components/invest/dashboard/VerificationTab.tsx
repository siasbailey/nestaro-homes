import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  ShieldCheck, Upload, FileText, Clock, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Download, History, ArrowUpCircle,
} from "lucide-react";
import { SectionCard } from "./shared";
import { formatDateTime, formatCurrency } from "@/hooks/use-investor";
import VerificationBadge from "@/components/invest/VerificationBadge";
import {
  KYC_DOC_TYPES,
  KYC_REQUIRED_DOCS,
  KYC_TIERS,
  KYC_UPLOAD,
  kycDocTypeLabel,
  kycStatusLabel,
  kycTier,
  kycTierLabel,
} from "@contracts/kyc";

interface DocState {
  docType: string;
  name: string;
  dataUrl: string;
}

const statusStyles: Record<string, { classes: string; Icon: typeof Clock }> = {
  not_started: { classes: "bg-gray-100 text-gray-600", Icon: Clock },
  pending: { classes: "bg-blue-100 text-blue-700", Icon: Clock },
  approved: { classes: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  rejected: { classes: "bg-red-100 text-red-700", Icon: XCircle },
  more_info: { classes: "bg-amber-100 text-amber-700", Icon: AlertTriangle },
  suspended: { classes: "bg-red-100 text-red-700", Icon: XCircle },
};

function DocUploadSlot({
  docType,
  label,
  hint,
  required,
  file,
  onFile,
}: {
  docType: string;
  label: string;
  hint: string;
  required?: boolean;
  file: DocState | null;
  onFile: (f: DocState | null) => void;
}) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const okTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!okTypes.includes(f.type)) {
      toast.error("Only PDF, JPG, JPEG or PNG files are accepted.");
      return;
    }
    if (f.size > KYC_UPLOAD.maxBytes) {
      toast.error("File is too large — maximum 3 MB per file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onFile({ docType, name: f.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  };

  return (
    <div className={`border-2 border-dashed rounded-xl p-4 transition ${file ? "border-green-300 bg-green-50/50" : "border-gray-200 hover:border-[#c47a45]/50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#26342b]">
            {label} {required && <span className="text-red-500">*</span>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
        </div>
        {file ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-green-700 font-medium flex items-center gap-1 max-w-[140px] truncate">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              {file.name}
            </span>
            <button onClick={() => onFile(null)} className="text-xs text-red-500 hover:underline">Remove</button>
          </div>
        ) : (
          <label className="shrink-0 cursor-pointer px-3 py-1.5 rounded-lg bg-[#26342b] text-white text-xs font-medium hover:bg-[#3d5045] transition flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            Upload
            <input type="file" accept={KYC_UPLOAD.accept} className="hidden" onChange={handle} />
          </label>
        )}
      </div>
    </div>
  );
}

export default function VerificationTab() {
  const utils = trpc.useUtils();
  const query = trpc.kyc.myVerification.useQuery(undefined, { refetchInterval: 20_000 });
  const data = query.data;

  const [docs, setDocs] = useState<Record<string, DocState | null>>({});
  const [extraDocs, setExtraDocs] = useState<DocState[]>([]);
  const [sourceOfFunds, setSourceOfFunds] = useState("");

  const invalidate = () => {
    utils.kyc.myVerification.invalidate();
    utils.investor.dashboard.invalidate();
  };

  const submitMutation = trpc.kyc.submitRequest.useMutation({
    onSuccess: () => {
      toast.success("Verification request submitted — status: Pending Review.");
      setDocs({});
      setExtraDocs([]);
      setSourceOfFunds("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const additionalMutation = trpc.kyc.uploadAdditional.useMutation({
    onSuccess: () => {
      toast.success("Documents uploaded — your request is back in the review queue.");
      setExtraDocs([]);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (query.isLoading || !data) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#26342b]" />
      </div>
    );
  }

  const tierInfo = kycTier(data.tier);
  const nextTier = data.nextTier;
  const nextTierInfo = nextTier ? kycTier(nextTier) : null;
  const open = data.openRequest;
  const st = statusStyles[data.status] ?? statusStyles.not_started;

  const checklist = [
    { label: "Account Registration", done: true },
    { label: "Email Verification", done: data.emailVerified },
    { label: "Phone Number Provided", done: !!data.phone },
  ];

  const requiredDocs = nextTier ? (KYC_REQUIRED_DOCS[nextTier] ?? []) : [];
  const canSubmit =
    !!nextTier &&
    requiredDocs.every((d) => docs[d]) &&
    (nextTier !== "tier3" || (sourceOfFunds.trim().length > 0 && extraDocs.length > 0));

  const submit = () => {
    if (!nextTier) return;
    const allDocs = [...Object.values(docs).filter(Boolean), ...extraDocs] as DocState[];
    submitMutation.mutate({
      tierRequested: nextTier,
      sourceOfFunds: nextTier === "tier3" ? sourceOfFunds.trim() : undefined,
      documents: allDocs.map((d) => ({ docType: d.docType, name: d.name, dataUrl: d.dataUrl })),
    });
  };

  return (
    <div className="space-y-6">
      {/* Current level */}
      <SectionCard title="Verification Status" subtitle="Your verification level determines your deposit and plan limits">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <VerificationBadge tier={data.tier} status={data.status} />
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${st.classes}`}>
                <st.Icon className="w-3.5 h-3.5" />
                {kycStatusLabel(data.status)}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              <div className="rounded-xl bg-[#f7f4ee] p-4">
                <p className="text-xs text-gray-500">Maximum Deposit (per transaction)</p>
                <p className="text-lg font-bold text-[#26342b] font-serif mt-1">{formatCurrency(data.limits.maxDeposit)}</p>
              </div>
              <div className="rounded-xl bg-[#f7f4ee] p-4">
                <p className="text-xs text-gray-500">Maximum Plan Amount (per transaction)</p>
                <p className="text-lg font-bold text-[#26342b] font-serif mt-1">{formatCurrency(data.limits.maxInvestment)}</p>
              </div>
            </div>
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{tierInfo.label} Checklist</p>
              <div className="space-y-1.5">
                {checklist.map((c) => (
                  <p key={c.label} className="text-sm flex items-center gap-2">
                    {c.done ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-300" />
                    )}
                    <span className={c.done ? "text-gray-700" : "text-gray-400"}>{c.label}</span>
                  </p>
                ))}
              </div>
              {(!data.emailVerified || !data.phone) && (
                <p className="text-xs text-gray-400 mt-2">
                  Complete these in Settings to finish your Tier 1 profile.
                </p>
              )}
            </div>
          </div>

          {/* Tier ladder */}
          <div className="md:w-64 shrink-0 space-y-2">
            {KYC_TIERS.map((t) => (
              <div
                key={t.key}
                className={`rounded-xl border p-3 ${
                  t.key === data.tier ? "border-[#c47a45] bg-[#c47a45]/5" : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <VerificationBadge tier={t.key} size="sm" />
                  {t.key === data.tier && <span className="text-[10px] font-bold text-[#c47a45] uppercase">Current</span>}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Deposit {formatCurrency(t.maxDeposit)} · Invest {formatCurrency(t.maxInvestment)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Open request status */}
      {open && (
        <SectionCard
          title={open.status === "more_info" ? "More Information Required" : "Request Under Review"}
          subtitle={`${kycTierLabel(open.tierRequested)} request · submitted ${formatDateTime(new Date(open.submittedAt))}`}
        >
          {open.status === "more_info" ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                <p className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  The review team requested additional information
                </p>
                {open.adminNotes && <p className="mt-1.5">Note: {open.adminNotes}</p>}
              </div>
              <DocUploadSlot
                docType="additional"
                label="Additional Document"
                hint="Upload the document requested by the review team (PDF, JPG or PNG, max 3 MB)"
                file={extraDocs[0] ?? null}
                onFile={(f) => setExtraDocs(f ? [f] : [])}
              />
              {data.openDocuments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Documents Already Submitted</p>
                  <div className="space-y-1.5">
                    {data.openDocuments.map((d) => (
                      <p key={d.id} className="text-sm text-gray-600 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#c47a45]" />
                        {kycDocTypeLabel(d.docType)} — {d.name}
                        <a href={d.dataUrl} download={d.name} className="text-[#26342b] hover:underline ml-1">
                          <Download className="w-3.5 h-3.5 inline" />
                        </a>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => extraDocs.length > 0 && additionalMutation.mutate({ documents: extraDocs })}
                disabled={extraDocs.length === 0 || additionalMutation.isPending}
                className="px-5 py-2.5 rounded-lg bg-[#26342b] text-white text-sm font-medium hover:bg-[#3d5045] transition disabled:opacity-50 flex items-center gap-2"
              >
                {additionalMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Additional Documents
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                Your documents are being reviewed. You'll receive a notification once a decision is made.
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Documents Submitted ({data.openDocuments.length})</p>
                <div className="space-y-1.5">
                  {data.openDocuments.map((d) => (
                    <p key={d.id} className="text-sm text-gray-600 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#c47a45]" />
                      {kycDocTypeLabel(d.docType)} — {d.name}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Rejection notice + resubmit */}
      {!open && data.status === "rejected" && data.lastRequest && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <p className="font-semibold flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Your previous {kycTierLabel(data.lastRequest.tierRequested)} request was rejected
          </p>
          {data.lastRequest.rejectionReason && <p className="mt-1.5">Reason: {data.lastRequest.rejectionReason}</p>}
          <p className="mt-1.5">You can submit a new request below with corrected documents.</p>
        </div>
      )}

      {/* Upgrade form */}
      {!open && nextTierInfo && (
        <SectionCard
          title={`Upgrade to ${nextTierInfo.label}`}
          subtitle="Upload the required documents — the review team will verify them and notify you"
          action={<ArrowUpCircle className="w-5 h-5 text-[#c47a45]" />}
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-[#f7f4ee] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Requirements</p>
              <ul className="space-y-1">
                {nextTierInfo.requirements.map((r) => (
                  <li key={r} className="text-sm text-gray-600 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#c47a45]" />
                    {r}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-400 mt-2">
                New limits after approval: Deposit {formatCurrency(nextTierInfo.maxDeposit)} · Invest {formatCurrency(nextTierInfo.maxInvestment)}
              </p>
            </div>

            {nextTier === "tier2" &&
              requiredDocs.map((dt) => {
                const meta = KYC_DOC_TYPES.find((d) => d.key === dt)!;
                return (
                  <DocUploadSlot
                    key={dt}
                    docType={dt}
                    label={meta.label}
                    hint={meta.hint}
                    required
                    file={docs[dt] ?? null}
                    onFile={(f) => setDocs((s) => ({ ...s, [dt]: f }))}
                  />
                );
              })}

            {nextTier === "tier3" && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[#26342b] mb-1">
                    Source of Funds Declaration <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={sourceOfFunds}
                    onChange={(e) => setSourceOfFunds(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Describe the origin of the funds you invest with Nestaro Homes (e.g. employment income, business revenue, property sales)…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30 resize-y"
                  />
                </div>
                <DocUploadSlot
                  docType="additional"
                  label="Supporting Document"
                  hint="Any document supporting your declaration (PDF, JPG or PNG, max 3 MB)"
                  required
                  file={extraDocs[0] ?? null}
                  onFile={(f) => setExtraDocs(f ? [f] : [])}
                />
              </>
            )}

            <button
              onClick={submit}
              disabled={!canSubmit || submitMutation.isPending}
              className="px-5 py-2.5 rounded-lg bg-[#26342b] text-white text-sm font-medium hover:bg-[#3d5045] transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit {nextTierInfo.label} Request
            </button>
          </div>
        </SectionCard>
      )}

      {!nextTier && data.tier === "tier3" && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          You hold the highest verification level — full platform limits are active on your account.
        </div>
      )}

      {/* History */}
      <SectionCard title="Verification History" subtitle="Every verification event on your account" action={<History className="w-5 h-5 text-[#c47a45]" />}>
        {data.history.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No verification activity yet.</p>
        ) : (
          <div className="space-y-3">
            {data.history.map((h) => (
              <div key={h.id} className="flex items-start gap-3 border-l-2 border-[#c47a45]/30 pl-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold capitalize text-[#26342b]">{h.action.replace(/_/g, " ")}</span>
                    {h.fromTier && h.toTier && ` — ${kycTierLabel(h.fromTier)} → ${kycTierLabel(h.toTier)}`}
                  </p>
                  {h.note && <p className="text-xs text-gray-500 mt-0.5">{h.note}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {formatDateTime(new Date(h.createdAt))}
                    {h.actorName && ` · by ${h.actorName}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
