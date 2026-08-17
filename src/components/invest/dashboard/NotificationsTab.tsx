import { useMemo, useState } from "react";
import {
  Archive, ArchiveRestore, Bell, CheckCheck, ChevronLeft, ChevronRight, Info,
  CheckCircle, AlertTriangle, XCircle, Search, Settings2, Trash2, Mail, MailX, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/providers/trpc";
import { formatDate } from "@/hooks/use-investor";
import { SectionCard, EmptyState } from "./shared";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_PREFERENCES, notificationCategoryMeta, ctaForNotification } from "@contracts/notifications";
import { toast } from "sonner";
import { useNavigate } from "react-router";

const typeIcons: Record<string, { icon: React.ElementType; classes: string }> = {
  info: { icon: Info, classes: "bg-blue-100 text-blue-600" },
  success: { icon: CheckCircle, classes: "bg-green-100 text-green-600" },
  warning: { icon: AlertTriangle, classes: "bg-amber-100 text-amber-600" },
  error: { icon: XCircle, classes: "bg-red-100 text-red-600" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
  { key: "archived", label: "Archived" },
] as const;

function PreferencesModal({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: prefs } = trpc.notification.getPreferences.useQuery(undefined, { retry: false });
  const update = trpc.notification.updatePreferences.useMutation({
    onSuccess: () => utils.notification.getPreferences.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const set = (key: string, value: boolean) => {
    update.mutate({ [key]: value ? "yes" : "no" } as Record<string, "yes" | "no">);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-[#26342b] font-serif">Notification Preferences</h3>
            <p className="text-xs text-gray-500 mt-0.5">Choose what you want to be notified about</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 space-y-1">
          {NOTIFICATION_PREFERENCES.map((p) => {
            const locked = p.locked;
            const comingSoon = "comingSoon" in p && p.comingSoon;
            const value = locked ? true : (prefs?.[p.key] ?? (p.key === "emailNotifications" || p.key === "inAppNotifications" ? "yes" : "no")) === "yes";
            return (
              <div key={p.key} className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#26342b] flex items-center gap-2">
                    {p.label}
                    {locked && <span className="text-[10px] uppercase tracking-wide bg-red-50 text-red-600 px-1.5 py-0.5 rounded">Always on</span>}
                    {comingSoon && <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Coming soon</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                </div>
                <Switch
                  checked={value}
                  disabled={locked || comingSoon || update.isPending}
                  onCheckedChange={(v) => set(p.key, v)}
                />
              </div>
            );
          })}
        </div>
        <div className="px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Security alerts (sign-ins, password changes, account status) are always delivered by email and cannot be disabled.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsTab({ onChanged }: { onChanged: () => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const navigate = useNavigate();

  const queryInput = useMemo(
    () => ({
      filter,
      category: (category || undefined) as (typeof NOTIFICATION_CATEGORIES)[number]["key"] | undefined,
      search: search || undefined,
      page,
      pageSize: 15,
    }),
    [filter, category, search, page],
  );

  const { data, refetch } = trpc.notification.center.useQuery(queryInput, { retry: false, refetchInterval: 20_000 });

  const refresh = () => {
    refetch();
    onChanged();
  };

  const markRead = trpc.notification.markRead.useMutation({ onSuccess: refresh });
  const markAll = trpc.notification.markAllRead.useMutation({ onSuccess: refresh });
  const archiveMut = trpc.notification.archive.useMutation({ onSuccess: refresh });
  const removeMut = trpc.notification.remove.useMutation({
    onSuccess: () => {
      toast.success("Notification deleted");
      refresh();
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 15));
  const unread = items.filter((n) => n.isRead === "no").length;

  const applyFilter = (f: typeof filter) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <>
      <SectionCard
        title="Notification Center"
        subtitle={total > 0 ? `${total} notification${total === 1 ? "" : "s"}${filter === "all" && unread > 0 ? ` — ${unread} unread on this page` : ""}` : "All caught up"}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPrefsOpen(true)} className="border-[#26342b] text-[#26342b]">
              <Settings2 className="w-4 h-4 mr-2" />
              Preferences
            </Button>
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending} className="border-[#26342b] text-[#26342b]">
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          </div>
        }
      >
        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => applyFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                filter === f.key ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search notifications…"
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 w-52"
            />
          </div>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 text-gray-600"
          >
            <option value="">All Categories</option>
            {NOTIFICATION_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* List */}
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((n) => {
              const config = typeIcons[n.type] ?? typeIcons.info;
              const Icon = config.icon;
              const cat = notificationCategoryMeta(n.category ?? "system");
              const mine = n.investorId != null;
              const cta = n.link ? ctaForNotification(n.notifType, n.category ?? "system") : null;
              const open = () => {
                if (n.isRead === "no" && mine) markRead.mutate({ id: n.id });
                if (n.link) navigate(n.link);
              };
              return (
                <div
                  key={n.id}
                  onClick={open}
                  className={`w-full text-left flex gap-4 p-4 rounded-xl border transition cursor-pointer hover:border-[#c47a45]/50 ${
                    n.isRead === "no" ? "bg-[#f7f4ee] border-[#c47a45]/30" : "bg-white border-gray-100"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.classes}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold ${n.isRead === "no" ? "text-[#26342b]" : "text-gray-600"}`}>{n.title}</p>
                      {n.isRead === "no" && <span className="w-2 h-2 rounded-full bg-[#c47a45] shrink-0" />}
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ color: cat.color, backgroundColor: cat.bg }}
                      >
                        {cat.label}
                      </span>
                      {n.emailStatus === "sent" && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" /> emailed</span>
                      )}
                      {n.emailStatus === "failed" && (
                        <span className="text-[10px] text-red-400 flex items-center gap-1"><MailX className="w-3 h-3" /> email failed</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {n.relatedRef && <p className="text-xs text-gray-400">Ref: {n.relatedRef}</p>}
                      <p className="text-xs text-gray-400">{formatDate(n.createdAt)}</p>
                      {cta && n.link && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#c47a45] hover:text-[#a6632f] transition">
                          {cta.label}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                  {mine && (
                    <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {filter === "archived" ? (
                        <button
                          onClick={() => archiveMut.mutate({ id: n.id, archived: false })}
                          title="Unarchive"
                          className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-[#26342b]"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => archiveMut.mutate({ id: n.id, archived: true })}
                          title="Archive"
                          className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-[#26342b]"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => removeMut.mutate({ id: n.id })}
                        title="Delete"
                        className="p-2 hover:bg-red-50 rounded-lg transition text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={filter === "archived" ? Archive : Bell}
            title={filter === "archived" ? "No archived notifications" : "No notifications"}
            text={search ? "No notifications match your search." : "You're all caught up. New activity on your account will appear here."}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">Page {page} of {totalPages} · {total} total</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {prefsOpen && <PreferencesModal onClose={() => setPrefsOpen(false)} />}
    </>
  );
}
