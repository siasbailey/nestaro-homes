import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Star, Plus, Search, X, CheckCircle2, XCircle, Archive, Trash2, Pencil,
  ArrowUp, ArrowDown, BadgeCheck, LayoutDashboard, List, Quote, Camera,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { TESTIMONIAL_STATUSES, TESTIMONIAL_PHOTO } from "@contracts/testimonials";

const NAVY = "#26342b";
const COPPER = "#c47a45";
const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

type T = {
  id: number;
  investorId: number | null;
  customerName: string;
  photo: string | null;
  propertyName: string | null;
  investmentPlan: string | null;
  mortgagePlan: string | null;
  rating: number;
  title: string | null;
  message: string;
  status: string;
  featured: string;
  adminNote: string | null;
  reviewedByName: string | null;
  createdAt: Date | string;
};

function Stars({ value, size = "w-4 h-4" }: { value: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= value ? "text-yellow-500 fill-current" : "text-gray-300"}`} />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = (TESTIMONIAL_STATUSES as Record<string, { label: string; color: string }>)[status];
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: meta?.color ?? "#64748b" }}>
      {meta?.label ?? status}
    </span>
  );
}

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 border ${accent ? "bg-gradient-to-br from-[#c47a45] to-[#a6632f] border-transparent text-white" : "bg-white border-gray-200"}`}>
      <p className={`text-xs font-medium ${accent ? "text-white/80" : "text-gray-500"}`}>{label}</p>
      <p className={`text-xl font-bold font-serif mt-1 ${accent ? "text-white" : "text-[#26342b]"}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-1 ${accent ? "text-white/70" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

function Analytics() {
  const q = trpc.testimonial.analytics.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  const data = q.data;
  if (q.isLoading) return <p className="py-10 text-center text-gray-400 text-sm">Loading analytics…</p>;
  if (!data) return null;
  const { cards, charts } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card label="Total Testimonials" value={String(cards.total)} accent />
        <Card label="Pending Approval" value={String(cards.pending)} />
        <Card label="Approved" value={String(cards.approved)} />
        <Card label="Rejected" value={String(cards.rejected)} />
        <Card label="Average Rating" value={`${cards.avgRating}★`} />
        <Card label="Featured on Homepage" value={String(cards.featured)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h4 className="font-bold text-[#26342b] text-sm mb-4">Rating Distribution</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.distribution} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="rating" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip />
                <Bar dataKey="count" fill={NAVY} radius={[4, 4, 0, 0]} name="Testimonials" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h4 className="font-bold text-[#26342b] text-sm mb-4">Monthly Submissions</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.monthly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip />
                <Bar dataKey="count" fill={COPPER} radius={[4, 4, 0, 0]} name="Submissions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h4 className="font-bold text-[#26342b] text-sm mb-4">Testimonials by Property</h4>
          {charts.byProperty.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No property-linked testimonials yet.</p>
          ) : (
            <div className="space-y-2">
              {charts.byProperty.map((p) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 flex-1 truncate">{p.name}</span>
                  <span className="text-xs font-bold text-[#26342b] bg-[#26342b]/5 rounded-full px-2.5 py-0.5">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h4 className="font-bold text-[#26342b] text-sm mb-4">Testimonials by Investment Plan</h4>
          {charts.byPlan.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No plan-linked testimonials yet.</p>
          ) : (
            <div className="space-y-2">
              {charts.byPlan.map((p) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 flex-1 truncate">{p.name}</span>
                  <span className="text-xs font-bold text-[#26342b] bg-[#26342b]/5 rounded-full px-2.5 py-0.5">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminTestimonials() {
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const isValidStatus = (v: string | null): v is string => !!v && v in TESTIMONIAL_STATUSES;
  const [view, setView] = useState<"list" | "analytics">("list");
  const [statusFilter, setStatusFilter] = useState(() => (isValidStatus(urlFilter) ? urlFilter : ""));

  // Deep links from the pending-actions indicator carry ?filter=pending
  useEffect(() => {
    if (isValidStatus(urlFilter)) setStatusFilter(urlFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<T | null>(null);
  const [reviewTarget, setReviewTarget] = useState<T | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [form, setForm] = useState({ customerName: "", rating: 5, title: "", message: "", propertyName: "", investmentPlan: "", mortgagePlan: "", featured: false });
  const [photo, setPhoto] = useState<{ dataUrl: string; size: number } | null>(null);

  const listQuery = trpc.testimonial.adminList.useQuery(
    { status: statusFilter || undefined, search: search || undefined },
    { retry: false, refetchInterval: 30_000 },
  );
  const rows = (listQuery.data ?? []) as unknown as T[];
  const approved = rows.filter((t) => t.status === "approved");

  const refetch = () => listQuery.refetch();
  const onErr = (e: { message: string }) => toast.error(e.message);

  const reviewM = trpc.testimonial.review.useMutation({
    onSuccess: () => { toast.success("Review saved"); setReviewTarget(null); setReviewNote(""); refetch(); },
    onError: onErr,
  });
  const featureM = trpc.testimonial.setFeatured.useMutation({
    onSuccess: () => { toast.success("Homepage featuring updated"); refetch(); },
    onError: onErr,
  });
  const statusM = trpc.testimonial.setStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
    onError: onErr,
  });
  const deleteM = trpc.testimonial.deleteTestimonial.useMutation({
    onSuccess: () => { toast.success("Testimonial deleted"); refetch(); },
    onError: onErr,
  });
  const reorderM = trpc.testimonial.reorder.useMutation({ onError: onErr });
  const createM = trpc.testimonial.createTestimonial.useMutation({
    onSuccess: () => { toast.success("Testimonial published"); closeForm(); refetch(); },
    onError: onErr,
  });
  const updateM = trpc.testimonial.updateTestimonial.useMutation({
    onSuccess: () => { toast.success("Testimonial updated"); closeForm(); refetch(); },
    onError: onErr,
  });

  const closeForm = () => {
    setFormOpen(false);
    setEditTarget(null);
    setForm({ customerName: "", rating: 5, title: "", message: "", propertyName: "", investmentPlan: "", mortgagePlan: "", featured: false });
    setPhoto(null);
  };

  const openEdit = (t: T) => {
    setEditTarget(t);
    setForm({
      customerName: t.customerName,
      rating: t.rating,
      title: t.title ?? "",
      message: t.message,
      propertyName: t.propertyName ?? "",
      investmentPlan: t.investmentPlan ?? "",
      mortgagePlan: t.mortgagePlan ?? "",
      featured: t.featured === "yes",
    });
    setFormOpen(true);
  };

  const move = (index: number, dir: -1 | 1) => {
    const ids = approved.map((t) => t.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorderM.mutate({ ids }, { onSuccess: () => refetch() });
  };

  const pickPhoto = (file: File) => {
    if (file.size > TESTIMONIAL_PHOTO.maxBytes) return toast.error("Photo exceeds the 2 MB limit");
    const reader = new FileReader();
    reader.onload = () => setPhoto({ dataUrl: String(reader.result), size: file.size });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-gray-200 overflow-hidden bg-white">
          <button onClick={() => setView("list")} className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 transition ${view === "list" ? "bg-[#26342b] text-white" : "text-[#26342b]"}`}>
            <List className="w-3.5 h-3.5" /> Testimonials
          </button>
          <button onClick={() => setView("analytics")} className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 transition ${view === "analytics" ? "bg-[#26342b] text-white" : "text-[#26342b]"}`}>
            <LayoutDashboard className="w-3.5 h-3.5" /> Analytics
          </button>
        </div>
        <Button onClick={() => { closeForm(); setFormOpen(true); }} className="ml-auto bg-[#26342b] hover:bg-[#3d5045]">
          <Plus className="w-4 h-4 mr-1.5" /> Add Testimonial
        </Button>
      </div>

      {view === "analytics" && <Analytics />}

      {view === "list" && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className={`${inputCls} pl-9`} placeholder="Name, title, property, message…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {Object.values(TESTIMONIAL_STATUSES).map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {listQuery.isLoading ? (
              <p className="px-4 py-10 text-center text-gray-400 text-sm">Loading testimonials…</p>
            ) : rows.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Quote className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No testimonials match these filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {rows.map((t) => {
                  const approvedIdx = approved.findIndex((a) => a.id === t.id);
                  return (
                    <div key={t.id} className="px-4 py-4 flex gap-3">
                      {t.photo ? (
                        <img src={t.photo} alt={t.customerName} className="w-11 h-11 rounded-full object-cover border-2 border-[#c47a45] shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#26342b] text-white flex items-center justify-center font-bold shrink-0">
                          {t.customerName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-[#26342b] text-sm">{t.customerName}</p>
                          {t.investorId && (
                            <span title="Verified customer"><BadgeCheck className="w-4 h-4 text-[#c47a45]" /></span>
                          )}
                          <Stars value={t.rating} size="w-3.5 h-3.5" />
                          <StatusBadge status={t.status} />
                          {t.featured === "yes" && t.status === "approved" && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#c47a45] text-white">Homepage ★</span>
                          )}
                        </div>
                        {t.title && <p className="text-sm font-semibold text-gray-700 mt-0.5">{t.title}</p>}
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.message}</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {[t.propertyName && `Property: ${t.propertyName}`, t.investmentPlan && `Plan: ${t.investmentPlan}`, t.mortgagePlan && `Mortgage: ${t.mortgagePlan}`].filter(Boolean).join(" · ") || "General testimonial"}
                          {t.reviewedByName && ` · Reviewed by ${t.reviewedByName}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex gap-1">
                          {t.status === "pending" && (
                            <button title="Review" onClick={() => { setReviewTarget(t); setReviewNote(""); }} className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          {t.status === "approved" && (
                            <>
                              <button
                                title={t.featured === "yes" ? "Remove from homepage" : "Feature on homepage"}
                                onClick={() => featureM.mutate({ id: t.id, featured: t.featured !== "yes" })}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${t.featured === "yes" ? "bg-[#c47a45] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                              >
                                <Star className="w-4 h-4" />
                              </button>
                              <button title="Move up" disabled={approvedIdx <= 0 || reorderM.isPending} onClick={() => move(approvedIdx, -1)} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 disabled:opacity-30">
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button title="Move down" disabled={approvedIdx === approved.length - 1 || reorderM.isPending} onClick={() => move(approvedIdx, 1)} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 disabled:opacity-30">
                                <ArrowDown className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button title="Edit" onClick={() => openEdit(t)} className="w-8 h-8 rounded-lg bg-[#26342b]/5 text-[#26342b] flex items-center justify-center hover:bg-[#26342b]/10">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {t.status !== "archived" && (
                            <button title="Archive" onClick={() => statusM.mutate({ id: t.id, status: "archived" })} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200">
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            title="Delete"
                            onClick={() => {
                              if (window.confirm(`Delete the testimonial from ${t.customerName}? (soft delete)`)) deleteM.mutate({ id: t.id });
                            }}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create / Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <button onClick={closeForm} className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-gray-600" />
            </button>
            <h3 className="font-serif text-xl font-bold text-[#26342b] mb-4">{editTarget ? "Edit Testimonial" : "Add Testimonial"}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Customer Name *</label>
                <input className={inputCls} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Rating *</label>
                <select className={inputCls} value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>{r} star{r === 1 ? "" : "s"}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Title</label>
                <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Testimonial *</label>
                <textarea rows={4} className={`${inputCls} resize-none`} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Property Purchased</label>
                <input className={inputCls} value={form.propertyName} onChange={(e) => setForm({ ...form, propertyName: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Investment Plan</label>
                <input className={inputCls} value={form.investmentPlan} onChange={(e) => setForm({ ...form, investmentPlan: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Mortgage Plan</label>
                <input className={inputCls} value={form.mortgagePlan} onChange={(e) => setForm({ ...form, mortgagePlan: e.target.value })} />
              </div>
              {!editTarget && (
                <div>
                  <label className={labelCls}>Photo (optional)</label>
                  {photo ? (
                    <div className="flex items-center gap-3">
                      <img src={photo.dataUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-[#c47a45]" />
                      <button onClick={() => setPhoto(null)} className="text-xs text-red-500 hover:underline">Remove</button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-[#26342b] border border-dashed border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:border-[#c47a45] transition">
                      <Camera className="w-4 h-4" /> Upload
                      <input type="file" accept={TESTIMONIAL_PHOTO.accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
              )}
              {!editTarget && (
                <label className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
                  <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="rounded" />
                  Feature on homepage immediately
                </label>
              )}
            </div>
            <Button
              className="w-full mt-4 bg-[#26342b] hover:bg-[#3d5045]"
              disabled={createM.isPending || updateM.isPending || !form.customerName.trim() || form.message.trim().length < 10}
              onClick={() => {
                if (editTarget) {
                  updateM.mutate({
                    id: editTarget.id,
                    customerName: form.customerName.trim(),
                    rating: form.rating,
                    title: form.title || null,
                    message: form.message.trim(),
                    propertyName: form.propertyName || null,
                    investmentPlan: form.investmentPlan || null,
                    mortgagePlan: form.mortgagePlan || null,
                  });
                } else {
                  createM.mutate({
                    customerName: form.customerName.trim(),
                    rating: form.rating,
                    title: form.title || undefined,
                    message: form.message.trim(),
                    propertyName: form.propertyName || undefined,
                    investmentPlan: form.investmentPlan || undefined,
                    mortgagePlan: form.mortgagePlan || undefined,
                    featured: form.featured,
                    photo: photo ?? undefined,
                  });
                }
              }}
            >
              {createM.isPending || updateM.isPending ? "Saving…" : editTarget ? "Save Changes" : "Publish Testimonial"}
            </Button>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReviewTarget(null)} />
          <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6">
            <button onClick={() => setReviewTarget(null)} className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-gray-600" />
            </button>
            <h3 className="font-serif text-lg font-bold text-[#26342b] mb-1">Review Testimonial</h3>
            <p className="text-xs text-gray-400 mb-3">{reviewTarget.customerName} · {reviewTarget.rating}★</p>
            <div className="bg-[#f7f4ee] border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 max-h-40 overflow-y-auto mb-3">
              {reviewTarget.title && <p className="font-semibold text-[#26342b] mb-1">{reviewTarget.title}</p>}
              {reviewTarget.message}
            </div>
            <div className="mb-4">
              <label className={labelCls}>Internal Note (optional — shared with the customer on rejection)</label>
              <textarea rows={2} className={`${inputCls} resize-none`} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="bg-green-600 hover:bg-green-700" disabled={reviewM.isPending} onClick={() => reviewM.mutate({ id: reviewTarget.id, decision: "approved", note: reviewNote || undefined })}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve
              </Button>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={reviewM.isPending} onClick={() => reviewM.mutate({ id: reviewTarget.id, decision: "rejected", note: reviewNote || undefined })}>
                <XCircle className="w-4 h-4 mr-1.5" /> Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
