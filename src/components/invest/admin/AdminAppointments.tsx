import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  CalendarDays, ListChecks, ChevronLeft, ChevronRight, Search, RotateCcw,
  CheckCircle2, RefreshCw, Ban, Flag, UserRound, StickyNote, Download, X,
  MapPin, Link2, Clock, Phone, Mail, Eye, UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { appointmentTypeLabel, APPOINTMENT_TYPE_OPTIONS, APPOINTMENT_STATUSES, APPOINTMENT_STATUS_OPTIONS, APPOINTMENT_DURATIONS } from "@contracts/crm";

const inputCls =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30 bg-white";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

type Appt = {
  id: number;
  appointmentRef: string;
  leadId: number | null;
  customerName: string;
  email: string;
  phone: string;
  type: string;
  propertyName: string | null;
  preferredAt: Date | string;
  durationMinutes: number;
  assignedAdminId: number | null;
  assignedAdminName: string | null;
  location: string | null;
  meetingLink: string | null;
  notes: string | null;
  adminNotes: string | null;
  status: string;
  cancelReason: string | null;
  createdAt: Date | string;
  confirmedAt: Date | string | null;
  completedAt: Date | string | null;
  cancelledAt: Date | string | null;
};

const TYPE_COLORS: Record<string, string> = {
  property_inspection: "#26342b",
  virtual_tour: "#0ea5e9",
  office_meeting: "#c47a45",
  investment_consultation: "#16a34a",
  mortgage_consultation: "#d97706",
};

function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatusPill({ status }: { status: string }) {
  const meta = (APPOINTMENT_STATUSES as Record<string, { label: string; color: string }>)[status];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: meta?.color ?? "#64748b" }}>
      {meta?.label ?? status}
    </span>
  );
}

export default function AdminAppointments() {
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const isValidStatus = (v: string | null): v is string => !!v && v in APPOINTMENT_STATUSES;
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMode, setCalMode] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [filters, setFilters] = useState(() => ({
    status: isValidStatus(urlFilter) ? urlFilter : "",
    type: "",
    assignedAdminId: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  }));

  // Deep links from the pending-actions indicator carry ?filter=pending
  useEffect(() => {
    if (isValidStatus(urlFilter)) setFilters((f) => ({ ...f, status: urlFilter }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter]);
  const [selected, setSelected] = useState<Appt | null>(null);
  const [modal, setModal] = useState<null | "confirm" | "reschedule" | "cancel" | "notes" | "assign">(null);
  const [confirmForm, setConfirmForm] = useState({ assignedAdminId: "", location: "", meetingLink: "", durationMinutes: 60 });
  const [reschedForm, setReschedForm] = useState({ date: "", time: "10:00", note: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [assignId, setAssignId] = useState("");

  const queryInput = {
    status: filters.status || undefined,
    type: filters.type || undefined,
    assignedAdminId: filters.assignedAdminId ? Number(filters.assignedAdminId) : undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };
  const listQuery = trpc.appointment.list.useQuery(queryInput, { retry: false, refetchInterval: 30_000 });
  const adminsQuery = trpc.crm.assignableAdmins.useQuery(undefined, { retry: false });
  const appts = (listQuery.data ?? []) as unknown as Appt[];

  const refetch = () => listQuery.refetch();
  const onOk = (msg: string) => {
    toast.success(msg);
    setModal(null);
    setSelected(null);
    refetch();
  };
  const onErr = (e: { message: string }) => toast.error(e.message);

  const confirmM = trpc.appointment.confirm.useMutation({ onSuccess: () => onOk("Appointment confirmed"), onError: onErr });
  const rescheduleM = trpc.appointment.reschedule.useMutation({ onSuccess: () => onOk("Appointment rescheduled"), onError: onErr });
  const cancelM = trpc.appointment.cancel.useMutation({ onSuccess: () => onOk("Appointment cancelled"), onError: onErr });
  const completeM = trpc.appointment.complete.useMutation({ onSuccess: () => onOk("Marked completed"), onError: onErr });
  const noShowM = trpc.appointment.noShow.useMutation({ onSuccess: () => onOk("Marked as no-show"), onError: onErr });
  const assignM = trpc.appointment.assign.useMutation({ onSuccess: () => onOk("Assignee updated"), onError: onErr });
  const notesM = trpc.appointment.addNotes.useMutation({
    onSuccess: () => {
      toast.success("Note added");
      setNoteText("");
      setModal(null);
      refetch();
      // keep the detail view open with fresh data
      if (selected) {
        listQuery.refetch().then((r) => {
          const fresh = (r.data ?? []).find((a) => a.id === selected.id);
          if (fresh) setSelected(fresh as unknown as Appt);
        });
      }
    },
    onError: onErr,
  });
  const exportM = trpc.appointment.exportCsv.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.count} appointment(s)`);
    },
    onError: onErr,
  });

  // ── Calendar helpers ──
  const byDay = useMemo(() => {
    const map = new Map<string, Appt[]>();
    for (const a of appts) {
      const k = dayKey(new Date(a.preferredAt));
      const arr = map.get(k) ?? [];
      arr.push(a);
      map.set(k, arr);
    }
    for (const arr of map.values()) arr.sort((x, y) => new Date(x.preferredAt).getTime() - new Date(y.preferredAt).getTime());
    return map;
  }, [appts]);

  const moveCursor = (dir: -1 | 1) => {
    const d = new Date(cursor);
    if (calMode === "month") d.setMonth(d.getMonth() + dir);
    else if (calMode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCursor(d);
  };

  const weekDays = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [cursor]);

  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [cursor]);

  const openAction = (a: Appt, m: typeof modal) => {
    setSelected(a);
    if (m === "confirm") {
      setConfirmForm({
        assignedAdminId: a.assignedAdminId ? String(a.assignedAdminId) : "",
        location: a.location ?? "",
        meetingLink: a.meetingLink ?? "",
        durationMinutes: a.durationMinutes,
      });
    }
    if (m === "reschedule") {
      const d = new Date(a.preferredAt);
      setReschedForm({ date: dayKey(d), time: fmtTime(d), note: "" });
    }
    if (m === "cancel") setCancelReason("");
    if (m === "assign") setAssignId(a.assignedAdminId ? String(a.assignedAdminId) : "");
    setModal(m);
  };

  const dayColumn = (d: Date) => {
    const items = byDay.get(dayKey(d)) ?? [];
    return (
      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-[11px] text-gray-300 text-center py-3">No appointments</p>}
        {items.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelected(a)}
            className="w-full text-left rounded-lg px-2.5 py-2 text-white text-xs shadow-sm hover:opacity-90 transition"
            style={{ backgroundColor: TYPE_COLORS[a.type] ?? "#64748b" }}
          >
            <p className="font-semibold leading-tight">{fmtTime(a.preferredAt)} · {a.customerName}</p>
            <p className="text-white/80 leading-tight mt-0.5">{appointmentTypeLabel(a.type)}</p>
            <p className="text-white/60 text-[10px] mt-0.5 capitalize">{a.status.replace(/_/g, " ")}{a.assignedAdminName ? ` · ${a.assignedAdminName}` : ""}</p>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-gray-200 overflow-hidden bg-white">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 transition ${view === "list" ? "bg-[#26342b] text-white" : "text-[#26342b]"}`}
          >
            <ListChecks className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 transition ${view === "calendar" ? "bg-[#26342b] text-white" : "text-[#26342b]"}`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> Calendar
          </button>
        </div>
        {view === "calendar" && (
          <>
            <div className="flex rounded-full border border-gray-200 overflow-hidden bg-white">
              {(["day", "week", "month"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setCalMode(m)}
                  className={`text-xs font-semibold px-3 py-2 capitalize transition ${calMode === m ? "bg-[#c47a45] text-white" : "text-[#26342b]"}`}
                >
                  {m === "day" ? "Daily" : m === "week" ? "Weekly" : "Monthly"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => moveCursor(-1)} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#26342b] hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCursor(new Date())} className="text-xs font-semibold text-[#26342b] px-3 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50">
                Today
              </button>
              <button onClick={() => moveCursor(1)} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#26342b] hover:bg-gray-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm font-bold text-[#26342b] font-serif">
              {calMode === "month"
                ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : calMode === "week"
                  ? `${fmtDate(weekDays[0])} – ${fmtDate(weekDays[6])}`
                  : cursor.toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </>
        )}
        <Button
          variant="outline"
          className="ml-auto text-[#26342b] border-[#26342b]/30"
          disabled={exportM.isPending}
          onClick={() =>
            exportM.mutate({
              status: filters.status || undefined,
              type: filters.type || undefined,
              dateFrom: filters.dateFrom || undefined,
              dateTo: filters.dateTo || undefined,
            })
          }
        >
          <Download className="w-4 h-4 mr-1.5" /> {exportM.isPending ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="col-span-2 relative min-w-0">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={`${inputCls} w-full pl-9`}
            placeholder="Customer, email, phone, reference…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <select className={`${inputCls} w-full min-w-0`} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option>
          {APPOINTMENT_STATUS_OPTIONS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select className={`${inputCls} w-full min-w-0`} value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">All Types</option>
          {APPOINTMENT_TYPE_OPTIONS.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <select className={`${inputCls} w-full min-w-0`} value={filters.assignedAdminId} onChange={(e) => setFilters({ ...filters, assignedAdminId: e.target.value })}>
          <option value="">All Assignees</option>
          {(adminsQuery.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.displayName}</option>
          ))}
        </select>
        <div className="flex gap-2 col-span-2 md:col-span-1 min-w-0">
          <input type="date" className={`${inputCls} w-full min-w-0 flex-1`} value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          <input type="date" className={`${inputCls} w-full min-w-0 flex-1`} value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          <button onClick={() => setFilters({ status: "", type: "", assignedAdminId: "", search: "", dateFrom: "", dateTo: "" })} className="w-9 h-9 shrink-0 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#26342b]" title="Reset filters">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f7f4ee] text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appts.map((a) => (
                  <tr key={a.id} className="hover:bg-[#f7f4ee]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#26342b]">{a.customerName}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{a.appointmentRef}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[a.type] ?? "#64748b" }} />
                        {appointmentTypeLabel(a.type)}
                      </span>
                      {a.propertyName && <p className="text-[11px] text-gray-400 mt-0.5">{a.propertyName}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-gray-700">{fmtDate(a.preferredAt)}</p>
                      <p className="text-[11px] text-gray-400">{fmtTime(a.preferredAt)} · {a.durationMinutes}m</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.assignedAdminName ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3"><StatusPill status={a.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button title="View details" onClick={() => setSelected(a)} className="w-8 h-8 rounded-lg bg-[#26342b]/5 text-[#26342b] flex items-center justify-center hover:bg-[#26342b]/10">
                          <Eye className="w-4 h-4" />
                        </button>
                        {["pending", "rescheduled"].includes(a.status) && (
                          <button title="Confirm" onClick={() => openAction(a, "confirm")} className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {!["completed", "cancelled", "no_show"].includes(a.status) && (
                          <>
                            <button title="Reschedule" onClick={() => openAction(a, "reschedule")} className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button title="Cancel" onClick={() => openAction(a, "cancel")} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100">
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {["confirmed", "rescheduled", "pending"].includes(a.status) && (
                          <button title="Mark completed" onClick={() => completeM.mutate({ id: a.id })} className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center hover:bg-sky-100">
                            <Flag className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {appts.length === 0 && !listQuery.isLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">No appointments match these filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === "calendar" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          {calMode === "month" && (
            <div>
              <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells.map((d, i) => {
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const isToday = dayKey(d) === dayKey(new Date());
                  const items = byDay.get(dayKey(d)) ?? [];
                  return (
                    <div key={i} className={`min-h-[90px] rounded-lg border p-1.5 ${inMonth ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100"} ${isToday ? "ring-2 ring-[#c47a45]" : ""}`}>
                      <p className={`text-[11px] font-semibold mb-1 ${inMonth ? "text-[#26342b]" : "text-gray-300"}`}>{d.getDate()}</p>
                      <div className="space-y-1">
                        {items.slice(0, 3).map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setSelected(a)}
                            className="w-full text-left rounded px-1.5 py-0.5 text-[10px] text-white truncate"
                            style={{ backgroundColor: TYPE_COLORS[a.type] ?? "#64748b" }}
                            title={`${fmtTime(a.preferredAt)} ${appointmentTypeLabel(a.type)} — ${a.customerName}`}
                          >
                            {fmtTime(a.preferredAt)} {a.customerName}
                          </button>
                        ))}
                        {items.length > 3 && <p className="text-[10px] text-gray-400 px-1">+{items.length - 3} more</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {calMode === "week" && (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((d) => (
                <div key={dayKey(d)}>
                  <p className={`text-center text-xs font-bold mb-2 ${dayKey(d) === dayKey(new Date()) ? "text-[#c47a45]" : "text-[#26342b]"}`}>
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                    <span className="block text-[11px] font-normal text-gray-400">{d.getDate()}</span>
                  </p>
                  {dayColumn(d)}
                </div>
              ))}
            </div>
          )}
          {calMode === "day" && (
            <div className="max-w-xl mx-auto">{dayColumn(cursor)}</div>
          )}
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
            {APPOINTMENT_TYPE_OPTIONS.map((t) => (
              <span key={t.key} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[t.key] }} />
                {t.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {selected && !modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-gray-600" />
            </button>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-serif text-xl font-bold text-[#26342b]">{appointmentTypeLabel(selected.type)}</h3>
              <StatusPill status={selected.status} />
            </div>
            <p className="text-xs text-gray-400 font-mono mb-4">{selected.appointmentRef}</p>

            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2"><UserRound className="w-4 h-4 text-[#c47a45]" /> <strong className="text-[#26342b]">{selected.customerName}</strong></p>
              <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#c47a45]" /> {selected.email}</p>
              <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#c47a45]" /> {selected.phone}</p>
              <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#c47a45]" /> {fmtDate(selected.preferredAt)} at {fmtTime(selected.preferredAt)} (PT)</p>
              <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-[#c47a45]" /> {selected.durationMinutes} minutes</p>
              {selected.propertyName && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#c47a45]" /> {selected.propertyName}</p>}
              {selected.location && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#c47a45]" /> Location: {selected.location}</p>}
              {selected.meetingLink && (
                <p className="flex items-center gap-2 break-all">
                  <Link2 className="w-4 h-4 text-[#c47a45] shrink-0" />
                  <a href={selected.meetingLink} target="_blank" rel="noreferrer" className="text-[#26342b] underline">{selected.meetingLink}</a>
                </p>
              )}
              <p className="flex items-center gap-2"><UserRound className="w-4 h-4 text-[#c47a45]" /> Assigned: {selected.assignedAdminName ?? "—"}</p>
            </div>

            {selected.notes && (
              <div className="mt-4 bg-[#f7f4ee] border border-gray-200 rounded-lg px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Customer Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}
            {selected.cancelReason && (
              <div className="mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm text-red-600">
                Cancellation reason: {selected.cancelReason}
              </div>
            )}
            {selected.adminNotes && (
              <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 mb-1">Meeting Notes</p>
                <p className="text-xs text-amber-800 whitespace-pre-wrap">{selected.adminNotes}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-5">
              {["pending", "rescheduled"].includes(selected.status) && (
                <Button onClick={() => openAction(selected, "confirm")} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm
                </Button>
              )}
              {!["completed", "cancelled", "no_show"].includes(selected.status) && (
                <>
                  <Button variant="outline" onClick={() => openAction(selected, "reschedule")}>
                    <RefreshCw className="w-4 h-4 mr-1.5" /> Reschedule
                  </Button>
                  <Button variant="outline" onClick={() => openAction(selected, "assign")}>
                    <UserRound className="w-4 h-4 mr-1.5" /> Assign
                  </Button>
                  <Button variant="outline" onClick={() => openAction(selected, "cancel")} className="text-red-600 border-red-200 hover:bg-red-50">
                    <Ban className="w-4 h-4 mr-1.5" /> Cancel
                  </Button>
                </>
              )}
              {["confirmed", "rescheduled", "pending"].includes(selected.status) && (
                <>
                  <Button variant="outline" onClick={() => completeM.mutate({ id: selected.id })} className="text-sky-600 border-sky-200 hover:bg-sky-50">
                    <Flag className="w-4 h-4 mr-1.5" /> Completed
                  </Button>
                  <Button variant="outline" onClick={() => noShowM.mutate({ id: selected.id })} className="text-gray-500 border-gray-200 hover:bg-gray-50">
                    <UserX className="w-4 h-4 mr-1.5" /> No Show
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => openAction(selected, "notes")} className="col-span-2">
                <StickyNote className="w-4 h-4 mr-1.5" /> Add Meeting Notes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM MODAL ── */}
      {selected && modal === "confirm" && (
        <ActionModal title="Confirm Appointment" onClose={() => setModal(null)}>
          <div>
            <label className={labelCls}>Assign To</label>
            <select className={`${inputCls} w-full`} value={confirmForm.assignedAdminId} onChange={(e) => setConfirmForm({ ...confirmForm, assignedAdminId: e.target.value })}>
              <option value="">Unassigned</option>
              {(adminsQuery.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.displayName}{a.role === "primary" ? " (Primary)" : ""}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Availability is checked automatically — double-booking is blocked.</p>
          </div>
          <div>
            <label className={labelCls}>Meeting Location</label>
            <input className={`${inputCls} w-full`} value={confirmForm.location} onChange={(e) => setConfirmForm({ ...confirmForm, location: e.target.value })} placeholder="Office address, property site…" />
          </div>
          <div>
            <label className={labelCls}>Google Meet / Zoom Link (optional)</label>
            <input className={`${inputCls} w-full`} value={confirmForm.meetingLink} onChange={(e) => setConfirmForm({ ...confirmForm, meetingLink: e.target.value })} placeholder="https://meet.google.com/…" />
          </div>
          <div>
            <label className={labelCls}>Duration</label>
            <select className={`${inputCls} w-full`} value={confirmForm.durationMinutes} onChange={(e) => setConfirmForm({ ...confirmForm, durationMinutes: Number(e.target.value) })}>
              {APPOINTMENT_DURATIONS.map((d) => (
                <option key={d} value={d}>{d} minutes</option>
              ))}
            </select>
          </div>
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={confirmM.isPending}
            onClick={() =>
              confirmM.mutate({
                id: selected.id,
                assignedAdminId: confirmForm.assignedAdminId ? Number(confirmForm.assignedAdminId) : null,
                location: confirmForm.location || undefined,
                meetingLink: confirmForm.meetingLink || undefined,
                durationMinutes: confirmForm.durationMinutes,
              })
            }
          >
            {confirmM.isPending ? "Confirming…" : "Confirm Appointment"}
          </Button>
        </ActionModal>
      )}

      {/* ── RESCHEDULE MODAL ── */}
      {selected && modal === "reschedule" && (
        <ActionModal title="Reschedule Appointment" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>New Date</label>
              <input type="date" className={`${inputCls} w-full`} value={reschedForm.date} onChange={(e) => setReschedForm({ ...reschedForm, date: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>New Time</label>
              <input type="time" className={`${inputCls} w-full`} value={reschedForm.time} onChange={(e) => setReschedForm({ ...reschedForm, time: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Note for Customer (optional)</label>
            <textarea rows={2} className={`${inputCls} w-full resize-none`} value={reschedForm.note} onChange={(e) => setReschedForm({ ...reschedForm, note: e.target.value })} />
          </div>
          <Button
            className="w-full bg-[#26342b] hover:bg-[#3d5045]"
            disabled={rescheduleM.isPending || !reschedForm.date}
            onClick={() => rescheduleM.mutate({ id: selected.id, date: reschedForm.date, time: reschedForm.time, note: reschedForm.note || undefined })}
          >
            {rescheduleM.isPending ? "Saving…" : "Reschedule"}
          </Button>
        </ActionModal>
      )}

      {/* ── CANCEL MODAL ── */}
      {selected && modal === "cancel" && (
        <ActionModal title="Cancel Appointment" onClose={() => setModal(null)}>
          <p className="text-sm text-gray-500">The customer will be notified of the cancellation.</p>
          <div>
            <label className={labelCls}>Reason *</label>
            <textarea rows={3} className={`${inputCls} w-full resize-none`} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why is this appointment being cancelled?" />
          </div>
          <Button
            className="w-full bg-red-600 hover:bg-red-700"
            disabled={cancelM.isPending || !cancelReason.trim()}
            onClick={() => cancelM.mutate({ id: selected.id, reason: cancelReason.trim() })}
          >
            {cancelM.isPending ? "Cancelling…" : "Cancel Appointment"}
          </Button>
        </ActionModal>
      )}

      {/* ── ASSIGN MODAL ── */}
      {selected && modal === "assign" && (
        <ActionModal title="Assign Administrator" onClose={() => setModal(null)}>
          <div>
            <label className={labelCls}>Assign To</label>
            <select className={`${inputCls} w-full`} value={assignId} onChange={(e) => setAssignId(e.target.value)}>
              <option value="">Unassigned</option>
              {(adminsQuery.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.displayName}{a.role === "primary" ? " (Primary)" : ""}</option>
              ))}
            </select>
          </div>
          <Button
            className="w-full bg-[#26342b] hover:bg-[#3d5045]"
            disabled={assignM.isPending}
            onClick={() => assignM.mutate({ id: selected.id, adminId: assignId ? Number(assignId) : null })}
          >
            {assignM.isPending ? "Saving…" : "Save Assignment"}
          </Button>
        </ActionModal>
      )}

      {/* ── NOTES MODAL ── */}
      {selected && modal === "notes" && (
        <ActionModal title="Meeting Notes" onClose={() => setModal(null)}>
          {selected.adminNotes && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 max-h-40 overflow-y-auto">
              <p className="text-xs text-amber-800 whitespace-pre-wrap">{selected.adminNotes}</p>
            </div>
          )}
          <div>
            <label className={labelCls}>Add Note</label>
            <textarea rows={4} className={`${inputCls} w-full resize-none`} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Outcome of the meeting, next steps…" />
          </div>
          <Button
            className="w-full bg-[#26342b] hover:bg-[#3d5045]"
            disabled={notesM.isPending || !noteText.trim()}
            onClick={() => notesM.mutate({ id: selected.id, note: noteText.trim() })}
          >
            {notesM.isPending ? "Saving…" : "Add Note"}
          </Button>
        </ActionModal>
      )}
    </div>
  );
}

function ActionModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-3">
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
          <X className="w-4 h-4 text-gray-600" />
        </button>
        <h3 className="font-serif text-lg font-bold text-[#26342b]">{title}</h3>
        {children}
      </div>
    </div>
  );
}
