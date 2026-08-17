import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { LEAD_SOURCE_OPTIONS, BUDGET_RANGES, PREFERRED_CONTACT_METHODS } from "@contracts/crm";

type LeadLike = {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  source: string;
  interestedProperty: string | null;
  investmentInterest: string | null;
  mortgageInterest: string | null;
  budgetRange: string | null;
  preferredContact: string | null;
  notes: string | null;
};

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

/** Create or edit a lead. Pass `lead` to edit, omit to create. */
export default function CrmLeadForm({
  lead,
  onClose,
  onSaved,
}: {
  lead?: LeadLike | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!lead;
  const [form, setForm] = useState({
    fullName: lead?.fullName ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    whatsapp: lead?.whatsapp ?? "",
    country: lead?.country ?? "",
    state: lead?.state ?? "",
    city: lead?.city ?? "",
    source: lead?.source ?? "manual",
    interestedProperty: lead?.interestedProperty ?? "",
    investmentInterest: lead?.investmentInterest ?? "",
    mortgageInterest: lead?.mortgageInterest ?? "",
    budgetRange: lead?.budgetRange ?? "",
    preferredContact: lead?.preferredContact ?? "",
    notes: lead?.notes ?? "",
  });

  const createMutation = trpc.crm.createLead.useMutation({
    onSuccess: () => {
      toast.success("Lead created");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.crm.updateLead.useMutation({
    onSuccess: () => {
      toast.success("Lead updated");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = createMutation.isPending || updateMutation.isPending;

  const submit = () => {
    if (!form.fullName.trim()) return toast.error("Full name is required");
    if (!editing && !form.email.trim()) return toast.error("Email is required");
    if (editing && lead) {
      updateMutation.mutate({
        id: lead.id,
        fullName: form.fullName.trim(),
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        country: form.country || null,
        state: form.state || null,
        city: form.city || null,
        interestedProperty: form.interestedProperty || null,
        investmentInterest: form.investmentInterest || null,
        mortgageInterest: form.mortgageInterest || null,
        budgetRange: form.budgetRange || null,
        preferredContact: form.preferredContact || null,
        notes: form.notes || null,
      });
    } else {
      createMutation.mutate({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone || undefined,
        whatsapp: form.whatsapp || undefined,
        country: form.country || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        source: form.source,
        interestedProperty: form.interestedProperty || undefined,
        investmentInterest: form.investmentInterest || undefined,
        mortgageInterest: form.mortgageInterest || undefined,
        budgetRange: form.budgetRange || undefined,
        preferredContact: form.preferredContact || undefined,
        notes: form.notes || undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
          <X className="w-4 h-4 text-gray-600" />
        </button>
        <h3 className="font-serif text-xl font-bold text-[#26342b] mb-4">
          {editing ? "Edit Lead" : "Add New Lead"}
        </h3>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Full Name *</label>
            <input className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input className={inputCls} type="email" value={form.email} disabled={editing} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>WhatsApp</label>
            <input className={inputCls} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input className={inputCls} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>State</label>
              <input className={inputCls} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          {!editing && (
            <div>
              <label className={labelCls}>Lead Source</label>
              <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {LEAD_SOURCE_OPTIONS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Budget Range</label>
            <select className={inputCls} value={form.budgetRange} onChange={(e) => setForm({ ...form, budgetRange: e.target.value })}>
              <option value="">—</option>
              {BUDGET_RANGES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Preferred Contact</label>
            <select className={inputCls} value={form.preferredContact} onChange={(e) => setForm({ ...form, preferredContact: e.target.value })}>
              <option value="">—</option>
              {PREFERRED_CONTACT_METHODS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Interested Property</label>
            <input className={inputCls} value={form.interestedProperty} onChange={(e) => setForm({ ...form, interestedProperty: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Investment Interest</label>
            <input className={inputCls} value={form.investmentInterest} onChange={(e) => setForm({ ...form, investmentInterest: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Mortgage Interest</label>
            <input className={inputCls} value={form.mortgageInterest} onChange={(e) => setForm({ ...form, mortgageInterest: e.target.value })} />
          </div>
        </div>

        <div className="mt-3">
          <label className={labelCls}>Notes</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <Button onClick={submit} disabled={pending} className="w-full mt-4 bg-[#26342b] hover:bg-[#3d5045]">
          {pending ? "Saving…" : editing ? "Save Changes" : "Create Lead"}
        </Button>
      </div>
    </div>
  );
}
