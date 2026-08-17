import { useMemo, useState } from "react";
import {
  CalendarDays, Clock, MapPin, Video, Plus, X, Download, RefreshCw, Ban,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useInvestor, formatDateTime } from "@/hooks/use-investor";
import { SectionCard, EmptyState } from "./shared";
import BookAppointmentModal from "@/components/crm/BookAppointmentModal";
import { appointmentTypeLabel, APPOINTMENT_STATUSES } from "@contracts/crm";

type Appt = {
  id: number;
  appointmentRef: string;
  customerName: string;
  email: string;
  type: string;
  propertyName: string | null;
  preferredAt: Date | string;
  durationMinutes: number;
  status: string;
  location: string | null;
  meetingLink: string | null;
  assignedAdminName: string | null;
  notes: string | null;
  cancelReason: string | null;
  createdAt: Date | string;
  confirmedAt: Date | string | null;
  completedAt: Date | string | null;
  cancelledAt: Date | string | null;
};

function StatusPill({ status }: { status: string }) {
  const meta = (APPOINTMENT_STATUSES as Record<string, { label: string; color: string }>)[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: meta?.color ?? "#64748b" }}
    >
      {meta?.label ?? status}
    </span>
  );
}

function Timeline({ appt }: { appt: Appt }) {
  const steps: { label: string; at: Date | string | null; done: boolean }[] = [
    { label: "Requested", at: appt.createdAt, done: true },
    { label: appt.status === "rescheduled" ? "Rescheduled" : "Confirmed", at: appt.confirmedAt, done: !!appt.confirmedAt },
    { label: "Completed", at: appt.completedAt, done: !!appt.completedAt },
  ];
  if (appt.status === "cancelled") {
    steps.push({ label: "Cancelled", at: appt.cancelledAt, done: true });
  }
  if (appt.status === "no_show") {
    steps.push({ label: "No Show", at: null, done: true });
  }
  return (
    <div className="flex items-center gap-0 mt-3">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full border-2 ${s.done ? "bg-[#c47a45] border-[#c47a45]" : "bg-white border-gray-300"}`} />
            <span className={`text-[10px] mt-1 whitespace-nowrap ${s.done ? "text-[#26342b] font-semibold" : "text-gray-400"}`}>
              {s.label}
            </span>
            {s.at && (
              <span className="text-[9px] text-gray-400 whitespace-nowrap">
                {new Date(s.at).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}
              </span>
            )}
          </div>
          {i < steps.length - 1 && <div className={`h-0.5 flex-1 mx-1 rounded ${steps[i + 1].done ? "bg-[#c47a45]" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  );
}

export default function AppointmentsTab() {
  const { investor } = useInvestor();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appt | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ date: "", time: "10:00", note: "" });

  const apptsQuery = trpc.appointment.myAppointments.useQuery(undefined, { retry: false, refetchInterval: 30_000 });
  const appts = (apptsQuery.data ?? []) as unknown as Appt[];

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const open = appts
      .filter((a) => ["pending", "confirmed", "rescheduled"].includes(a.status) && new Date(a.preferredAt).getTime() >= now - 3 * 60 * 60_000)
      .sort((a, b) => new Date(a.preferredAt).getTime() - new Date(b.preferredAt).getTime());
    const closed = appts
      .filter((a) => !open.includes(a))
      .sort((a, b) => new Date(b.preferredAt).getTime() - new Date(a.preferredAt).getTime());
    return { upcoming: open, past: closed };
  }, [appts]);

  const cancelMutation = trpc.appointment.cancelMine.useMutation({
    onSuccess: () => {
      toast.success("Appointment request cancelled");
      apptsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const rescheduleMutation = trpc.appointment.rescheduleMine.useMutation({
    onSuccess: () => {
      toast.success("Reschedule request submitted");
      setRescheduleTarget(null);
      apptsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const pdfMutation = trpc.appointment.confirmationPdf.useMutation({
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = data.dataUrl;
      a.download = data.filename;
      a.click();
      toast.success("Confirmation downloaded");
    },
    onError: (e) => toast.error(e.message),
  });

  const renderCard = (a: Appt, isUpcoming: boolean) => (
    <div key={a.id} className="border border-gray-200 rounded-xl p-4 sm:p-5 hover:shadow-md transition">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-[#26342b]">{appointmentTypeLabel(a.type)}</h4>
            <StatusPill status={a.status} />
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{a.appointmentRef}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-[#26342b] flex items-center gap-1.5 justify-end">
            <CalendarDays className="w-4 h-4 text-[#c47a45]" />
            {formatDateTime(a.preferredAt)}
          </p>
          <p className="text-xs text-gray-500 flex items-center gap-1.5 justify-end mt-0.5">
            <Clock className="w-3.5 h-3.5" /> {a.durationMinutes} min
          </p>
        </div>
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm text-gray-600">
        {a.propertyName && (
          <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#c47a45] shrink-0" /> {a.propertyName}</p>
        )}
        {a.location && (
          <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#c47a45] shrink-0" /> {a.location}</p>
        )}
        {a.meetingLink && ["confirmed", "rescheduled"].includes(a.status) && (
          <a href={a.meetingLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#26342b] underline">
            <Video className="w-4 h-4 text-[#c47a45] shrink-0" /> Join meeting
          </a>
        )}
        {a.assignedAdminName && (
          <p className="flex items-center gap-2"><UserRound className="w-4 h-4 text-[#c47a45] shrink-0" /> Consultant: {a.assignedAdminName}</p>
        )}
      </div>

      {a.status === "pending" && (
        <p className="mt-3 text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-lg px-3 py-2">
          Awaiting confirmation — our team will confirm this appointment shortly.
        </p>
      )}
      {a.status === "cancelled" && a.cancelReason && (
        <p className="mt-3 text-xs bg-red-50 text-red-600 border border-red-100 rounded-lg px-3 py-2">
          Cancelled: {a.cancelReason}
        </p>
      )}

      <Timeline appt={a} />

      {isUpcoming && (
        <div className="flex flex-wrap gap-2 mt-4">
          {["confirmed", "rescheduled", "completed"].includes(a.status) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => pdfMutation.mutate({ id: a.id })}
              disabled={pdfMutation.isPending}
              className="text-[#26342b] border-[#26342b]/30"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Confirmation (PDF)
            </Button>
          )}
          {a.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm("Cancel this appointment request?")) cancelMutation.mutate({ id: a.id });
              }}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Ban className="w-3.5 h-3.5 mr-1.5" /> Cancel Request
            </Button>
          )}
          {["pending", "confirmed", "rescheduled"].includes(a.status) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const d = new Date(a.preferredAt);
                setRescheduleForm({
                  date: d.toISOString().slice(0, 10),
                  time: d.toTimeString().slice(0, 5),
                  note: "",
                });
                setRescheduleTarget(a);
              }}
              className="text-[#26342b] border-[#26342b]/30"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reschedule
            </Button>
          )}
        </div>
      )}
      {!isUpcoming && ["completed"].includes(a.status) && (
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => pdfMutation.mutate({ id: a.id })}
            disabled={pdfMutation.isPending}
            className="text-[#26342b] border-[#26342b]/30"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Confirmation (PDF)
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionCard
        title="My Appointments"
        subtitle="Book property inspections, virtual tours and consultations — and track every appointment"
        action={
          <Button onClick={() => setBookingOpen(true)} className="bg-[#26342b] hover:bg-[#3d5045]">
            <Plus className="w-4 h-4 mr-1.5" /> New Appointment
          </Button>
        }
      >
        {apptsQuery.isLoading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Loading appointments…</div>
        ) : appts.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No appointments yet"
            text="Book a property inspection, virtual tour, office meeting or consultation with our team."
            action={
              <Button onClick={() => setBookingOpen(true)} className="bg-[#26342b] hover:bg-[#3d5045]">
                <Plus className="w-4 h-4 mr-1.5" /> Book Your First Appointment
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Upcoming ({upcoming.length})
              </p>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-400">No upcoming appointments.</p>
              ) : (
                <div className="space-y-3">{upcoming.map((a) => renderCard(a, true))}</div>
              )}
            </div>
            {past.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Past ({past.length})
                </p>
                <div className="space-y-3">{past.slice(0, 10).map((a) => renderCard(a, false))}</div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {bookingOpen && (
        <BookAppointmentModal
          onClose={() => setBookingOpen(false)}
          prefill={{ name: investor?.name, email: investor?.email, phone: investor?.phone ?? undefined }}
          onBooked={() => apptsQuery.refetch()}
        />
      )}

      {/* Reschedule modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRescheduleTarget(null)} />
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <button
              onClick={() => setRescheduleTarget(null)}
              className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
            <h3 className="font-serif text-xl font-bold text-[#26342b] mb-1">Reschedule Appointment</h3>
            <p className="text-sm text-gray-500 mb-4">
              {appointmentTypeLabel(rescheduleTarget.type)} · {rescheduleTarget.appointmentRef}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">New Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={rescheduleForm.date}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">New Time</label>
                <input
                  type="time"
                  value={rescheduleForm.time}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, time: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Note (optional)</label>
              <textarea
                rows={2}
                value={rescheduleForm.note}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, note: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
                placeholder="Reason for rescheduling"
              />
            </div>
            <p className="text-[11px] text-gray-400 mb-3">
              Reschedule requests return to pending status until our team confirms the new time.
            </p>
            <Button
              onClick={() =>
                rescheduleMutation.mutate({
                  id: rescheduleTarget.id,
                  date: rescheduleForm.date,
                  time: rescheduleForm.time,
                  note: rescheduleForm.note || undefined,
                })
              }
              disabled={rescheduleMutation.isPending || !rescheduleForm.date}
              className="w-full bg-[#26342b] hover:bg-[#3d5045]"
            >
              {rescheduleMutation.isPending ? "Submitting…" : "Request Reschedule"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
