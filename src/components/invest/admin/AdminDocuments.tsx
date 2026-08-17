import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  FolderOpen, Search, Upload, Trash2, Eye, Loader2, X, RefreshCw,
  FileText, Download, History, Archive, CheckCircle2,
} from "lucide-react";
import { SectionCard } from "../dashboard/shared";
import { formatDateTime } from "@/hooks/use-investor";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_UPLOAD,
  documentCategoryLabel,
  documentStatusLabel,
} from "@contracts/documents";

interface AdminDocRow {
  id: number;
  docRef: string;
  name: string;
  category: string;
  docType: string;
  status: string;
  ownerName: string | null;
  ownerEmail: string | null;
  reference: string | null;
  propertyName: string | null;
  fileSize: number;
  version: number;
  source: string;
  uploadedByName: string | null;
  downloadCount: number;
  createdAt: string | Date;
}

const statusStyles: Record<string, string> = {
  available: "bg-green-100 text-green-700",
  uploaded: "bg-blue-100 text-blue-700",
  generated: "bg-[#26342b]/10 text-[#26342b]",
  pending_upload: "bg-amber-100 text-amber-700",
  awaiting_signature: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-500",
};

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readFile(file: File): Promise<{ name: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const okTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!okTypes.includes(file.type)) return reject(new Error("Only PDF, JPG, JPEG or PNG files are accepted."));
    if (file.size > DOCUMENT_UPLOAD.maxBytes) return reject(new Error("File is too large — maximum 3 MB."));
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result) });
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<string>("property");
  const [docType, setDocType] = useState<string>(DOCUMENT_TYPES.property[0]);
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [status, setStatus] = useState("available");
  const [file, setFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const utils = trpc.useUtils();

  const uploadMutation = trpc.document.uploadDocument.useMutation({
    onSuccess: (r) => {
      toast.success(`Document uploaded (${r.docRef}) — investor notified.`);
      utils.document.allDocuments.invalidate();
      onDone();
    },
    onError: (e) => {
      toast.error(e.message);
      setBusy(false);
    },
  });

  const types = DOCUMENT_TYPES[category as keyof typeof DOCUMENT_TYPES] ?? [];

  const submit = async () => {
    if (!email.includes("@")) return toast.error("Enter the customer's email address.");
    if (!docType) return toast.error("Pick a document type.");
    if (name.trim().length < 3) return toast.error("Give the document a name.");
    if (!file) return toast.error("Choose a file to upload.");
    setBusy(true);
    uploadMutation.mutate({
      investorEmail: email.trim(),
      category: category as never,
      docType: docType as never,
      name: name.trim(),
      status: status as never,
      dataUrl: file.dataUrl,
      reference: reference.trim() || null,
      propertyName: propertyName.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h3 className="font-serif text-xl font-bold text-[#26342b]">Upload Document</h3>
        <p className="text-sm text-gray-500 mt-1 mb-5">Attach an official document to a customer's Document Center.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email <span className="text-red-500">*</span></label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="customer@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setDocType((DOCUMENT_TYPES[e.target.value as keyof typeof DOCUMENT_TYPES] ?? [])[0] ?? ""); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
              >
                {types.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Name <span className="text-red-500">*</span></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Deed of Assignment — The Ivory Villa"
              maxLength={255}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference <span className="text-gray-400">(optional)</span></label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="FH-NG-2026-…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property <span className="text-gray-400">(optional)</span></label>
              <input
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="The Ivory Villa"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
            >
              {DOCUMENT_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className={`border-2 border-dashed rounded-xl p-4 ${file ? "border-green-300 bg-green-50/50" : "border-gray-200"}`}>
            {file ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700 font-medium flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 shrink-0" />
                  {file.name}
                </span>
                <button onClick={() => setFile(null)} className="text-xs text-red-500 hover:underline shrink-0">Remove</button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2 py-2 text-gray-500">
                <Upload className="w-6 h-6 text-[#c47a45]" />
                <span className="text-sm">Choose file — PDF, JPG or PNG, max 3 MB</span>
                <input
                  type="file"
                  accept={DOCUMENT_UPLOAD.accept}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    readFile(f).then(setFile).catch((err) => toast.error(err.message));
                  }}
                />
              </label>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-5 py-2.5 rounded-lg bg-[#26342b] text-white text-sm font-medium hover:bg-[#3d5045] transition disabled:opacity-50 flex items-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Upload & Assign
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ Download history modal ═══════════ */
function HistoryModal({ doc, onClose }: { doc: AdminDocRow; onClose: () => void }) {
  const historyQuery = trpc.document.downloadHistory.useQuery({ documentId: doc.id });
  const rows = historyQuery.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-serif text-xl font-bold text-[#26342b]">Download History</h3>
            <p className="text-sm text-gray-500 mt-1">{doc.name} <span className="text-gray-400">({doc.docRef})</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        {historyQuery.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#26342b]" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No downloads recorded for this document yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3 font-medium">Investor</th>
                <th className="py-2 pr-3 font-medium">Date &amp; Time</th>
                <th className="py-2 pr-3 font-medium">IP Address</th>
                <th className="py-2 font-medium">Device</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-2.5 pr-3 font-medium text-gray-700">{r.investorName ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="py-2.5 pr-3 text-gray-500">{r.ip ?? "—"}</td>
                  <td className="py-2.5 text-gray-400 text-xs max-w-[220px] truncate" title={r.userAgent ?? ""}>{r.userAgent ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ═══════════ Main admin document manager ═══════════ */
export default function AdminDocuments() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<{ name: string; dataUrl: string } | null>(null);
  const [historyDoc, setHistoryDoc] = useState<AdminDocRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminDocRow | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<AdminDocRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const docsQuery = trpc.document.allDocuments.useQuery(undefined, { refetchInterval: 30000 });
  const docs = (docsQuery.data ?? []) as AdminDocRow[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (category && d.category !== category) return false;
      if (status && d.status !== status) return false;
      if (!q) return true;
      return [d.name, d.docRef, d.docType, d.reference, d.propertyName, d.ownerName, d.ownerEmail]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [docs, search, category, status]);

  const invalidate = () => utils.document.allDocuments.invalidate();

  const replaceMutation = trpc.document.replaceDocument.useMutation({
    onSuccess: () => { toast.success("Document replaced — version bumped and customer notified."); invalidate(); },
    onError: (e) => toast.error(e.message),
    onSettled: () => { setBusyId(null); setReplaceTarget(null); },
  });
  const statusMutation = trpc.document.setDocumentStatus.useMutation({
    onSuccess: () => { toast.success("Status updated."); invalidate(); },
    onError: (e) => toast.error(e.message),
    onSettled: () => setBusyId(null),
  });
  const deleteMutation = trpc.document.deleteDocument.useMutation({
    onSuccess: () => { toast.success("Document deleted."); invalidate(); },
    onError: (e) => toast.error(e.message),
    onSettled: () => { setBusyId(null); setDeleteTarget(null); },
  });

  const openDoc = async (d: AdminDocRow, purpose: "preview" | "download") => {
    setBusyId(d.id);
    try {
      const doc = await utils.document.getDocument.fetch({ id: d.id, purpose });
      if (purpose === "download") {
        const a = document.createElement("a");
        a.href = doc.dataUrl;
        a.download = /\.(pdf|jpe?g|png)$/i.test(doc.name) ? doc.name : `${doc.name}.pdf`;
        a.click();
        toast.success("Download started.");
      } else {
        setPreview({ name: doc.name, dataUrl: doc.dataUrl });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not open the document.");
    } finally {
      setBusyId(null);
    }
  };

  const onReplaceFile = async (f: File | undefined) => {
    const target = replaceTarget;
    if (!f || !target) return;
    try {
      const { dataUrl } = await readFile(f);
      setBusyId(target.id);
      replaceMutation.mutate({ id: target.id, dataUrl });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not read the file.");
      setReplaceTarget(null);
    }
  };

  const changeStatus = (d: AdminDocRow, next: string) => {
    if (next === d.status) return;
    setBusyId(d.id);
    statusMutation.mutate({ id: d.id, status: next as never });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#26342b] flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-[#c47a45]" />
            Document Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {docs.length} document{docs.length === 1 ? "" : "s"} in the vault · auto-generated receipts appear here too.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2.5 rounded-lg bg-[#26342b] text-white text-sm font-medium hover:bg-[#3d5045] transition flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Filters */}
      <SectionCard title="Search & Filter" subtitle="Find documents by name, reference, home, customer, category or status.">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, reference, home, customer, receipt no…"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
          >
            <option value="">All Categories</option>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
          >
            <option value="">All Statuses</option>
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </SectionCard>

      {/* Table */}
      <SectionCard title={`All Documents (${filtered.length})`} subtitle="Preview, download, replace, re-status or remove any document.">
        {docsQuery.isLoading ? (
          <div className="flex justify-center py-14"><Loader2 className="w-7 h-7 animate-spin text-[#26342b]" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No documents found</p>
            <p className="text-sm text-gray-400 mt-1">Generated receipts and uploaded files will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-3 pr-4 font-medium">Document</th>
                  <th className="py-3 pr-4 font-medium">Owner</th>
                  <th className="py-3 pr-4 font-medium">Category</th>
                  <th className="py-3 pr-4 font-medium">Reference</th>
                  <th className="py-3 pr-4 font-medium">Size</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Downloads</th>
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-[#f7f4ee]/60">
                    <td className="py-3 pr-4">
                      <div className="flex items-start gap-2.5">
                        <FileText className="w-4 h-4 text-[#c47a45] mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800 leading-snug">{d.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {d.docRef} · {d.docType} · v{d.version}
                            {d.source === "generated" && <span className="ml-1 text-[#26342b]/60">(auto)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-gray-700">{d.ownerName ?? "—"}</p>
                      <p className="text-xs text-gray-400">{d.ownerEmail ?? ""}</p>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{documentCategoryLabel(d.category)}</td>
                    <td className="py-3 pr-4">
                      {d.reference ? <span className="text-gray-700 font-mono text-xs">{d.reference}</span> : <span className="text-gray-300">—</span>}
                      {d.propertyName && <p className="text-xs text-gray-400 mt-0.5">{d.propertyName}</p>}
                    </td>
                    <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{formatSize(d.fileSize)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusStyles[d.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {documentStatusLabel(d.status)}
                        </span>
                        <select
                          value={d.status}
                          onChange={(e) => changeStatus(d, e.target.value)}
                          disabled={busyId === d.id}
                          className="text-xs border border-gray-200 rounded-md px-1 py-1 text-gray-500 focus:outline-none"
                          title="Change status"
                        >
                          {DOCUMENT_STATUSES.map((s) => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => setHistoryDoc(d)}
                        className="flex items-center gap-1 text-gray-600 hover:text-[#26342b] transition"
                        title="View download history"
                      >
                        <History className="w-3.5 h-3.5" />
                        {d.downloadCount}
                      </button>
                    </td>
                    <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">
                      {formatDateTime(d.createdAt)}
                      {d.uploadedByName && <p className="text-gray-400 mt-0.5">by {d.uploadedByName}</p>}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        {busyId === d.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#26342b] mx-2" />
                        ) : (
                          <>
                            <button onClick={() => openDoc(d, "preview")} title="Preview" className="p-1.5 rounded-lg hover:bg-[#26342b]/10 text-gray-500 hover:text-[#26342b] transition">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => openDoc(d, "download")} title="Download" className="p-1.5 rounded-lg hover:bg-[#26342b]/10 text-gray-500 hover:text-[#26342b] transition">
                              <Download className="w-4 h-4" />
                            </button>
                            <button onClick={() => setReplaceTarget(d)} title="Replace file (new version)" className="p-1.5 rounded-lg hover:bg-[#26342b]/10 text-gray-500 hover:text-[#26342b] transition">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            {d.status !== "archived" ? (
                              <button onClick={() => changeStatus(d, "archived")} title="Archive" className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 transition">
                                <Archive className="w-4 h-4" />
                              </button>
                            ) : (
                              <button onClick={() => changeStatus(d, "available")} title="Restore to Available" className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => setDeleteTarget(d)} title="Delete permanently" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Replace-file prompt */}
      {replaceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReplaceTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-serif text-lg font-bold text-[#26342b]">Replace Document</h3>
            <p className="text-sm text-gray-500 mt-1 mb-5">
              Upload a new file for <span className="font-medium text-gray-700">"{replaceTarget.name}"</span>. The version moves to v{replaceTarget.version + 1} and the investor is notified.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setReplaceTarget(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <label className="px-4 py-2 rounded-lg bg-[#26342b] text-white text-sm font-medium hover:bg-[#3d5045] transition cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Choose New File
                <input
                  type="file"
                  accept={DOCUMENT_UPLOAD.accept}
                  className="hidden"
                  onChange={(e) => {
                    onReplaceFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-serif text-lg font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Document
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Permanently delete <span className="font-medium">"{deleteTarget.name}"</span> ({deleteTarget.docRef}) and its download history? The investor will lose access immediately. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={() => { setBusyId(deleteTarget.id); deleteMutation.mutate({ id: deleteTarget.id }); }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <p className="font-medium text-gray-800 truncate pr-4">{preview.name}</p>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 bg-gray-50">
              {preview.dataUrl.startsWith("data:image") ? (
                <div className="h-full overflow-auto flex items-start justify-center p-4">
                  <img src={preview.dataUrl} alt={preview.name} className="max-w-full rounded-lg shadow" />
                </div>
              ) : (
                <iframe src={preview.dataUrl} title={preview.name} className="w-full h-full" />
              )}
            </div>
          </div>
        </div>
      )}

      {historyDoc && <HistoryModal doc={historyDoc} onClose={() => setHistoryDoc(null)} />}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); invalidate(); }}
        />
      )}
    </div>
  );
}
