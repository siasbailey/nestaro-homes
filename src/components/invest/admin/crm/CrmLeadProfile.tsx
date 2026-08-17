import { useState } from "react";
import {
  X, Mail, Phone, MessageCircle, MapPin, Globe, Wallet, Contact2, Building2,
  TrendingUp, Landmark, StickyNote, PhoneCall, MailCheck, CalendarDays, Plus,
  CheckCircle2, CircleSlash, AlarmClock, UserRound, Pencil, CalendarPlus, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import CrmLeadForm from "./CrmLeadForm";
import CrmFollowUpForm from "./CrmFollowUpForm";
import {
  leadSourceLabel, leadActivityLabel, appointmentTypeLabel,
  FOLLOWUP_PRIORITIES, APPOINTMENT_TYPE_OPTIONS, APPOINTMENT_DURATIONS,
} from "@contracts/crm";

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

const ACTIVITY_ICONS: Record<string, typeof StickyNote> = {
  created: Plus,
  note: StickyNote,
  email: MailCheck,
  call: PhoneCall,
  whatsapp: MessageCircle,
  meeting: UserRound,
  stage_change: TrendingUp,
  assignment: Contact2,
  follow_up: AlarmClock,
  appointment: CalendarDays,
  property_reserved: Building2,
  mortgage_applied: Landmark,
  investment_started: TrendingUp,
  property_purchased: Building2,
  deal_closed: CheckCircle2,
  registered: UserRound,
  system: StickyNote,
};

function fmtDt(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CrmLeadProfile({ leadId, onClose }: { leadId: number; onClose: () => void }) {
  const profileQuery = trpc.crm.lead.useQuery({ id: leadId }, { retry: false, refetchInterval: 30_000 });
  const adminsQuery = trpc.crm.assignableAdmins.useQuery(undefined, { retry: false });
  const data = profileQuery.data;

  const [editOpen, setEditOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [activity, setActivity] = useState({ type: "note", description: "", notes: "" });
  const [bookForm, setBookForm] = useState({ type: "property_inspection", date: "", time: "10:00", duration: 60, location: "", meetingLink: "", notes: "" });

  const refetch = () => profileQuery.refetch();

  const changeStage = trpc.crm.changeStage.useMutation({
    onSuccess: () => { toast.success("Stage updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const assignLead = trpc.crm.assignLead.useMutation({
    onSuccess: () => { toast.success("Assignment updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const addActivity = trpc.crm.addActivity.useMutation({
    onSuccess: () => { setActivity({ type: "note", description: "", notes: "" }); toast.success("Activity logged"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const setFollowUpStatus = trpc.crm.setFollowUpStatus.useMutation({
    onSuccess: () => { toast.success("Follow-up updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const createForLead = trpc.appointment.createForLead.useMutation({
    onSuccess: (r) => { toast.success(`Appointment created (${r.reference})`); setBookOpen(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl p-10">
          <div className="w-10 h-10 border-4 border-[#26342b] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const { lead, timeline, followUps, appointments, stages } = data;
  const stage = stages.find((s) => s.stageKey === lead.stage);
  const pendingFollowUps = followUps.filter((f) => f.status === "pending");

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-3xl bg-[#f7f4ee] shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#26342b] text-white px-6 py-5">
          <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-12 h-12 rounded-full bg-[#c47a45] flex items-center justify-center font-bold text-lg">
              {lead.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-xl font-bold truncate">{lead.fullName}</h2>
              <p className="text-xs text-white/60 font-mono">{lead.leadRef} · {leadSourceLabel(lead.source)}</p>
            </div>
            {stage && (
              <span className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ backgroundColor: stage.color }}>
                {stage.label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit Profile
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFollowUpOpen(true)} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <AlarmClock className="w-3.5 h-3.5 mr-1.5" /> Schedule Follow-up
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBookOpen(true)} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <CalendarPlus className="w-3.5 h-3.5 mr-1.5" /> Book Appointment
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Contact + interests */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <p className="flex items-center gap-2 text-gray-600"><Mail className="w-4 h-4 text-[#c47a45] shrink-0" /> <a className="text-[#26342b] hover:underline break-all" href={`mailto:${lead.email}`}>{lead.email}</a></p>
              <p className="flex items-center gap-2 text-gray-600"><Phone className="w-4 h-4 text-[#c47a45] shrink-0" /> {lead.phone ?? "—"}</p>
              <p className="flex items-center gap-2 text-gray-600"><MessageCircle className="w-4 h-4 text-[#c47a45] shrink-0" /> {lead.whatsapp ?? "—"}</p>
              <p className="flex items-center gap-2 text-gray-600"><Globe className="w-4 h-4 text-[#c47a45] shrink-0" /> {[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "—"}</p>
              <p className="flex items-center gap-2 text-gray-600"><Wallet className="w-4 h-4 text-[#c47a45] shrink-0" /> {lead.budgetRange ?? "Budget unknown"}</p>
              <p className="flex items-center gap-2 text-gray-600"><Contact2 className="w-4 h-4 text-[#c47a45] shrink-0" /> Prefers: {lead.preferredContact ?? "—"}</p>
              {lead.interestedProperty && <p className="flex items-center gap-2 text-gray-600 sm:col-span-2"><Building2 className="w-4 h-4 text-[#c47a45] shrink-0" /> Property: <strong className="text-[#26342b]">{lead.interestedProperty}</strong></p>}
              {lead.investmentInterest && <p className="flex items-center gap-2 text-gray-600"><TrendingUp className="w-4 h-4 text-[#c47a45] shrink-0" /> Investment: {lead.investmentInterest}</p>}
              {lead.mortgageInterest && <p className="flex items-center gap-2 text-gray-600"><Landmark className="w-4 h-4 text-[#c47a45] shrink-0" /> Mortgage: {lead.mortgageInterest}</p>}
            </div>
            {lead.notes && (
              <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm text-amber-800 whitespace-pre-wrap">{lead.notes}</div>
            )}
            <p className="text-[11px] text-gray-400 mt-3">
              Created {fmtDt(lead.createdAt)} · Last contact {lead.lastContactAt ? fmtDt(lead.lastContactAt) : "never"}
              {lead.investorId ? " · Registered customer ✓" : ""}
            </p>
          </div>

          {/* Stage + assignment */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Pipeline Stage</label>
              <select
                className={inputCls}
                value={lead.stage}
                onChange={(e) => changeStage.mutate({ id: lead.id, stage: e.target.value })}
                disabled={changeStage.isPending}
              >
                {stages.map((s) => (
                  <option key={s.stageKey} value={s.stageKey}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Assigned To</label>
              <select
                className={inputCls}
                value={lead.assignedAdminId ?? ""}
                onChange={(e) => assignLead.mutate({ id: lead.id, adminId: e.target.value ? Number(e.target.value) : null })}
                disabled={assignLead.isPending}
              >
                <option value="">Unassigned</option>
                {(adminsQuery.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.displayName}{a.role === "primary" ? " (Primary)" : ""}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Log activity */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h4 className="font-bold text-[#26342b] mb-3 text-sm uppercase tracking-wider">Log Activity</h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
              {(["note", "call", "email", "whatsapp", "meeting"] as const).map((t) => {
                const Icon = ACTIVITY_ICONS[t];
                return (
                  <button
                    key={t}
                    onClick={() => setActivity({ ...activity, type: t })}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition ${
                      activity.type === t ? "bg-[#26342b] text-white border-[#26342b]" : "border-gray-200 text-gray-600 hover:border-[#c47a45]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {leadActivityLabel(t).replace(" Logged", "").replace(" Sent", "")}
                  </button>
                );
              })}
            </div>
            <input
              className={`${inputCls} mb-2`}
              placeholder="Short description (e.g. Called — interested in 3BR duplex)"
              value={activity.description}
              onChange={(e) => setActivity({ ...activity, description: e.target.value })}
            />
            <textarea
              className={`${inputCls} resize-none mb-3`}
              rows={2}
              placeholder="Notes (optional)"
              value={activity.notes}
              onChange={(e) => setActivity({ ...activity, notes: e.target.value })}
            />
            <Button
              size="sm"
              onClick={() => {
                if (!activity.description.trim()) return toast.error("Description is required");
                addActivity.mutate({ leadId: lead.id, type: activity.type as never, description: activity.description.trim(), notes: activity.notes || undefined });
              }}
              disabled={addActivity.isPending}
              className="bg-[#26342b] hover:bg-[#3d5045]"
            >
              {addActivity.isPending ? "Saving…" : "Add to Timeline"}
            </Button>
          </div>

          {/* Follow-ups */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-[#26342b] text-sm uppercase tracking-wider">Follow-ups ({pendingFollowUps.length} pending)</h4>
              <Button size="sm" variant="outline" onClick={() => setFollowUpOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
            {followUps.length === 0 ? (
              <p className="text-sm text-gray-400">No follow-ups scheduled.</p>
            ) : (
              <div className="space-y-2">
                {followUps.slice(0, 6).map((f) => {
                  const overdue = f.status === "pending" && new Date(f.dueAt) < new Date();
                  const p = (FOLLOWUP_PRIORITIES as Record<string, { label: string; color: string }>)[f.priority];
                  return (
                    <div key={f.id} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 text-sm ${overdue ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p?.color ?? "#64748b" }} title={p?.label} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${f.status !== "pending" ? "line-through text-gray-400" : "text-[#26342b]"}`}>{f.title}</p>
                        <p className="text-xs text-gray-400">
                          {fmtDt(f.dueAt)} · {f.assignedAdminName ?? "Anyone"}
                          {overdue && <span className="text-red-500 font-semibold"> · Overdue</span>}
                          {f.status !== "pending" && <span> · {f.status}{f.completedByName ? ` by ${f.completedByName}` : ""}</span>}
                        </p>
                      </div>
                      {f.status === "pending" && (
                        <div className="flex gap-1 shrink-0">
                          <button title="Mark completed" onClick={() => setFollowUpStatus.mutate({ id: f.id, status: "completed" })} className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center hover:bg-green-200">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button title="Cancel" onClick={() => setFollowUpStatus.mutate({ id: f.id, status: "cancelled" })} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200">
                            <CircleSlash className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Appointments */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-[#26342b] text-sm uppercase tracking-wider">Appointments ({appointments.length})</h4>
              <Button size="sm" variant="outline" onClick={() => setBookOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Book
              </Button>
            </div>
            {appointments.length === 0 ? (
              <p className="text-sm text-gray-400">No appointments for this lead.</p>
            ) : (
              <div className="space-y-2">
                {appointments.slice(0, 6).map((a) => (
                  <div key={a.id} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-[#26342b]">{appointmentTypeLabel(a.type)}</p>
                      <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-[#26342b]/5 text-[#26342b]">{a.status.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{a.appointmentRef} · {fmtDt(a.preferredAt)}{a.propertyName ? ` · ${a.propertyName}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h4 className="font-bold text-[#26342b] mb-4 text-sm uppercase tracking-wider">Timeline ({timeline.length})</h4>
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-400">No activity yet.</p>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-0.5 before:bg-gray-200">
                {timeline.map((t) => {
                  const Icon = ACTIVITY_ICONS[t.type] ?? StickyNote;
                  return (
                    <div key={t.id} className="relative">
                      <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                        <Icon className="w-3 h-3 text-[#c47a45]" />
                      </div>
                      <p className="text-sm text-[#26342b] font-medium">{t.description}</p>
                      {t.notes && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{t.notes}</p>}
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {fmtDt(t.createdAt)}{t.adminName ? ` · ${t.adminName}` : ""} · {leadActivityLabel(t.type)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {editOpen && (
        <CrmLeadForm lead={lead as never} onClose={() => setEditOpen(false)} onSaved={refetch} />
      )}
      {followUpOpen && (
        <CrmFollowUpForm leadId={lead.id} onClose={() => setFollowUpOpen(false)} onSaved={refetch} />
      )}

      {/* Book appointment modal */}
      {bookOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBookOpen(false)} />
          <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl p-6">
            <button onClick={() => setBookOpen(false)} className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-gray-600" />
            </button>
            <h3 className="font-serif text-xl font-bold text-[#26342b] mb-1">Book Appointment</h3>
            <p className="text-sm text-gray-500 mb-4">For {lead.fullName} · created as pending</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Type</label>
                <select className={inputCls} value={bookForm.type} onChange={(e) => setBookForm({ ...bookForm, type: e.target.value })}>
                  {APPOINTMENT_TYPE_OPTIONS.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" className={inputCls} value={bookForm.date} onChange={(e) => setBookForm({ ...bookForm, date: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Time</label>
                  <input type="time" className={inputCls} value={bookForm.time} onChange={(e) => setBookForm({ ...bookForm, time: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Duration</label>
                  <select className={inputCls} value={bookForm.duration} onChange={(e) => setBookForm({ ...bookForm, duration: Number(e.target.value) })}>
                    {APPOINTMENT_DURATIONS.map((d) => (
                      <option key={d} value={d}>{d}m</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}><MapPin className="w-3 h-3 inline mr-1" />Location</label>
                <input className={inputCls} value={bookForm.location} onChange={(e) => setBookForm({ ...bookForm, location: e.target.value })} placeholder="Office, site address…" />
              </div>
              <div>
                <label className={labelCls}><Link2 className="w-3 h-3 inline mr-1" />Meeting Link (optional)</label>
                <input className={inputCls} value={bookForm.meetingLink} onChange={(e) => setBookForm({ ...bookForm, meetingLink: e.target.value })} placeholder="https://meet.google.com/…" />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea rows={2} className={`${inputCls} resize-none`} value={bookForm.notes} onChange={(e) => setBookForm({ ...bookForm, notes: e.target.value })} />
              </div>
            </div>
            <Button
              className="w-full mt-4 bg-[#26342b] hover:bg-[#3d5045]"
              disabled={createForLead.isPending || !bookForm.date}
              onClick={() =>
                createForLead.mutate({
                  leadId: lead.id,
                  type: bookForm.type as never,
                  date: bookForm.date,
                  time: bookForm.time,
                  duration: bookForm.duration,
                  location: bookForm.location || undefined,
                  meetingLink: bookForm.meetingLink || undefined,
                  notes: bookForm.notes || undefined,
                })
              }
            >
              {createForLead.isPending ? "Creating…" : "Create Appointment"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
