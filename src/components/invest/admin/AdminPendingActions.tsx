import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  CircleDollarSign,
  Banknote,
  ShieldCheck,
  Package,
  CalendarDays,
  Star,
  ChevronRight,
  Inbox,
} from "lucide-react";

/**
 * Header indicator for REAL pending admin work (deposits, withdrawals,
 * home-plan approvals, early withdrawals, financing applications,
 * verification requests, property orders, appointments, testimonials).
 *
 * The badge is driven entirely by the server-side `pendingActions` query,
 * which reads the source tables directly — the count only drops when the
 * underlying record is actually approved / rejected / paid / confirmed,
 * never when a notification is merely marked as read.
 */

export type PendingActionItem = {
  key: string;
  category: string;
  categoryLabel: string;
  title: string;
  message: string;
  createdAt: string | Date;
  section: string;
  filter?: string;
};

export type PendingActionsData = {
  total: number;
  categories: { key: string; label: string; count: number; section: string; filter?: string }[];
  items: PendingActionItem[];
};

const CATEGORY_ICONS: Record<string, typeof Bell> = {
  deposits: ArrowDownCircle,
  withdrawals: ArrowUpCircle,
  investments: TrendingUp,
  liquidations: CircleDollarSign,
  mortgages: Banknote,
  verification: ShieldCheck,
  orders: Package,
  appointments: CalendarDays,
  testimonials: Star,
};

function timeAgo(value: string | Date) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function AdminPendingActions({
  data,
  onNavigate,
  onOpenNotifications,
}: {
  data: PendingActionsData | undefined;
  onNavigate: (section: string, filter?: string) => void;
  onOpenNotifications: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const total = data?.total ?? 0;

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (section: string, filter?: string) => {
    setOpen(false);
    onNavigate(section, filter);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative p-2 rounded-full transition-colors ${
          total > 0 ? "text-[#26342b] hover:bg-red-50" : "text-[#26342b] hover:bg-gray-100"
        }`}
        title={
          total > 0
            ? `${total} pending action${total === 1 ? "" : "s"} need${total === 1 ? "s" : ""} attention`
            : "Pending actions — all caught up"
        }
        aria-label={`Pending actions${total > 0 ? ` (${total} need attention)` : ""}`}
      >
        <Bell className={`w-5 h-5 ${total > 0 ? "text-red-500" : ""}`} />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="font-bold text-sm text-[#26342b]">Pending Actions</p>
            <span
              className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                total > 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"
              }`}
            >
              {total}
            </span>
          </div>

          {total === 0 ? (
            <div className="px-4 py-8 text-center">
              <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#26342b]">All caught up</p>
              <p className="text-xs text-gray-400 mt-1">No transactions or requests are waiting for review.</p>
            </div>
          ) : (
            <>
              {data && data.categories.length > 1 && (
                <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-gray-100">
                  {data.categories.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => go(c.section, c.filter)}
                      className="text-[11px] font-semibold bg-[#f7f4ee] hover:bg-[#c47a45]/15 text-[#26342b] rounded-full px-2.5 py-1 transition"
                    >
                      {c.label} · {c.count}
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {(data?.items ?? []).map((item) => {
                  const Icon = CATEGORY_ICONS[item.category] ?? Bell;
                  return (
                    <button
                      key={item.key}
                      onClick={() => go(item.section, item.filter)}
                      className="w-full text-left px-4 py-3 hover:bg-[#f7f4ee] transition flex items-start gap-3"
                    >
                      <span className="mt-0.5 w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-bold text-[#26342b]">{item.title}</span>
                        <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2">{item.message}</span>
                        <span className="block text-[10px] text-gray-400 mt-1">{timeAgo(item.createdAt)}</span>
                      </span>
                      <span className="shrink-0 mt-1 inline-flex items-center gap-0.5 text-[11px] font-bold text-[#c47a45]">
                        Review <ChevronRight className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <button
            onClick={() => {
              setOpen(false);
              onOpenNotifications();
            }}
            className="w-full px-4 py-2.5 text-center text-xs font-semibold text-gray-500 hover:text-[#26342b] hover:bg-gray-50 border-t border-gray-100 transition"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
