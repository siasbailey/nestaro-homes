import { useState } from "react";
import {
  Bell, CheckCheck, Megaphone, Send, ShieldCheck, Activity, Info,
  ShoppingBag, DollarSign, ArrowUpFromLine, TrendingUp, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatDate } from "@/hooks/use-investor";
import { SectionCard, EmptyState } from "../dashboard/shared";

const notifIcons: Record<string, { icon: React.ElementType; classes: string }> = {
  investment: { icon: TrendingUp, classes: "bg-blue-100 text-blue-600" },
  deposit: { icon: DollarSign, classes: "bg-green-100 text-green-600" },
  withdrawal: { icon: ArrowUpFromLine, classes: "bg-amber-100 text-amber-600" },
  roi: { icon: Info, classes: "bg-purple-100 text-purple-600" },
  order: { icon: ShoppingBag, classes: "bg-[#c47a45]/15 text-[#a6632f]" },
  security: { icon: AlertTriangle, classes: "bg-red-100 text-red-600" },
  system: { icon: Info, classes: "bg-gray-100 text-gray-600" },
};

// ── Admin notifications + broadcast ─────────────────────────────
export function AdminNotificationsPanel() {
  const { data: notifications, refetch } = trpc.investAdmin.adminNotifications.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const [form, setForm] = useState({ title: "", message: "", type: "info" as "info" | "success" | "warning" | "error" });

  const markRead = trpc.investAdmin.markAdminNotificationRead.useMutation({ onSuccess: () => refetch() });
  const markAll = trpc.investAdmin.markAllAdminNotificationsRead.useMutation({ onSuccess: () => refetch() });
  const broadcast = trpc.investAdmin.broadcast.useMutation({
    onSuccess: () => {
      toast.success("Notification sent to all investors");
      setForm({ title: "", message: "", type: "info" });
    },
    onError: (err) => toast.error(err.message),
  });

  const unread = (notifications ?? []).filter((n: any) => n.isRead === "no").length;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <SectionCard
        title="Admin Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "All caught up"}
        action={
          unread > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} className="border-[#26342b] text-[#26342b]">
              <CheckCheck className="w-4 h-4 mr-2" /> Mark All Read
            </Button>
          ) : undefined
        }
      >
        {notifications && notifications.length > 0 ? (
          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {notifications.map((n: any) => {
              const config = notifIcons[n.type] ?? notifIcons.system;
              const Icon = config.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => n.isRead === "no" && markRead.mutate({ id: n.id })}
                  className={`w-full text-left flex gap-3.5 p-4 rounded-xl border transition ${
                    n.isRead === "no" ? "bg-[#f7f4ee] border-[#c47a45]/30" : "bg-white border-gray-100"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${config.classes}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${n.isRead === "no" ? "text-[#26342b]" : "text-gray-600"}`}>{n.title}</p>
                      {n.isRead === "no" && <span className="w-2 h-2 rounded-full bg-[#c47a45] shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[11px] text-gray-400 mt-1 capitalize">{n.type} · {formatDate(n.createdAt)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={Bell} title="No notifications" text="Platform events (orders, deposits, investments, security) will appear here." />
        )}
      </SectionCard>

      <SectionCard title="Broadcast to Investors" subtitle="Send a message to every investor">
        <div className="space-y-4">
          <div>
            <Label htmlFor="bc-title">Title</Label>
            <Input id="bc-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. New project launched" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="bc-type">Type</Label>
            <select id="bc-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))} className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-sm">
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Important</option>
            </select>
          </div>
          <div>
            <Label htmlFor="bc-message">Message</Label>
            <textarea id="bc-message" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={5} placeholder="Write your announcement..." className="mt-1.5 w-full rounded-md border border-input px-3 py-2 text-sm" />
          </div>
          <Button
            onClick={() => {
              if (form.title.trim().length < 2 || form.message.trim().length < 2) {
                toast.error("Please provide a title and message");
                return;
              }
              broadcast.mutate({ title: form.title.trim(), message: form.message.trim(), type: form.type });
            }}
            disabled={broadcast.isPending}
            className="bg-[#26342b]"
          >
            <Megaphone className="w-4 h-4 mr-2" />
            {broadcast.isPending ? "Sending..." : "Send Broadcast"}
            <Send className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Audit log + investor activity ───────────────────────────────
export function AdminAudit() {
  const [view, setView] = useState<"audit" | "activity">("audit");
  const { data: audit } = trpc.investAdmin.auditLogs.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const { data: activity } = trpc.investAdmin.activityLogs.useQuery(undefined, { retry: false, refetchInterval: 20_000 });

  return (
    <SectionCard
      title="Security Logs"
      subtitle="Audit trail of admin actions and investor activity"
      action={
        <div className="flex gap-2">
          <button onClick={() => setView("audit")} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${view === "audit" ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            Admin Audit Log
          </button>
          <button onClick={() => setView("activity")} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${view === "activity" ? "bg-[#26342b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            Investor Activity
          </button>
        </div>
      }
    >
      {view === "audit" ? (
        audit && audit.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                  <th className="pb-3 pr-4 font-semibold">Admin</th>
                  <th className="pb-3 pr-4 font-semibold">Action</th>
                  <th className="pb-3 pr-4 font-semibold">Details</th>
                  <th className="pb-3 pr-4 font-semibold">IP</th>
                  <th className="pb-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {audit.map((log: any) => (
                  <tr key={log.id} className="hover:bg-[#f7f4ee] transition">
                    <td className="py-3 pr-4 font-semibold text-[#26342b]">{log.adminName}</td>
                    <td className="py-3 pr-4 capitalize text-gray-700">{log.action.replace(/_/g, " ")}</td>
                    <td className="py-3 pr-4 text-gray-500 max-w-sm truncate">{log.details || "—"}</td>
                    <td className="py-3 pr-4 text-xs text-gray-400">{log.ipAddress || "—"}</td>
                    <td className="py-3 text-gray-500">{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={ShieldCheck} title="No audit entries" text="Admin actions (approvals, adjustments, logins) are recorded here." />
        )
      ) : activity && activity.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[750px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                <th className="pb-3 pr-4 font-semibold">Investor</th>
                <th className="pb-3 pr-4 font-semibold">Action</th>
                <th className="pb-3 pr-4 font-semibold">Details</th>
                <th className="pb-3 pr-4 font-semibold">IP</th>
                <th className="pb-3 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {activity.map((log: any) => (
                <tr key={log.id} className="hover:bg-[#f7f4ee] transition">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-[#26342b]">{log.investorName}</p>
                    <p className="text-xs text-gray-400">{log.investorEmail}</p>
                  </td>
                  <td className="py-3 pr-4 capitalize text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-[#c47a45]" />
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-500 max-w-sm truncate">{log.details || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-gray-400">{log.ipAddress || "—"}</td>
                  <td className="py-3 text-gray-500">{formatDate(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Activity} title="No activity yet" text="Investor logins, deposits, investments, and withdrawals are recorded here." />
      )}
    </SectionCard>
  );
}
