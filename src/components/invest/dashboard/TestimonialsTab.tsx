import { useState } from "react";
import { Star, X, CheckCircle2, Clock, XCircle, Archive, Camera, Quote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { SectionCard, EmptyState } from "./shared";
import { TESTIMONIAL_STATUSES, TESTIMONIAL_PHOTO } from "@contracts/testimonials";

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30";

type MyTestimonial = {
  id: number;
  rating: number;
  title: string | null;
  message: string;
  propertyName: string | null;
  investmentPlan: string | null;
  mortgagePlan: string | null;
  status: string;
  adminNote: string | null;
  featured: string;
  createdAt: Date | string;
};

function Stars({ value, onChange, size = "w-7 h-7" }: { value: number; onChange?: (v: number) => void; size?: string }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i)}
          className={onChange ? "cursor-pointer hover:scale-110 transition" : "cursor-default"}
        >
          <Star className={`${size} ${i <= value ? "text-yellow-500 fill-current" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = (TESTIMONIAL_STATUSES as Record<string, { label: string; color: string }>)[status];
  const Icon = status === "approved" ? CheckCircle2 : status === "pending" ? Clock : status === "rejected" ? XCircle : Archive;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: meta?.color ?? "#64748b" }}>
      <Icon className="w-3 h-3" /> {meta?.label ?? status}
    </span>
  );
}

export default function TestimonialsTab() {
  const eligibilityQuery = trpc.testimonial.eligibility.useQuery(undefined, { retry: false });
  const myQuery = trpc.testimonial.myTestimonials.useQuery(undefined, { retry: false });
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ rating: 5, title: "", message: "", propertyName: "", investmentPlan: "", mortgagePlan: "" });
  const [photo, setPhoto] = useState<{ dataUrl: string; size: number } | null>(null);

  const submitMutation = trpc.testimonial.submit.useMutation({
    onSuccess: () => {
      toast.success("Testimonial submitted — pending admin approval");
      setFormOpen(false);
      setForm({ rating: 5, title: "", message: "", propertyName: "", investmentPlan: "", mortgagePlan: "" });
      setPhoto(null);
      myQuery.refetch();
      eligibilityQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const mine = (myQuery.data ?? []) as unknown as MyTestimonial[];
  const eligible = eligibilityQuery.data?.eligible ?? false;
  const hasActive = mine.some((t) => t.status === "pending" || t.status === "approved");

  const pickPhoto = (file: File) => {
    if (file.size > TESTIMONIAL_PHOTO.maxBytes) return toast.error("Photo exceeds the 2 MB limit");
    const reader = new FileReader();
    reader.onload = () => setPhoto({ dataUrl: String(reader.result), size: file.size });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Share Your Experience"
        subtitle="Tell others about your journey with Nestaro Homes — approved testimonials appear on our website"
        action={
          eligible && !hasActive && !formOpen ? (
            <Button onClick={() => setFormOpen(true)} className="bg-[#26342b] hover:bg-[#3d5045]">
              <Star className="w-4 h-4 mr-1.5" /> Write a Testimonial
            </Button>
          ) : undefined
        }
      >
        {!eligibilityQuery.data ? (
          <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : !eligible ? (
          <EmptyState
            icon={Quote}
            title="Testimonials unlock after your first milestone"
            text="Once you complete account verification, join a home plan, or purchase a home, you can share your experience here."
          />
        ) : formOpen ? (
          <div className="max-w-2xl">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Your Rating *</label>
                <Stars value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Title (optional)</label>
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. A seamless buying experience"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Your Testimonial * (min 20 characters)</label>
                <textarea
                  rows={5}
                  className={`${inputCls} resize-none`}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Share your experience with Nestaro Homes — the process, the team, the outcome…"
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Property (optional)</label>
                  <input className={inputCls} value={form.propertyName} onChange={(e) => setForm({ ...form, propertyName: e.target.value })} placeholder="e.g. Sunrise Villa" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Home Plan (optional)</label>
                  <input className={inputCls} value={form.investmentPlan} onChange={(e) => setForm({ ...form, investmentPlan: e.target.value })} placeholder="e.g. Premium Plan" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mortgage Plan (optional)</label>
                  <input className={inputCls} value={form.mortgagePlan} onChange={(e) => setForm({ ...form, mortgagePlan: e.target.value })} placeholder="e.g. 5-Year Plan" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Profile Photo (optional, JPG/PNG, max 2 MB)</label>
                {photo ? (
                  <div className="flex items-center gap-3">
                    <img src={photo.dataUrl} alt="Profile" className="w-14 h-14 rounded-full object-cover border-2 border-[#c47a45]" />
                    <button onClick={() => setPhoto(null)} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#26342b] border border-dashed border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:border-[#c47a45] transition">
                    <Camera className="w-4 h-4" /> Upload photo
                    <input
                      type="file"
                      accept={TESTIMONIAL_PHOTO.accept}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) pickPhoto(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button
                onClick={() =>
                  submitMutation.mutate({
                    rating: form.rating,
                    title: form.title || undefined,
                    message: form.message.trim(),
                    propertyName: form.propertyName || undefined,
                    investmentPlan: form.investmentPlan || undefined,
                    mortgagePlan: form.mortgagePlan || undefined,
                    photo: photo ?? undefined,
                  })
                }
                disabled={submitMutation.isPending || form.message.trim().length < 20}
                className="bg-[#26342b] hover:bg-[#3d5045]"
              >
                {submitMutation.isPending ? "Submitting…" : "Submit for Review"}
              </Button>
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              Your testimonial will be reviewed by our team before it appears on the website. You'll be notified of the decision.
            </p>
          </div>
        ) : mine.length === 0 ? (
          <EmptyState
            icon={Quote}
            title="You haven't shared a testimonial yet"
            text="Your feedback helps other buyers and investors trust Nestaro Homes. It only takes a minute."
            action={
              <Button onClick={() => setFormOpen(true)} className="bg-[#26342b] hover:bg-[#3d5045]">
                <Star className="w-4 h-4 mr-1.5" /> Write a Testimonial
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {mine.map((t) => (
              <div key={t.id} className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <Stars value={t.rating} size="w-4 h-4" />
                  <StatusBadge status={t.status} />
                </div>
                {t.title && <p className="font-bold text-[#26342b] mb-1">{t.title}</p>}
                <p className="text-sm text-gray-600 leading-relaxed">{t.message}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-400">
                  <span>{new Date(t.createdAt).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  {t.propertyName && <span>Property: {t.propertyName}</span>}
                  {t.investmentPlan && <span>Plan: {t.investmentPlan}</span>}
                  {t.mortgagePlan && <span>Mortgage: {t.mortgagePlan}</span>}
                  {t.featured === "yes" && t.status === "approved" && <span className="text-[#c47a45] font-semibold">Featured on homepage ★</span>}
                </div>
                {t.status === "rejected" && t.adminNote && (
                  <p className="mt-3 text-xs bg-red-50 text-red-600 border border-red-100 rounded-lg px-3 py-2">
                    Review note: {t.adminNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
