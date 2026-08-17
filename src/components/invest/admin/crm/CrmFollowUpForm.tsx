import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { FOLLOWUP_PRIORITIES, FOLLOWUP_PRIORITY_OPTIONS, FOLLOWUP_SUGGESTIONS } from "@contracts/crm";

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

/** Schedule a follow-up task for a lead. */
export default function CrmFollowUpForm({
  leadId,
  onClose,
  onSaved,
}: {
  leadId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const adminsQuery = trpc.crm.assignableAdmins.useQuery(undefined, { retry: false });
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    dueTime: "10:00",
    priority: "medium" as keyof typeof FOLLOWUP_PRIORITIES,
    assignedAdminId: undefined as number | undefined,
  });

  const createMutation = trpc.crm.createFollowUp.useMutation({
    onSuccess: () => {
      toast.success("Follow-up scheduled");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.dueDate) return toast.error("Due date is required");
    createMutation.mutate({
      leadId,
      title: form.title.trim(),
      description: form.description || undefined,
      dueDate: form.dueDate,
      dueTime: form.dueTime,
      priority: form.priority,
      assignedAdminId: form.assignedAdminId ?? null,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
          <X className="w-4 h-4 text-gray-600" />
        </button>
        <h3 className="font-serif text-xl font-bold text-[#26342b] mb-4">Schedule Follow-up</h3>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Title *</label>
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Call customer"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {FOLLOWUP_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, title: s })}
                  className="text-[11px] px-2 py-1 rounded-full bg-[#26342b]/5 text-[#26342b] hover:bg-[#26342b]/10 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Due Date *</label>
              <input
                type="date"
                className={inputCls}
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Due Time *</label>
              <input
                type="time"
                className={inputCls}
                value={form.dueTime}
                onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Priority</label>
              <select
                className={inputCls}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as keyof typeof FOLLOWUP_PRIORITIES })}
              >
                {FOLLOWUP_PRIORITY_OPTIONS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Assign To</label>
              <select
                className={inputCls}
                value={form.assignedAdminId ?? ""}
                onChange={(e) => setForm({ ...form, assignedAdminId: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Me</option>
                {(adminsQuery.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.displayName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <Button onClick={submit} disabled={createMutation.isPending} className="w-full mt-4 bg-[#26342b] hover:bg-[#3d5045]">
          {createMutation.isPending ? "Scheduling…" : "Schedule Follow-up"}
        </Button>
      </div>
    </div>
  );
}
