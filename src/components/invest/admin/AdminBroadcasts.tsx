import { useState } from "react";
import {
  Megaphone, Send, Mail, MailCheck, MailX, Bell, Users, AlertTriangle, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { formatDate } from "@/hooks/use-investor";
import { SectionCard, EmptyState, StatCard } from "../dashboard/shared";
import {
  BROADCAST_AUDIENCES,
  BROADCAST_KINDS,
  broadcastAudienceLabel,
  broadcastKindLabel,
  notificationCategoryMeta,
} from "@contracts/notifications";
import { toast } from "sonner";

export default function AdminBroadcasts() {
  const utils = trpc.useUtils();
  const { data: analytics, refetch: refetchAnalytics } = trpc.notification.analytics.useQuery(undefined, { retry: false });
  const { data: history, refetch: refetchHistory } = trpc.notification.broadcasts.useQuery(undefined, { retry: false });

  const [kind, setKind] = useState<string>("announcement");
  const [audience, setAudience] = useState<string>("all");
  const [customEmails, setCustomEmails] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const send = trpc.notification.sendBroadcast.useMutation({
    onSuccess: (r) => {
      toast.success(`Broadcast sent to ${r.recipients} user${r.recipients === 1 ? "" : "s"} (${r.emailsSent} emails delivered)`);
      setTitle("");
      setMessage("");
      setCustomEmails("");
      refetchHistory();
      refetchAnalytics();
      utils.notification.broadcasts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSend = () => {
    if (!title.trim() || title.trim().length < 3) return toast.error("Enter a title (at least 3 characters)");
    if (!message.trim() || message.trim().length < 10) return toast.error("Enter a message (at least 10 characters)");
    if (!window.confirm(`Send "${broadcastKindLabel(kind)}" to ${broadcastAudienceLabel(audience)}? This cannot be undone.`)) return;
    send.mutate({
      title: title.trim(),
      message: message.trim(),
      kind: kind as (typeof BROADCAST_KINDS)[number]["key"],
      audience: audience as (typeof BROADCAST_AUDIENCES)[number]["key"],
      customEmails: audience === "custom" ? customEmails : undefined,
      sendEmail,
    });
  };

  const inputCls = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40";
  const maxCount = Math.max(1, ...(analytics?.byCategory ?? []).map((c) => c.count));

  return (
    <div className="space-y-6">
      {/* Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Bell} label="Notifications (30d)" value={String(analytics?.notificationsSent30d ?? 0)} />
        <StatCard icon={Inbox} label="Read Rate" value={`${analytics?.readRate ?? 0}%`} />
        <StatCard icon={MailCheck} label="Emails Sent (30d)" value={String(analytics?.emailsSent ?? 0)} />
        <StatCard icon={Mail} label="Delivery Rate" value={`${analytics?.deliveryRate ?? 100}%`} />
        <StatCard icon={MailX} label="Failed (30d)" value={String(analytics?.emailsFailed ?? 0)} />
        <StatCard icon={Megaphone} label="Broadcasts" value={String(analytics?.broadcastCount ?? 0)} />
      </div>

      {/* Category breakdown */}
      {analytics && analytics.byCategory.length > 0 && (
        <SectionCard title="Notifications by Category" subtitle="Last 30 days">
          <div className="space-y-2.5">
            {analytics.byCategory
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((row) => {
                const meta = notificationCategoryMeta(row.category);
                return (
                  <div key={row.category} className="flex items-center gap-3">
                    <span className="text-xs font-semibold w-36 truncate" style={{ color: meta.color }}>{meta.label}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(row.count / maxCount) * 100}%`, backgroundColor: meta.color }} />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">{row.count}</span>
                  </div>
                );
              })}
          </div>
        </SectionCard>
      )}

      {/* Compose */}
      <SectionCard title="Send a Broadcast" subtitle="Reach user groups with in-app notifications and branded emails">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputCls} mt-1.5`}>
              {BROADCAST_KINDS.map((k) => (
                <option key={k.key} value={k.key}>{k.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Audience</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className={`${inputCls} mt-1.5`}>
              {BROADCAST_AUDIENCES.map((a) => (
                <option key={a.key} value={a.key}>{a.label}</option>
              ))}
            </select>
          </div>
        </div>

        {audience === "custom" && (
          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recipient Emails</label>
            <textarea
              value={customEmails}
              onChange={(e) => setCustomEmails(e.target.value)}
              rows={2}
              placeholder="user1@example.com, user2@example.com"
              className={`${inputCls} mt-1.5 resize-none`}
            />
            <p className="text-xs text-gray-400 mt-1">Comma or space separated. Only registered investor accounts are matched.</p>
          </div>
        )}

        <div className="mt-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scheduled Maintenance This Sunday" className={`${inputCls} mt-1.5`} />
        </div>
        <div className="mt-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Write your announcement…" className={`${inputCls} mt-1.5 resize-none`} />
        </div>

        {kind === "emergency" && (
          <div className="mt-4 flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl p-3.5">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-600 leading-relaxed">
              Emergency alerts bypass user preferences — every recipient gets the in-app notification and the email, even if they opted out.
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="w-4 h-4 accent-[#26342b]" />
            Also send as email (respects user preferences)
          </label>
          <Button onClick={handleSend} disabled={send.isPending} className="bg-[#26342b] hover:bg-[#3d5045] text-white">
            <Send className="w-4 h-4 mr-2" />
            {send.isPending ? "Sending…" : "Send Broadcast"}
          </Button>
        </div>
      </SectionCard>

      {/* History */}
      <SectionCard title="Broadcast History" subtitle={`${history?.length ?? 0} sent`}>
        {history && history.length > 0 ? (
          <div className="space-y-3">
            {history.map((b) => (
              <div key={b.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#26342b]">{b.title}</p>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${b.kind === "emergency" ? "bg-red-50 text-red-600" : "bg-[#26342b]/5 text-[#26342b]"}`}>
                        {broadcastKindLabel(b.kind)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed line-clamp-2">{b.message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDate(b.createdAt)} · by {b.sentByName} · {broadcastAudienceLabel(b.audience)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-center shrink-0">
                    <div>
                      <p className="text-lg font-bold text-[#26342b]">{b.recipientCount}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1"><Users className="w-3 h-3" /> Users</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-600">{b.emailsSent}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Emailed</p>
                    </div>
                    {b.emailsFailed > 0 && (
                      <div>
                        <p className="text-lg font-bold text-red-500">{b.emailsFailed}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Failed</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Megaphone} title="No broadcasts yet" text="Compose your first broadcast above to reach your users." />
        )}
      </SectionCard>

      {/* Recent email failures */}
      {analytics && analytics.recentFailures.length > 0 && (
        <SectionCard title="Recent Email Failures" subtitle="Most recent delivery errors">
          <div className="space-y-2">
            {analytics.recentFailures.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 text-sm border-b border-gray-50 last:border-0 pb-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-700 truncate">{f.subject}</p>
                  <p className="text-xs text-gray-400 truncate">to {f.toEmail} — {f.error ?? "unknown error"}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{formatDate(f.createdAt)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
