import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

const KIND_LABELS: Record<string, string> = {
  open: "Open (in progress)",
  won: "Won (closed deal)",
  lost: "Lost",
};

/** Pipeline stage customization — Primary Admin only. */
export default function CrmStages() {
  const stagesQuery = trpc.crm.stages.useQuery(undefined, { retry: false });
  const [form, setForm] = useState<{ id?: number; label: string; color: string; kind: "open" | "won" | "lost" } | null>(null);

  const save = trpc.crm.saveStage.useMutation({
    onSuccess: () => {
      toast.success("Stage saved");
      setForm(null);
      stagesQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.crm.deleteStage.useMutation({
    onSuccess: () => {
      toast.success("Stage deleted");
      stagesQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const reorder = trpc.crm.reorderStages.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const stages = stagesQuery.data ?? [];

  const move = (index: number, dir: -1 | 1) => {
    const ids = stages.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorder.mutate({ ids }, { onSuccess: () => stagesQuery.refetch() });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-[#26342b] font-serif">Pipeline Stages</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Add, rename, recolor, reorder or remove stages. Stages in use by leads cannot be removed.
          </p>
        </div>
        <Button size="sm" onClick={() => setForm({ label: "", color: "#3b82f6", kind: "open" })} className="bg-[#26342b] hover:bg-[#3d5045]">
          <Plus className="w-4 h-4 mr-1" /> Add Stage
        </Button>
      </div>

      <div className="space-y-2">
        {stages.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#26342b] truncate">{s.label}</p>
              <p className="text-[11px] text-gray-400">{KIND_LABELS[s.kind] ?? s.kind}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button title="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 disabled:opacity-30">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button title="Move down" disabled={i === stages.length - 1 || reorder.isPending} onClick={() => move(i, 1)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 disabled:opacity-30">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button title="Edit" onClick={() => setForm({ id: s.id, label: s.label, color: s.color, kind: s.kind })} className="w-7 h-7 rounded-lg bg-[#26342b]/5 text-[#26342b] flex items-center justify-center hover:bg-[#26342b]/10">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                title="Delete"
                onClick={() => {
                  if (window.confirm(`Delete stage "${s.label}"? This cannot be undone.`)) remove.mutate({ id: s.id });
                }}
                className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setForm(null)} />
          <div className="relative bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6">
            <button onClick={() => setForm(null)} className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-gray-600" />
            </button>
            <h3 className="font-serif text-lg font-bold text-[#26342b] mb-4">{form.id ? "Edit Stage" : "New Stage"}</h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Stage Name</label>
                <input className={inputCls} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Contract Review" />
              </div>
              <div>
                <label className={labelCls}>Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="w-10 h-9 rounded border border-gray-200 cursor-pointer" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                  <input className={inputCls} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Stage Type</label>
                <select className={inputCls} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "open" | "won" | "lost" })}>
                  {Object.entries(KIND_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Won/Lost stages are terminal — automatic lead updates stop there.</p>
              </div>
            </div>
            <Button
              className="w-full mt-4 bg-[#26342b] hover:bg-[#3d5045]"
              disabled={save.isPending || !form.label.trim()}
              onClick={() => save.mutate({ id: form.id, label: form.label.trim(), color: form.color, kind: form.kind })}
            >
              {save.isPending ? "Saving…" : "Save Stage"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
