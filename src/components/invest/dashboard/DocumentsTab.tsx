import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  FolderOpen, Search, FileText, Download, Eye, Loader2, X,
  Building2, TrendingUp, Landmark, Wallet, User,
} from "lucide-react";
import { SectionCard, EmptyState } from "./shared";
import { formatDateTime } from "@/hooks/use-investor";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUSES,
  documentCategoryLabel,
  documentStatusLabel,
} from "@contracts/documents";

interface DocRow {
  id: number;
  docRef: string;
  name: string;
  category: string;
  docType: string;
  status: string;
  reference: string | null;
  propertyName: string | null;
  fileSize: number;
  version: number;
  source: string;
  uploadedByName: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

const categoryIcons: Record<string, typeof Building2> = {
  property: Building2,
  investment: TrendingUp,
  mortgage: Landmark,
  financial: Wallet,
  personal: User,
};

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

export default function DocumentsTab() {
  const utils = trpc.useUtils();
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [previewUrl, setPreviewUrl] = useState<{ name: string; dataUrl: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const query = trpc.document.myDocuments.useQuery(
    {
      ...(category ? { category: category as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    },
    { refetchInterval: 30_000 }
  );

  const docs = (query.data ?? []) as DocRow[];

  // Deep link: /invest/dashboard?tab=documents&doc=<docRef> auto-opens the preview
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandled = useRef<string | null>(null);
  useEffect(() => {
    const docRef = searchParams.get("doc");
    if (!docRef || deepLinkHandled.current === docRef || query.isLoading) return;
    if (!query.data) return;
    deepLinkHandled.current = docRef;
    const target = (query.data as DocRow[]).find((d) => d.docRef === docRef);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("doc");
        return next;
      },
      { replace: true },
    );
    if (target) {
      void openDoc(target.id, "preview");
    } else {
      toast.info("That document is no longer available — browse your Document Center below.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, query.data, query.isLoading]);
  const counts = useMemo(() => {
    const all = (query.data ?? []) as DocRow[];
    const map = new Map<string, number>();
    for (const d of all) map.set(d.category, (map.get(d.category) ?? 0) + 1);
    return map;
  }, [query.data]);

  const openDoc = async (id: number, purpose: "preview" | "download") => {
    try {
      setBusyId(id);
      const doc = await utils.document.getDocument.fetch({ id, purpose });
      if (purpose === "preview") {
        setPreviewUrl({ name: doc.name, dataUrl: doc.dataUrl });
      } else {
        const a = document.createElement("a");
        a.href = doc.dataUrl;
        a.download = `${doc.name.replace(/[^a-z0-9]+/gi, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success("Download started.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open document");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Document Center"
        subtitle="Every receipt, agreement, certificate and statement — organized for you"
        action={<FolderOpen className="w-5 h-5 text-[#c47a45]" />}
      >
        {/* Category chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setCategory(null)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
              category === null ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {DOCUMENT_CATEGORIES.map((c) => {
            const Icon = categoryIcons[c.key];
            return (
              <button
                key={c.key}
                onClick={() => setCategory(category === c.key ? null : c.key)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                  category === c.key ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {c.label.replace(" Documents", "")}
                <span className="text-[10px] opacity-70">({counts.get(c.key) ?? 0})</span>
              </button>
            );
          })}
        </div>

        {/* Search + status filter */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, home, reference, plan or financing…"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
          >
            <option value="">All statuses</option>
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* List */}
        {query.isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#26342b]" />
          </div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            text="Receipts and agreements appear here automatically as you transact."
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {docs.map((d) => {
              const Icon = categoryIcons[d.category] ?? FileText;
              return (
                <div key={d.id} className="py-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#26342b]/5 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#26342b]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#26342b] text-sm truncate">{d.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyles[d.status] ?? statusStyles.generated}`}>
                        {documentStatusLabel(d.status)}
                      </span>
                      {d.version > 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">v{d.version}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {documentCategoryLabel(d.category)} · {d.docType}
                      {d.reference && ` · Ref ${d.reference}`}
                      {d.propertyName && ` · ${d.propertyName}`}
                      {` · ${formatSize(d.fileSize)} · ${formatDateTime(new Date(d.createdAt))}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openDoc(d.id, "preview")}
                      disabled={busyId === d.id}
                      title="Preview"
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#26342b] transition"
                    >
                      {busyId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openDoc(d.id, "download")}
                      disabled={busyId === d.id}
                      title="Download"
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#26342b] transition"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewUrl(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-[#26342b] text-sm truncate pr-4">{previewUrl.name}</p>
              <button onClick={() => setPreviewUrl(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            {previewUrl.dataUrl.startsWith("data:image/") ? (
              <div className="flex-1 overflow-auto bg-gray-50 rounded-lg flex items-center justify-center">
                <img src={previewUrl.dataUrl} alt={previewUrl.name} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <iframe src={previewUrl.dataUrl} title={previewUrl.name} className="flex-1 rounded-lg border border-gray-200" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
