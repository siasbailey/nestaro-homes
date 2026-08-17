import { useState } from "react";
import { AlarmClock, CheckCircle2, CircleSlash, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import CrmLeadProfile from "./CrmLeadProfile";
import { FOLLOWUP_PRIORITIES } from "@contracts/crm";

const FILTERS = [
  { key: "pending", label: "All Pending" },
  { key: "today", label: "Due Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "all", label: "All" },
] as const;

function fmtDt(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function CrmFollowUps() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("pending");
  const [profileId, setProfileId] = useState<number | null>(null);

  const followUpsQuery = trpc.crm.followUps.useQuery({ filter }, { retry: false, refetchInterval: 30_000 });
  const setStatus = trpc.crm.setFollowUpStatus.useMutation({
    onSuccess: () => {
      toast.success("Follow-up updated");
      followUpsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = followUpsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              filter === f.key ? "bg-[#26342b] text-white border-[#26342b]" : "bg-white text-[#26342b] border-gray-200 hover:border-[#c47a45]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {followUpsQuery.isLoading ? (
          <p className="px-4 py-10 text-center text-gray-400 text-sm">Loading follow-ups…</p>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <AlarmClock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No follow-ups here. Open a lead profile to schedule one.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((f) => {
              const overdue = f.status === "pending" && new Date(f.dueAt) < new Date();
              const p = (FOLLOWUP_PRIORITIES as Record<string, { label: string; color: string }>)[f.priority];
              return (
                <div key={f.id} className={`flex items-center gap-3 px-4 py-3 ${overdue ? "bg-red-50/50" : ""}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p?.color ?? "#64748b" }} title={`Priority: ${p?.label ?? f.priority}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${f.status !== "pending" ? "line-through text-gray-400" : "text-[#26342b]"}`}>
                      {f.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {fmtDt(f.dueAt)} · {p?.label ?? f.priority} priority · {f.assignedAdminName ?? "Unassigned"}
                      {overdue && <span className="text-red-500 font-semibold"> · Overdue</span>}
                      {f.status === "completed" && <span className="text-green-600"> · Completed{f.completedByName ? ` by ${f.completedByName}` : ""}</span>}
                      {f.status === "cancelled" && <span className="text-gray-400"> · Cancelled</span>}
                    </p>
                    {f.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{f.description}</p>}
                  </div>
                  {f.lead && (
                    <button
                      onClick={() => setProfileId(f.leadId)}
                      className="text-xs text-[#26342b] font-semibold hover:underline flex items-center gap-1 shrink-0"
                    >
                      {f.lead.fullName} <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                  {f.status === "pending" && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        title="Mark completed"
                        onClick={() => setStatus.mutate({ id: f.id, status: "completed" })}
                        className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center hover:bg-green-200 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        title="Cancel follow-up"
                        onClick={() => setStatus.mutate({ id: f.id, status: "cancelled" })}
                        className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition"
                      >
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

      {profileId != null && <CrmLeadProfile leadId={profileId} onClose={() => setProfileId(null)} />}
    </div>
  );
}
