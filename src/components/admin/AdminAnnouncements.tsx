import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  Megaphone, Plus, Pencil, Trash2, Eye, Power, PowerOff, Loader2,
  Settings2, Calendar, User,
} from "lucide-react";
import { SectionCard } from "../invest/dashboard/shared";
import { formatDateTime } from "@/hooks/use-investor";
import { AnnouncementTicker } from "@/components/AnnouncementBar";
import {
  ANNOUNCEMENT_DISPLAY_MODES,
  ANNOUNCEMENT_PAGES,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_SPEEDS,
  ANNOUNCEMENT_DIRECTIONS,
  ANNOUNCEMENT_THEME_COLORS,
  ANNOUNCEMENT_VISIBILITY,
  priorityLabel,
  statusLabel,
} from "@contracts/announcements";

interface AnnouncementRow {
  id: number;
  title: string | null;
  message: string;
  priority: string;
  status: string;
  displayStatus: string;
  startAt: string | Date | null;
  endAt: string | Date | null;
  createdByName: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface BarSettings {
  displayMode: "single" | "rotate" | "scroll_all";
  singleAnnouncementId: number | null;
  speed: "slow" | "normal" | "fast";
  direction: "ltr" | "rtl";
  pauseOnHover: "yes" | "no";
  autoRepeat: "yes" | "no";
  bgColor: string;
  textColor: string;
  visibility: "homepage" | "all" | "selected";
  selectedPages: string[];
}

const statusStyles: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  scheduled: "bg-blue-100 text-blue-700",
  expired: "bg-red-100 text-red-600",
};

const priorityStyles: Record<string, string> = {
  low: "bg-gray-100 text-gray-500",
  normal: "bg-[#26342b]/10 text-[#26342b]",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

function toInputValue(d: string | Date | null): string {
  if (!d) return "";
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ANNOUNCEMENT_THEME_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onChange(c.value)}
          className={`w-8 h-8 rounded-lg border-2 transition ${
            value === c.value ? "border-[#26342b] scale-110" : "border-gray-200 hover:border-gray-300"
          }`}
          style={{ backgroundColor: c.value }}
        />
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-sm text-gray-700"
    >
      <span
        className={`w-9 h-5 rounded-full relative transition-colors ${checked ? "bg-[#26342b]" : "bg-gray-300"}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}

function SettingsPanel({
  settings,
  announcements,
  onSaved,
}: {
  settings: BarSettings;
  announcements: AnnouncementRow[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<BarSettings>(settings);
  useEffect(() => setForm(settings), [settings]);
  const utils = trpc.useUtils();

  const saveMutation = trpc.announcement.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Announcement bar settings saved — the website updates automatically.");
      utils.announcement.getSettings.invalidate();
      utils.announcement.publicBar.invalidate();
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const set = <K extends keyof BarSettings>(key: K, value: BarSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectable = announcements.filter((a) => a.displayStatus !== "expired");

  const previewMessages = useMemo(() => {
    const active = announcements.filter((a) => a.displayStatus === "active");
    if (active.length === 0) return [{ id: -1, title: "Preview", message: "Your announcements will scroll here like this." }];
    return active.slice(0, 4).map((a) => ({ id: a.id, title: a.title, message: a.message }));
  }, [announcements]);

  return (
    <SectionCard title="Bar Settings" subtitle="Control how the announcement bar looks and behaves on the website">
      <div className="space-y-6">
        {/* Live preview */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Live Preview</p>
          <div className="rounded-lg overflow-hidden border border-gray-200">
            <AnnouncementTicker messages={previewMessages} settings={form} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Display mode */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Display Mode</p>
            <div className="space-y-2">
              {ANNOUNCEMENT_DISPLAY_MODES.map((m) => (
                <label key={m.key} className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="displayMode"
                    checked={form.displayMode === m.key}
                    onChange={() => set("displayMode", m.key)}
                    className="mt-0.5 accent-[#26342b]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800">{m.label}</span>
                    <span className="block text-xs text-gray-400">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {form.displayMode === "single" && (
              <select
                value={form.singleAnnouncementId ?? ""}
                onChange={(e) => set("singleAnnouncementId", e.target.value ? Number(e.target.value) : null)}
                className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
              >
                <option value="">Choose announcement…</option>
                {selectable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.title || a.message).slice(0, 60)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Motion */}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Scroll Speed</p>
              <div className="flex gap-2">
                {ANNOUNCEMENT_SPEEDS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => set("speed", s.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                      form.speed === s.key ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Scroll Direction</p>
              <div className="flex gap-2">
                {ANNOUNCEMENT_DIRECTIONS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => set("direction", d.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                      form.direction === d.key ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Toggle label="Pause on hover" checked={form.pauseOnHover === "yes"} onChange={(v) => set("pauseOnHover", v ? "yes" : "no")} />
              <Toggle label="Auto-repeat" checked={form.autoRepeat === "yes"} onChange={(v) => set("autoRepeat", v ? "yes" : "no")} />
            </div>
          </div>

          {/* Colors */}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Background Color</p>
              <ColorSwatches value={form.bgColor} onChange={(v) => set("bgColor", v)} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Text Color</p>
              <ColorSwatches value={form.textColor} onChange={(v) => set("textColor", v)} />
            </div>
          </div>

          {/* Visibility */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Show On</p>
            <div className="space-y-2">
              {ANNOUNCEMENT_VISIBILITY.map((v) => (
                <label key={v.key} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={form.visibility === v.key}
                    onChange={() => set("visibility", v.key)}
                    className="accent-[#26342b]"
                  />
                  <span className="text-sm text-gray-800">{v.label}</span>
                </label>
              ))}
            </div>
            {form.visibility === "selected" && (
              <div className="mt-3 grid sm:grid-cols-2 gap-2">
                {ANNOUNCEMENT_PAGES.map((p) => (
                  <label key={p.path} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.selectedPages.includes(p.path)}
                      onChange={(e) =>
                        set(
                          "selectedPages",
                          e.target.checked
                            ? [...form.selectedPages, p.path]
                            : form.selectedPages.filter((x) => x !== p.path)
                        )
                      }
                      className="accent-[#26342b]"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="px-5 py-2.5 rounded-lg bg-[#26342b] text-white text-sm font-medium hover:bg-[#3d5045] transition disabled:opacity-50 flex items-center gap-2"
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Settings
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

type FormAction = "draft" | "publish" | "schedule";

function AnnouncementForm({
  editing,
  onClose,
  onSaved,
}: {
  editing: AnnouncementRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [message, setMessage] = useState(editing?.message ?? "");
  const [priority, setPriority] = useState(editing?.priority ?? "normal");
  const [action, setAction] = useState<FormAction>(
    editing ? (editing.status === "scheduled" ? "schedule" : editing.status === "active" ? "publish" : "draft") : "publish"
  );
  const [startAt, setStartAt] = useState(toInputValue(editing?.startAt ?? null));
  const [endAt, setEndAt] = useState(toInputValue(editing?.endAt ?? null));

  const payload = () => ({
    title: title.trim() || null,
    message: message.trim(),
    priority,
    action,
    startAt: action === "schedule" && startAt ? new Date(startAt) : null,
    endAt: endAt ? new Date(endAt) : null,
  });

  const invalidate = () => {
    utils.announcement.list.invalidate();
    utils.announcement.publicBar.invalidate();
  };

  const createMutation = trpc.announcement.create.useMutation({
    onSuccess: () => {
      toast.success(action === "publish" ? "Announcement published — live on the website now." : action === "schedule" ? "Announcement scheduled." : "Draft saved.");
      invalidate();
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.announcement.update.useMutation({
    onSuccess: () => {
      toast.success("Announcement updated.");
      invalidate();
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = createMutation.isPending || updateMutation.isPending;
  const submit = () => {
    if (!message.trim()) {
      toast.error("The announcement message is required.");
      return;
    }
    if (action === "schedule" && !startAt) {
      toast.error("Pick a start date and time to schedule.");
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload() });
    } else {
      createMutation.mutate(payload());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <h3 className="font-serif text-xl font-bold text-[#26342b]">
          {editing ? "Edit Announcement" : "New Announcement"}
        </h3>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          Published announcements appear in the scrolling bar at the top of the website.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-gray-400 font-normal">(optional — shown in bold before the message)</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              placeholder="e.g. Price Update"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Write the announcement visitors will see…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30 resize-y"
            />
            <p className="text-xs text-gray-400 text-right">{message.length}/2000</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
              >
                {ANNOUNCEMENT_PRIORITIES.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date <span className="text-gray-400 font-normal">(optional — auto-expires)</span>
              </label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">When should it show?</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "draft", label: "Save as Draft" },
                  { key: "publish", label: "Publish Now" },
                  { key: "schedule", label: "Schedule" },
                ] as { key: FormAction; label: string }[]
              ).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setAction(o.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                    action === o.key ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {action === "schedule" && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="px-5 py-2.5 rounded-lg bg-[#26342b] text-white text-sm font-medium hover:bg-[#3d5045] transition disabled:opacity-50 flex items-center gap-2"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? "Save Changes" : action === "publish" ? "Publish" : action === "schedule" ? "Schedule" : "Save Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAnnouncements() {
  const utils = trpc.useUtils();
  const listQuery = trpc.announcement.list.useQuery();
  const settingsQuery = trpc.announcement.getSettings.useQuery();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [preview, setPreview] = useState<AnnouncementRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AnnouncementRow | null>(null);

  const invalidate = () => {
    utils.announcement.list.invalidate();
    utils.announcement.publicBar.invalidate();
  };

  const setActiveMutation = trpc.announcement.setActive.useMutation({
    onSuccess: (_d, v) => {
      toast.success(v.active ? "Announcement activated — live on the website." : "Announcement deactivated.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.announcement.delete.useMutation({
    onSuccess: () => {
      toast.success("Announcement deleted.");
      invalidate();
      setConfirmDelete(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = (listQuery.data ?? []) as AnnouncementRow[];
  const settings = settingsQuery.data as BarSettings | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#26342b] flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-[#c47a45]" />
            Announcement Bar
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Create, schedule and manage the scrolling notice shown at the top of the website.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              settingsOpen ? "bg-[#c47a45] text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Bar Settings
          </button>
          <button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="px-4 py-2.5 rounded-lg bg-[#26342b] text-white text-sm font-medium hover:bg-[#3d5045] transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Announcement
          </button>
        </div>
      </div>

      {/* Settings */}
      {settingsOpen && settings && (
        <SettingsPanel settings={settings} announcements={rows} onSaved={() => {}} />
      )}

      {/* List */}
      <SectionCard title="Announcements" subtitle="Only active announcements are shown to website visitors">
        {listQuery.isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#26342b]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Megaphone className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="font-medium">No announcements yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first announcement to show it in the website bar.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((a) => (
              <div key={a.id} className="py-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusStyles[a.displayStatus] ?? statusStyles.draft}`}>
                      {statusLabel(a.displayStatus)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${priorityStyles[a.priority] ?? priorityStyles.normal}`}>
                      {priorityLabel(a.priority)}
                    </span>
                    {a.title && <span className="font-semibold text-[#26342b] text-sm">{a.title}</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{a.message}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {a.createdByName ?? "—"}
                    </span>
                    <span>Updated {formatDateTime(new Date(a.updatedAt))}</span>
                    {a.startAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Starts {formatDateTime(new Date(a.startAt))}
                      </span>
                    )}
                    {a.endAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Ends {formatDateTime(new Date(a.endAt))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setPreview(a)}
                    title="Preview"
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#26342b] transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setEditing(a); setFormOpen(true); }}
                    title="Edit"
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#26342b] transition"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {a.displayStatus === "active" ? (
                    <button
                      onClick={() => setActiveMutation.mutate({ id: a.id, active: false })}
                      title="Deactivate"
                      className="p-2 rounded-lg text-gray-500 hover:bg-amber-50 hover:text-amber-600 transition"
                    >
                      <PowerOff className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveMutation.mutate({ id: a.id, active: true })}
                      title="Activate"
                      className="p-2 rounded-lg text-gray-500 hover:bg-green-50 hover:text-green-600 transition"
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete(a)}
                    title="Delete"
                    className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Form modal */}
      {formOpen && (
        <AnnouncementForm
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => setFormOpen(false)}
        />
      )}

      {/* Preview modal */}
      {preview && settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6">
            <h3 className="font-serif text-lg font-bold text-[#26342b] mb-1">Preview</h3>
            <p className="text-xs text-gray-400 mb-4">Exactly as it will appear in the website bar</p>
            <div className="rounded-lg overflow-hidden border border-gray-200">
              <AnnouncementTicker
                messages={[{ id: preview.id, title: preview.title, message: preview.message }]}
                settings={settings}
              />
            </div>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 rounded-lg bg-[#26342b] text-white text-sm font-medium hover:bg-[#3d5045] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-serif text-lg font-bold text-[#26342b]">Delete this announcement?</h3>
            <p className="text-sm text-gray-600 mt-2 line-clamp-3">
              “{confirmDelete.title || confirmDelete.message}”
            </p>
            <p className="text-sm text-gray-400 mt-2">This cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: confirmDelete.id })}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
