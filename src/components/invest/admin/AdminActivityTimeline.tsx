import { useState } from "react";
import { Search, RotateCcw, Activity } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { ACTIVITY_MODULES, activityActionLabel } from "@contracts/messaging";

const inputCls =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30 bg-white";

const QUICK = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "financial", label: "Financial Actions" },
  { key: "users", label: "User Activities" },
  { key: "property", label: "Property Activities" },
  { key: "security", label: "Security Events" },
] as const;

type Row = {
  id: number;
  adminId: number | null;
  adminName: string;
  action: string;
  details: string | null;
  module: string;
  createdAt: Date | string;
};

function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AdminActivityTimeline() {
  const [filters, setFilters] = useState({ search: "", adminId: "", module: "", dateFrom: "", dateTo: "", quick: "" as "" | (typeof QUICK)[number]["key"] });

  const timelineQuery = trpc.activity.timeline.useQuery(
    {
      search: filters.search || undefined,
      adminId: filters.adminId ? Number(filters.adminId) : undefined,
      module: filters.module || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      quick: filters.quick || undefined,
    },
    { retry: false, refetchInterval: 30_000 },
  );

  const data = timelineQuery.data;
  const rows = (data?.activities ?? []) as unknown as Row[];
  const moduleMeta = new Map<string, { key: string; label: string; color: string }>(
    (data?.modules ?? []).map((m) => [m.key, m]),
  );

  // Group by day for the timeline rail
  let lastDay = "";

  return (
    <div className="space-y-4">
      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q.key}
            onClick={() => setFilters({ ...filters, quick: filters.quick === q.key ? "" : q.key })}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              filters.quick === q.key ? "bg-[#26342b] text-white border-[#26342b]" : "bg-white text-[#26342b] border-gray-200 hover:border-[#c47a45]"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="col-span-2 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className={`${inputCls} w-full pl-9`} placeholder="Admin, action, reference, details…" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <select className={inputCls} value={filters.adminId} onChange={(e) => setFilters({ ...filters, adminId: e.target.value })}>
          <option value="">All Admins</option>
          {(data?.admins ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.displayName}</option>
          ))}
        </select>
        <select className={inputCls} value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}>
          <option value="">All Modules</option>
          {Object.values(ACTIVITY_MODULES).map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input type="date" className={`${inputCls} w-full`} value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          <input type="date" className={`${inputCls} w-full`} value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
        </div>
        <button onClick={() => setFilters({ search: "", adminId: "", module: "", dateFrom: "", dateTo: "", quick: "" })} className="text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:text-[#26342b] transition flex items-center justify-center gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[#26342b]">
            {data ? `${data.total} activit${data.total === 1 ? "y" : "ies"}` : "Loading…"}
          </p>
          <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live — refreshes every 30s
          </span>
        </div>

        {timelineQuery.isLoading ? (
          <p className="py-10 text-center text-gray-400 text-sm">Loading activity…</p>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No activity matches these filters.</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-[9px] before:top-1 before:bottom-1 before:w-0.5 before:bg-gray-100">
            {rows.map((r) => {
              const day = new Date(r.createdAt).toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
              const showDay = day !== lastDay;
              lastDay = day;
              const meta = moduleMeta.get(r.module);
              const isSystem = r.adminId == null;
              return (
                <div key={r.id}>
                  {showDay && (
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 -ml-6 mb-1 mt-2 first:mt-0 bg-white relative z-10 w-fit pr-2">
                      {day}
                    </p>
                  )}
                  <div className="relative">
                    <span
                      className="absolute -left-6 top-1.5 w-[18px] h-[18px] rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: meta?.color ?? "#64748b" }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#26342b]">{activityActionLabel(r.action)}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: meta?.color ?? "#64748b" }}>
                        {meta?.label ?? r.module}
                      </span>
                      {isSystem && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">System</span>
                      )}
                    </div>
                    {r.details && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.details}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">
                      #{r.id} · {r.adminName} · {fmtTime(r.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
