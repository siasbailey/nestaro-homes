import { useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import CrmLeadProfile from "./CrmLeadProfile";

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

/** Kanban board of leads grouped by pipeline stage. */
export default function CrmPipeline() {
  const leadsQuery = trpc.crm.leads.useQuery(undefined, { retry: false, refetchInterval: 30_000 });
  const [profileId, setProfileId] = useState<number | null>(null);
  const [moveId, setMoveId] = useState<number | null>(null);

  const changeStage = trpc.crm.changeStage.useMutation({
    onSuccess: () => {
      toast.success("Lead moved");
      setMoveId(null);
      leadsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const stages = leadsQuery.data?.stages ?? [];
  const leads = leadsQuery.data?.leads ?? [];

  if (leadsQuery.isLoading) {
    return <div className="py-10 text-center text-gray-400 text-sm">Loading pipeline…</div>;
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {stages.map((stage) => {
          const inStage = leads.filter((l) => l.stage === stage.stageKey);
          return (
            <div key={stage.stageKey} className="w-64 shrink-0 bg-gray-50 rounded-xl border border-gray-200 flex flex-col max-h-[70vh]">
              <div className="px-3 py-2.5 border-b border-gray-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <p className="text-xs font-bold text-[#26342b] truncate">{stage.label}</p>
                <span className="ml-auto text-[11px] font-semibold text-gray-400 bg-white rounded-full px-2 py-0.5 border border-gray-200">
                  {inStage.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {inStage.length === 0 && (
                  <p className="text-[11px] text-gray-300 text-center py-4">No leads</p>
                )}
                {inStage.map((l) => (
                  <div key={l.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow transition">
                    <button className="text-left w-full" onClick={() => setProfileId(l.id)}>
                      <p className="text-sm font-semibold text-[#26342b] leading-tight">{l.fullName}</p>
                      {l.interestedProperty && (
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">{l.interestedProperty}</p>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-gray-400">{fmtDate(l.createdAt)}</span>
                        {l.assignedAdminName && (
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <UserRound className="w-3 h-3 text-[#c47a45]" />
                            {l.assignedAdminName.split(" ")[0]}
                          </span>
                        )}
                      </div>
                    </button>
                    {/* Move control */}
                    <div className="relative mt-2">
                      <button
                        onClick={() => setMoveId(moveId === l.id ? null : l.id)}
                        className="w-full text-[10px] font-semibold text-gray-400 hover:text-[#26342b] flex items-center justify-center gap-1 py-1 rounded border border-dashed border-gray-200 hover:border-[#c47a45] transition"
                      >
                        Move to… <ChevronDown className="w-3 h-3" />
                      </button>
                      {moveId === l.id && (
                        <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {stages
                            .filter((s) => s.stageKey !== l.stage)
                            .map((s) => (
                              <button
                                key={s.stageKey}
                                disabled={changeStage.isPending}
                                onClick={() => changeStage.mutate({ id: l.id, stage: s.stageKey })}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-[#f7f4ee] flex items-center gap-2"
                              >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.label}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {profileId != null && <CrmLeadProfile leadId={profileId} onClose={() => setProfileId(null)} />}
    </div>
  );
}
