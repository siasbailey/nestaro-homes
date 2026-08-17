import { useEffect, useRef, useState } from "react";
import {
  Search, RotateCcw, Inbox, Send, Paperclip, X, Download, FileText, Trash2,
  ChevronLeft, UserRound, CheckCircle2, Archive, RotateCw, Forward, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import {
  MESSAGE_CATEGORY_OPTIONS, messageCategoryLabel, MESSAGE_PRIORITY_OPTIONS, MESSAGE_PRIORITIES,
  CONVERSATION_STATUSES, MESSAGE_UPLOAD, formatAttachmentSize,
} from "@contracts/messaging";

const inputCls =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30 bg-white";

type Conv = {
  id: number;
  convRef: string;
  investorId: number;
  subject: string;
  category: string;
  status: string;
  priority: string;
  lastMessageBy: string;
  lastMessageAt: Date | string | null;
  assignedAdminId: number | null;
  assignedAdminName: string | null;
  systemGenerated: string;
  unread: boolean;
  createdAt: Date | string;
  investor: { id: number; name: string; email: string } | null;
};

type Msg = {
  id: number;
  senderType: string;
  senderName: string;
  body: string;
  attachmentName: string | null;
  attachmentUrl: string | null;
  attachmentSize: number | null;
  deleted: string;
  createdAt: Date | string;
};

const QUICK = [
  { key: "unread", label: "Unread" },
  { key: "high_priority", label: "High Priority" },
  { key: "awaiting_reply", label: "Awaiting Reply" },
  { key: "closed", label: "Closed" },
  { key: "assigned_to_me", label: "Assigned to Me" },
] as const;

function fmtFull(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function RichBody({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
}

export default function AdminMessages() {
  const [filters, setFilters] = useState({ search: "", category: "", status: "", priority: "", assignedAdminId: "", dateFrom: "", dateTo: "", quick: "" as "" | (typeof QUICK)[number]["key"] });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [replyFile, setReplyFile] = useState<{ name: string; dataUrl: string; size: number } | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Msg | null>(null);
  const [forwardTarget, setForwardTarget] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const queryInput = {
    search: filters.search || undefined,
    category: filters.category || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    assignedAdminId: filters.assignedAdminId ? Number(filters.assignedAdminId) : undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    quick: filters.quick || undefined,
  };
  const listQuery = trpc.message.conversations.useQuery(queryInput, { retry: false, refetchInterval: 20_000 });
  const adminsQuery = trpc.crm.assignableAdmins.useQuery(undefined, { retry: false });
  const meQuery = trpc.admin.adminMe.useQuery(undefined, { retry: false });
  const isPrimary = meQuery.data?.role === "primary";

  const convs = (listQuery.data ?? []) as unknown as Conv[];
  const active = convs.find((c) => c.id === activeId) ?? null;

  const threadQuery = trpc.message.conversation.useQuery(
    { id: activeId! },
    { retry: false, enabled: activeId != null, refetchInterval: 15_000 },
  );
  const thread = threadQuery.data;
  const msgs = (thread?.messages ?? []) as unknown as Msg[];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, activeId]);

  const refresh = () => {
    listQuery.refetch();
    if (activeId != null) threadQuery.refetch();
  };
  const onErr = (e: { message: string }) => toast.error(e.message);

  const replyMutation = trpc.message.adminReply.useMutation({
    onSuccess: () => { setReply(""); setReplyFile(null); refresh(); },
    onError: onErr,
  });
  const assignMutation = trpc.message.assignConversation.useMutation({
    onSuccess: () => { toast.success("Assignment updated"); refresh(); },
    onError: onErr,
  });
  const statusMutation = trpc.message.setConversationStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refresh(); },
    onError: onErr,
  });
  const priorityMutation = trpc.message.setConversationPriority.useMutation({
    onSuccess: () => { toast.success("Priority updated"); refresh(); },
    onError: onErr,
  });
  const deleteMsgMutation = trpc.message.deleteMessage.useMutation({
    onSuccess: () => threadQuery.refetch(),
    onError: onErr,
  });
  const forwardMutation = trpc.message.forwardMessage.useMutation({
    onSuccess: () => { toast.success("Message forwarded"); setForwardMsg(null); setForwardTarget(""); },
    onError: onErr,
  });
  const exportMutation = trpc.message.exportConversation.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Conversation exported");
    },
    onError: onErr,
  });

  const readFile = (file: File, cb: (f: { name: string; dataUrl: string; size: number }) => void) => {
    if (file.size > MESSAGE_UPLOAD.maxBytes) return toast.error("File exceeds the 3 MB limit");
    const reader = new FileReader();
    reader.onload = () => cb({ name: file.name, dataUrl: String(reader.result), size: file.size });
    reader.readAsDataURL(file);
  };

  // ── Thread view ──
  if (activeId != null && active) {
    const prio = (MESSAGE_PRIORITIES as Record<string, { label: string; color: string }>)[active.priority];
    const st = (CONVERSATION_STATUSES as Record<string, { label: string; color: string }>)[active.status];
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setActiveId(null)} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[#26342b]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[#26342b] truncate">{active.subject}</h3>
              <p className="text-xs text-gray-400">
                {active.convRef} · {messageCategoryLabel(active.category)} · {thread?.investor?.name ?? "Customer"} ({thread?.investor?.email})
              </p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full text-white" style={{ backgroundColor: prio?.color }}>{prio?.label}</span>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full text-white" style={{ backgroundColor: st?.color }}>{st?.label}</span>
          </div>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <select
              className={`${inputCls} text-xs`}
              value={active.priority}
              onChange={(e) => priorityMutation.mutate({ id: active.id, priority: e.target.value as never })}
            >
              {MESSAGE_PRIORITY_OPTIONS.map((p) => (
                <option key={p.key} value={p.key}>Priority: {p.label}</option>
              ))}
            </select>
            {isPrimary && (
              <select
                className={`${inputCls} text-xs`}
                value={active.assignedAdminId ?? ""}
                onChange={(e) => assignMutation.mutate({ id: active.id, adminId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Unassigned</option>
                {(adminsQuery.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.displayName}</option>
                ))}
              </select>
            )}
            {!isPrimary && active.assignedAdminName && (
              <span className="text-xs text-gray-500 flex items-center gap-1"><UserRound className="w-3.5 h-3.5" /> {active.assignedAdminName}</span>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {active.status === "open" ? (
                <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: active.id, status: "closed" })} className="text-gray-600">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Close
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: active.id, status: "open" })} className="text-green-600 border-green-200">
                  <RotateCw className="w-3.5 h-3.5 mr-1" /> Reopen
                </Button>
              )}
              {active.status !== "archived" ? (
                <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: active.id, status: "archived" })} className="text-gray-500">
                  <Archive className="w-3.5 h-3.5 mr-1" /> Archive
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => exportMutation.mutate({ id: active.id })} disabled={exportMutation.isPending}>
                <Download className="w-3.5 h-3.5 mr-1" /> Export
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1 py-2">
            {msgs.map((m) => {
              const fromUser = m.senderType === "user";
              const system = m.senderType === "system";
              return (
                <div key={m.id} className={`flex ${fromUser ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      system
                        ? "bg-[#f7f4ee] border border-[#c47a45]/30 text-gray-700"
                        : fromUser
                          ? "bg-white border border-gray-200 text-gray-700"
                          : "bg-[#26342b] text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-semibold ${fromUser ? "text-[#26342b]" : system ? "text-[#c47a45]" : "text-white/80"}`}>
                        {system ? "Nestaro Homes (System)" : m.senderName}{!fromUser && !system ? " (Admin)" : ""}
                      </span>
                      <span className={`text-[10px] ${fromUser || system ? "text-gray-400" : "text-white/50"}`}>{fmtFull(m.createdAt)}</span>
                    </div>
                    {m.deleted === "yes" ? (
                      <p className={`italic text-xs ${fromUser || system ? "text-gray-400" : "text-white/60"}`}>This message was deleted</p>
                    ) : (
                      <RichBody text={m.body} />
                    )}
                    {m.attachmentName && m.attachmentUrl && m.deleted !== "yes" && (
                      <button
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = m.attachmentUrl!;
                          a.download = m.attachmentName!;
                          a.click();
                        }}
                        className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                          fromUser || system ? "bg-[#26342b]/5 hover:bg-[#26342b]/10 text-[#26342b]" : "bg-white/10 hover:bg-white/20 text-white"
                        }`}
                      >
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="truncate max-w-[180px]">{m.attachmentName}</span>
                        {m.attachmentSize != null && <span className="opacity-60">{formatAttachmentSize(m.attachmentSize)}</span>}
                        <Download className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    )}
                    {m.deleted !== "yes" && (
                      <div className={`flex items-center gap-2 mt-1.5 ${fromUser ? "" : "justify-end"}`}>
                        <button
                          title="Forward to another admin"
                          onClick={() => setForwardMsg(m)}
                          className={`${fromUser || system ? "text-gray-400 hover:text-[#26342b]" : "text-white/40 hover:text-white/80"} transition`}
                        >
                          <Forward className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Delete message"
                          onClick={() => {
                            if (window.confirm("Delete this message? (soft delete)")) deleteMsgMutation.mutate({ id: m.id });
                          }}
                          className={`${fromUser || system ? "text-gray-400 hover:text-red-500" : "text-white/40 hover:text-white/80"} transition`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          {active.status === "open" ? (
            <div className="mt-4 border-t border-gray-100 pt-4">
              {replyFile && (
                <div className="mb-2 flex items-center gap-2 text-xs bg-[#26342b]/5 text-[#26342b] rounded-lg px-3 py-2 w-fit">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]">{replyFile.name}</span>
                  <button onClick={() => setReplyFile(null)}><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label className="w-10 h-10 shrink-0 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#26342b] hover:border-[#c47a45] cursor-pointer transition" title="Attach file">
                  <Paperclip className="w-4 h-4" />
                  <input
                    type="file"
                    accept={MESSAGE_UPLOAD.accept}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) readFile(f, setReplyFile);
                      e.target.value = "";
                    }}
                  />
                </label>
                <textarea
                  rows={2}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply…"
                  className={`${inputCls} flex-1 resize-none`}
                />
                <Button
                  onClick={() => {
                    if (!reply.trim() && !replyFile) return toast.error("Type a message or attach a file");
                    replyMutation.mutate({ id: active.id, message: reply.trim() || "(attachment)", attachment: replyFile ?? undefined });
                  }}
                  disabled={replyMutation.isPending}
                  className="bg-[#26342b] hover:bg-[#3d5045] rounded-full w-10 h-10 p-0 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 border-t border-gray-100 pt-4 text-center text-sm text-gray-400">
              This conversation is {active.status}. Reopen it to reply.
            </div>
          )}
        </div>

        {/* Forward modal */}
        {forwardMsg && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setForwardMsg(null)} />
            <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl p-6">
              <button onClick={() => setForwardMsg(null)} className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-gray-600" />
              </button>
              <h3 className="font-serif text-lg font-bold text-[#26342b] mb-2">Forward Message</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 max-h-32 overflow-y-auto mb-3 whitespace-pre-wrap">
                {forwardMsg.body}
              </div>
              <select className={`${inputCls} w-full mb-3`} value={forwardTarget} onChange={(e) => setForwardTarget(e.target.value)}>
                <option value="">Select administrator…</option>
                {(adminsQuery.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.displayName}</option>
                ))}
              </select>
              <Button
                className="w-full bg-[#26342b] hover:bg-[#3d5045]"
                disabled={forwardMutation.isPending || !forwardTarget}
                onClick={() => forwardMutation.mutate({ messageId: forwardMsg.id, adminId: Number(forwardTarget) })}
              >
                {forwardMutation.isPending ? "Forwarding…" : "Forward"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4">
      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q.key}
            onClick={() => setFilters({ ...filters, quick: filters.quick === q.key ? "" : q.key })}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              filters.quick === q.key ? "bg-[#26342b] text-white border-[#26342b]" : "bg-white text-[#26342b] border-gray-200 hover:border-[#c47a45]"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-7 gap-2">
        <div className="col-span-2 relative min-w-0">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className={`${inputCls} w-full pl-9`} placeholder="Name, email, subject, reference…" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <select className={`${inputCls} w-full min-w-0`} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">All Categories</option>
          {MESSAGE_CATEGORY_OPTIONS.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <select className={`${inputCls} w-full min-w-0`} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option>
          {Object.values(CONVERSATION_STATUSES).map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select className={`${inputCls} w-full min-w-0`} value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
          <option value="">All Priorities</option>
          {MESSAGE_PRIORITY_OPTIONS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        {isPrimary ? (
          <select className={`${inputCls} w-full min-w-0`} value={filters.assignedAdminId} onChange={(e) => setFilters({ ...filters, assignedAdminId: e.target.value })}>
            <option value="">All Assignees</option>
            {(adminsQuery.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.displayName}</option>
            ))}
          </select>
        ) : (
          <div />
        )}
        <div className="flex gap-2 col-span-2 md:col-span-1 min-w-0">
          <input type="date" className={`${inputCls} w-full min-w-0 flex-1`} value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          <button onClick={() => setFilters({ search: "", category: "", status: "", priority: "", assignedAdminId: "", dateFrom: "", dateTo: "", quick: "" })} className="w-9 h-9 shrink-0 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#26342b]" title="Reset">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {listQuery.isLoading ? (
          <p className="px-4 py-10 text-center text-gray-400 text-sm">Loading conversations…</p>
        ) : convs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Inbox className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No conversations match these filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {convs.map((c) => {
              const prio = (MESSAGE_PRIORITIES as Record<string, { color: string }>)[c.priority];
              const st = (CONVERSATION_STATUSES as Record<string, { label: string; color: string }>)[c.status];
              return (
                <button key={c.id} onClick={() => setActiveId(c.id)} className="w-full text-left px-4 py-3.5 hover:bg-[#f7f4ee] transition flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: prio?.color ?? "#64748b" }} title={`Priority: ${c.priority}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${c.unread ? "font-bold text-[#26342b]" : "font-medium text-gray-700"}`}>{c.subject}</p>
                      {c.unread && <span className="w-2 h-2 rounded-full bg-[#c47a45] shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {c.investor?.name ?? "Customer"} · {c.convRef} · {messageCategoryLabel(c.category)}
                      {c.lastMessageBy === "user" && c.status === "open" && (
                        <span className="text-amber-600 font-semibold"> · Awaiting reply</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: st?.color }}>{st?.label}</span>
                    <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" /> {fmtFull(c.lastMessageAt ?? c.createdAt)}
                    </p>
                    {c.assignedAdminName && (
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                        <UserRound className="w-3 h-3 text-[#c47a45]" /> {c.assignedAdminName}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
