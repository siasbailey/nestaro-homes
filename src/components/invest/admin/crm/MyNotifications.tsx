import { Bell, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";

function fmtDt(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Notifications for the signed-in admin (targeted + broadcast). */
export default function MyNotifications() {
  const listQuery = trpc.crm.myNotifications.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const markRead = trpc.crm.markMyNotificationRead.useMutation({
    onSuccess: () => listQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const markAll = trpc.crm.markAllMyNotificationsRead.useMutation({
    onSuccess: () => {
      toast.success("All notifications marked as read");
      listQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = listQuery.data ?? [];
  const unread = rows.filter((r) => r.isRead === "no").length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#c47a45]" />
          <p className="font-bold text-[#26342b] font-serif">My Notifications</p>
          {unread > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Mark all read
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-gray-400 text-sm">No notifications yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((n) => (
            <div key={n.id} className={`px-5 py-3.5 flex items-start gap-3 ${n.isRead === "no" ? "bg-[#f7f4ee]" : ""}`}>
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.isRead === "no" ? "bg-[#c47a45]" : "bg-gray-200"}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${n.isRead === "no" ? "font-semibold text-[#26342b]" : "text-gray-600"}`}>{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                <p className="text-[11px] text-gray-400 mt-1">{fmtDt(n.createdAt)}</p>
              </div>
              {n.isRead === "no" && (
                <button
                  title="Mark read"
                  onClick={() => markRead.mutate({ id: n.id })}
                  className="w-8 h-8 rounded-lg bg-[#26342b]/5 text-[#26342b] flex items-center justify-center hover:bg-[#26342b]/10 shrink-0"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
