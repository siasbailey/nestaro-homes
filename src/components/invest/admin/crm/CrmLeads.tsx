import { useState } from "react";
import { Search, Plus, RotateCcw, UserRound, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import CrmLeadForm from "./CrmLeadForm";
import CrmLeadProfile from "./CrmLeadProfile";
import { leadSourceLabel, LEAD_SOURCE_OPTIONS, BUDGET_RANGES } from "@contracts/crm";

const inputCls =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30 bg-white";

const QUICK_FILTERS = [
  { key: "new", label: "New Leads" },
  { key: "today", label: "Today's Leads" },
  { key: "followups", label: "Follow-ups Due" },
  { key: "high_priority", label: "High Priority" },
  { key: "lost", label: "Lost Leads" },
  { key: "closed", label: "Closed Deals" },
] as const;

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CrmLeads() {
  const [filters, setFilters] = useState({
    search: "",
    stage: "",
    source: "",
    assignedAdminId: "",
    city: "",
    state: "",
    budget: "",
    dateFrom: "",
    dateTo: "",
    quick: "" as "" | (typeof QUICK_FILTERS)[number]["key"],
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);

  const queryInput = {
    search: filters.search || undefined,
    stage: filters.stage || undefined,
    source: filters.source || undefined,
    assignedAdminId: filters.assignedAdminId ? Number(filters.assignedAdminId) : undefined,
    city: filters.city || undefined,
    state: filters.state || undefined,
    budget: filters.budget || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    quick: filters.quick || undefined,
  };

  const leadsQuery = trpc.crm.leads.useQuery(queryInput, { retry: false, refetchInterval: 30_000 });
  const adminsQuery = trpc.crm.assignableAdmins.useQuery(undefined, { retry: false });
  const data = leadsQuery.data;
  const stages = data?.stages ?? [];
  const stageMap = new Map(stages.map((s) => [s.stageKey, s]));

  const reset = () =>
    setFilters({ search: "", stage: "", source: "", assignedAdminId: "", city: "", state: "", budget: "", dateFrom: "", dateTo: "", quick: "" });

  return (
    <div className="space-y-4">
      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((q) => (
          <button
            key={q.key}
            onClick={() => setFilters({ ...filters, quick: filters.quick === q.key ? "" : q.key })}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              filters.quick === q.key
                ? "bg-[#26342b] text-white border-[#26342b]"
                : "bg-white text-[#26342b] border-gray-200 hover:border-[#c47a45]"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
          <div className="col-span-2 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className={`${inputCls} w-full pl-9`}
              placeholder="Name, email, phone, lead ID, property…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <select className={inputCls} value={filters.stage} onChange={(e) => setFilters({ ...filters, stage: e.target.value })}>
            <option value="">All Stages</option>
            {stages.map((s) => (
              <option key={s.stageKey} value={s.stageKey}>{s.label}</option>
            ))}
          </select>
          <select className={inputCls} value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
            <option value="">All Sources</option>
            {LEAD_SOURCE_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select className={inputCls} value={filters.assignedAdminId} onChange={(e) => setFilters({ ...filters, assignedAdminId: e.target.value })}>
            <option value="">All Assignees</option>
            {(adminsQuery.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.displayName}</option>
            ))}
          </select>
          <select className={inputCls} value={filters.budget} onChange={(e) => setFilters({ ...filters, budget: e.target.value })}>
            <option value="">Any Budget</option>
            {BUDGET_RANGES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <input className={inputCls} placeholder="City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
          <input className={inputCls} placeholder="State" value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })} />
          <div>
            <input type="date" className={`${inputCls} w-full`} value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div>
            <input type="date" className={`${inputCls} w-full`} value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
          <Button variant="outline" onClick={reset} className="text-gray-500">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-[#26342b] hover:bg-[#3d5045]">
            <Plus className="w-4 h-4 mr-1.5" /> Add Lead
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#26342b]">
            {data ? `${data.total} lead${data.total === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f7f4ee] text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Interest</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.leads ?? []).map((l) => {
                const st = stageMap.get(l.stage);
                return (
                  <tr key={l.id} className="hover:bg-[#f7f4ee] cursor-pointer" onClick={() => setProfileId(l.id)}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#26342b]">{l.fullName}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{l.leadRef}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-600">{l.email}</p>
                      <p className="text-[11px] text-gray-400">{l.phone ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{leadSourceLabel(l.source)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate" title={l.interestedProperty ?? ""}>
                      {l.interestedProperty ?? l.investmentInterest ?? l.mortgageInterest ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full text-white" style={{ backgroundColor: st?.color ?? "#64748b" }}>
                        {st?.label ?? l.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {l.assignedAdminName ? (
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <UserRound className="w-3.5 h-3.5 text-[#c47a45]" /> {l.assignedAdminName}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </td>
                  </tr>
                );
              })}
              {data && data.leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    No leads match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && <CrmLeadForm onClose={() => setCreateOpen(false)} onSaved={() => leadsQuery.refetch()} />}
      {profileId != null && <CrmLeadProfile leadId={profileId} onClose={() => setProfileId(null)} />}
    </div>
  );
}
