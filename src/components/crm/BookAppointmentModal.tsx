import { useEffect, useState } from "react";
import { X, CalendarDays, Clock, CheckCircle2, MapPin, Video, Building2, TrendingUp, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { APPOINTMENT_TYPE_OPTIONS, APPOINTMENT_DURATIONS, type AppointmentTypeKey } from "@contracts/crm";

const TYPE_ICONS: Record<string, typeof MapPin> = {
  property_inspection: MapPin,
  virtual_tour: Video,
  office_meeting: Building2,
  investment_consultation: TrendingUp,
  mortgage_consultation: Landmark,
};

interface Props {
  onClose: () => void;
  productId?: number;
  propertyName?: string;
  defaultType?: AppointmentTypeKey;
  prefill?: { name?: string; email?: string; phone?: string };
  onBooked?: () => void;
}

export default function BookAppointmentModal({ onClose, productId, propertyName, defaultType, prefill, onBooked }: Props) {
  const [form, setForm] = useState({
    name: prefill?.name ?? "",
    email: prefill?.email ?? "",
    phone: prefill?.phone ?? "",
    type: (defaultType ?? (productId ? "property_inspection" : "property_inspection")) as AppointmentTypeKey,
    date: "",
    time: "10:00",
    duration: 60,
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [bookedRef, setBookedRef] = useState<string | null>(null);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const bookMutation = trpc.appointment.book.useMutation({
    onSuccess: (data) => {
      setBookedRef(data.reference);
      onBooked?.();
    },
    onError: (err) => setError(err.message),
  });

  const minDate = new Date().toISOString().slice(0, 10);

  const submit = () => {
    setError(null);
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Please fill in your name, email and phone number.");
      return;
    }
    if (!form.date) {
      setError("Please choose a preferred date.");
      return;
    }
    bookMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      type: form.type,
      productId,
      date: form.date,
      time: form.time,
      duration: form.duration,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[#e5e7eb]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center z-10 transition"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>

        {bookedRef ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-[#26342b] mb-2">Request Received</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your appointment request has been submitted. Our team will confirm it shortly — you'll receive a
              notification and email once confirmed.
            </p>
            <div className="bg-[#f7f4ee] rounded-xl p-4 mb-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Booking Reference</p>
              <p className="font-mono font-bold text-lg text-[#26342b]">{bookedRef}</p>
            </div>
            <Button onClick={onClose} className="w-full bg-[#26342b] hover:bg-[#3d5045]">
              Done
            </Button>
          </div>
        ) : (
          <div className="p-6">
            <h3 className="font-serif text-2xl font-bold text-[#26342b] mb-1">Book an Appointment</h3>
            <p className="text-sm text-gray-500 mb-5">
              {propertyName ? (
                <>Schedule a viewing or consultation for <strong className="text-[#26342b]">{propertyName}</strong>.</>
              ) : (
                "Schedule a home viewing, virtual tour, meeting or consultation with our team."
              )}
            </p>

            {/* Appointment type picker */}
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Appointment Type</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {APPOINTMENT_TYPE_OPTIONS.filter((t) => propertyName || t.key !== "property_inspection" || true).map((t) => {
                const Icon = TYPE_ICONS[t.key] ?? CalendarDays;
                const active = form.type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setForm({ ...form, type: t.key as AppointmentTypeKey, duration: t.defaultDuration })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition text-left ${
                      active
                        ? "border-[#26342b] bg-[#26342b] text-white"
                        : "border-gray-200 text-gray-600 hover:border-[#c47a45]"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[#c47a45]" : "text-[#c47a45]"}`} />
                    <span className="leading-tight">{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Full Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
                  placeholder="Your full name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
                    placeholder="you@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Phone *</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
                    placeholder="+1 ..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    <CalendarDays className="w-3 h-3 inline mr-1" />
                    Date *
                  </label>
                  <input
                    type="date"
                    min={minDate}
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Time *
                  </label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Duration</label>
                  <select
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
                  >
                    {APPOINTMENT_DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30 resize-none"
                  placeholder="Anything we should know before the meeting?"
                />
              </div>
            </div>

            {error && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button
              onClick={submit}
              disabled={bookMutation.isPending}
              className="w-full mt-4 bg-[#26342b] transition text-base py-6"
            >
              {bookMutation.isPending ? "Submitting…" : "Request Appointment"}
            </Button>
            <p className="text-[11px] text-gray-400 text-center mt-2">
              All times are Pacific Time (PT). Our team confirms every request personally.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
