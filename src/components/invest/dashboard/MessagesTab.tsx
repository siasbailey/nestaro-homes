import { useEffect, useRef, useState } from "react";
import {
  MessageSquare, Plus, X, Send, Paperclip, Trash2, Download, ChevronLeft,
  ShieldCheck, Clock, FileText, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { SectionCard, EmptyState } from "./shared";
import {
  MESSAGE_CATEGORY_OPTIONS, messageCategoryLabel, MESSAGE_PRIORITIES,
  CONVERSATION_STATUSES, MESSAGE_UPLOAD, formatAttachmentSize,
} from "@contracts/messaging";

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26342b]/30";

type Conv = {
  id: number;
  convRef: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  lastMessageBy: string;
  lastMessageAt: Date | string | null;
  systemGenerated: string;
  unread: boolean;
  createdAt: Date | string;
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

function fmtTime(d: Date | string): string {
  const dt = new Date(d);
  const today = new Date();
  if (dt.toDateString() === today.toDateString()) return dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return dt.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

function fmtFull(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatusChip({ status }: { status: string }) {
  const meta = (CONVERSATION_STATUSES as Record<string, { label: string; color: string }>)[status];
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: meta?.color ?? "#64748b" }}>
      {meta?.label ?? status}
    </span>
  );
}

/** Tiny rich-text renderer: preserves line breaks, **bold**, *italic*. */
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

export default function MessagesTab() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ subject: "", category: "general_inquiry", message: "" });
  const [composeFile, setComposeFile] = useState<{ name: string; dataUrl: string; size: number } | null>(null);
  const [reply, setReply] = useState("");
  const [replyFile, setReplyFile] = useState<{ name: string; dataUrl: string; size: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const listQuery = trpc.message.myConversations.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const convs = (listQuery.data ?? []) as unknown as Conv[];
  const active = convs.find((c) => c.id === activeId) ?? null;

  const threadQuery = trpc.message.myConversation.useQuery(
    { id: activeId! },
    { retry: false, enabled: activeId != null, refetchInterval: 15_000 },
  );
  const msgs = (threadQuery.data?.messages ?? []) as unknown as Msg[];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, activeId]);

  const readFile = (file: File, cb: (f: { name: string; dataUrl: string; size: number }) => void) => {
    if (file.size > MESSAGE_UPLOAD.maxBytes) return toast.error("File exceeds the 3 MB limit");
    const reader = new FileReader();
    reader.onload = () => cb({ name: file.name, dataUrl: String(reader.result), size: file.size });
    reader.readAsDataURL(file);
  };

  const startMutation = trpc.message.startConversation.useMutation({
    onSuccess: (r) => {
      toast.success(`Conversation started (${r.convRef})`);
      setComposeOpen(false);
      setCompose({ subject: "", category: "general_inquiry", message: "" });
      setComposeFile(null);
      listQuery.refetch().then(() => setActiveId(r.id));
    },
    onError: (e) => toast.error(e.message),
  });

  const replyMutation = trpc.message.reply.useMutation({
    onSuccess: () => {
      setReply("");
      setReplyFile(null);
      threadQuery.refetch();
      listQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.message.deleteMyMessage.useMutation({
    onSuccess: () => threadQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });

  const downloadAttachment = (m: Msg) => {
    if (!m.attachmentUrl || !m.attachmentName) return;
    const a = document.createElement("a");
    a.href = m.attachmentUrl;
    a.download = m.attachmentName;
    a.click();
  };

  const sendReply = () => {
    if (!activeId) return;
    if (!reply.trim() && !replyFile) return toast.error("Type a message or attach a file");
    replyMutation.mutate({ id: activeId, message: reply.trim() || "(attachment)", attachment: replyFile ?? undefined });
  };

  // ── Thread view ──
  if (activeId != null) {
    return (
      <SectionCard
        title={active?.subject ?? "Conversation"}
        subtitle={active ? `${active.convRef} · ${messageCategoryLabel(active.category)}` : undefined}
        action={
          <div className="flex items-center gap-2">
            {active && <StatusChip status={active.status} />}
            <button
              onClick={() => setActiveId(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#26342b] border border-gray-200 rounded-full px-3 py-1.5 hover:border-[#c47a45] transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> All Messages
            </button>
          </div>
        }
      >
        {/* Messages */}
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 py-2">
          {msgs.map((m) => {
            const mine = m.senderType === "user";
            const system = m.senderType === "system";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    system
                      ? "bg-[#f7f4ee] border border-[#c47a45]/30 text-gray-700"
                      : mine
                        ? "bg-[#26342b] text-white"
                        : "bg-white border border-gray-200 text-gray-700"
                  }`}
                >
                  <div className={`flex items-center gap-2 mb-1 ${mine ? "justify-end" : ""}`}>
                    {system && <ShieldCheck className="w-3.5 h-3.5 text-[#c47a45]" />}
                    <span className={`text-[11px] font-semibold ${mine ? "text-white/80" : "text-[#26342b]"}`}>
                      {system ? "Nestaro Homes" : m.senderName}
                    </span>
                    <span className={`text-[10px] ${mine ? "text-white/50" : "text-gray-400"}`}>{fmtFull(m.createdAt)}</span>
                  </div>
                  {m.deleted === "yes" ? (
                    <p className={`italic text-xs ${mine ? "text-white/60" : "text-gray-400"}`}>This message was deleted</p>
                  ) : (
                    <RichBody text={m.body} />
                  )}
                  {m.attachmentName && m.attachmentUrl && m.deleted !== "yes" && (
                    <button
                      onClick={() => downloadAttachment(m)}
                      className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                        mine ? "bg-white/10 hover:bg-white/20 text-white" : "bg-[#26342b]/5 hover:bg-[#26342b]/10 text-[#26342b]"
                      }`}
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="truncate max-w-[180px]">{m.attachmentName}</span>
                      {m.attachmentSize != null && <span className="opacity-60">{formatAttachmentSize(m.attachmentSize)}</span>}
                      <Download className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  )}
                  {mine && m.deleted !== "yes" && (
                    <div className="flex items-center justify-end gap-2 mt-1.5">
                      <span className="text-[10px] text-white/50 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Sent
                      </span>
                      <button
                        title="Delete message"
                        onClick={() => deleteMutation.mutate({ id: m.id })}
                        className="text-white/40 hover:text-white/80 transition"
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
        {active?.status === "open" ? (
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="Type your reply… (Enter to send, Shift+Enter for a new line)"
                className={`${inputCls} flex-1 resize-none`}
              />
              <Button onClick={sendReply} disabled={replyMutation.isPending} className="bg-[#26342b] hover:bg-[#3d5045] rounded-full w-10 h-10 p-0 shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 border-t border-gray-100 pt-4 text-center text-sm text-gray-400">
            This conversation is {active?.status}. Start a new conversation if you need further assistance.
          </div>
        )}
      </SectionCard>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-6">
      <SectionCard
        title="Messages"
        subtitle="Secure communication with the Nestaro Homes team — like internet banking messaging"
        action={
          <Button onClick={() => setComposeOpen(true)} className="bg-[#26342b] hover:bg-[#3d5045]">
            <Plus className="w-4 h-4 mr-1.5" /> New Message
          </Button>
        }
      >
        {listQuery.isLoading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Loading messages…</div>
        ) : convs.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No conversations yet"
            text="Message our team about homes, plans, financing, payments or anything else."
            action={
              <Button onClick={() => setComposeOpen(true)} className="bg-[#26342b] hover:bg-[#3d5045]">
                <Plus className="w-4 h-4 mr-1.5" /> Start a Conversation
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {convs.map((c) => {
              const prio = (MESSAGE_PRIORITIES as Record<string, { label: string; color: string }>)[c.priority];
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className="w-full text-left px-3 py-4 hover:bg-[#f7f4ee] rounded-lg transition flex items-center gap-3"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${c.systemGenerated === "yes" ? "bg-[#c47a45]/10" : "bg-[#26342b]/5"}`}>
                    <MessageSquare className={`w-4 h-4 ${c.systemGenerated === "yes" ? "text-[#c47a45]" : "text-[#26342b]"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${c.unread ? "font-bold text-[#26342b]" : "font-medium text-gray-700"}`}>{c.subject}</p>
                      {c.unread && <span className="w-2 h-2 rounded-full bg-[#c47a45] shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c.convRef} · {messageCategoryLabel(c.category)} · {fmtTime(c.lastMessageAt ?? c.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(c.priority === "high" || c.priority === "urgent") && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: prio?.color }}>
                        {prio?.label}
                      </span>
                    )}
                    <StatusChip status={c.status} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* New conversation modal */}
      {composeOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setComposeOpen(false)} />
          <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6">
            <button onClick={() => setComposeOpen(false)} className="absolute top-4 right-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-gray-600" />
            </button>
            <h3 className="font-serif text-xl font-bold text-[#26342b] mb-4">New Message</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Category</label>
                <select className={inputCls} value={compose.category} onChange={(e) => setCompose({ ...compose, category: e.target.value })}>
                  {MESSAGE_CATEGORY_OPTIONS.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Subject *</label>
                <input
                  className={inputCls}
                  value={compose.subject}
                  onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                  placeholder="What is this about?"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Message *</label>
                <textarea
                  rows={5}
                  className={`${inputCls} resize-none`}
                  value={compose.message}
                  onChange={(e) => setCompose({ ...compose, message: e.target.value })}
                  placeholder="Write your message… (**bold**, *italic* supported)"
                />
              </div>
              <div>
                {composeFile ? (
                  <div className="flex items-center gap-2 text-xs bg-[#26342b]/5 text-[#26342b] rounded-lg px-3 py-2 w-fit">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[220px]">{composeFile.name}</span>
                    <span className="opacity-60">{formatAttachmentSize(composeFile.size)}</span>
                    <button onClick={() => setComposeFile(null)}><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#26342b] border border-dashed border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:border-[#c47a45] transition">
                    <Paperclip className="w-3.5 h-3.5" /> Attach file (PDF, JPG, PNG, DOCX, XLSX — max 3 MB)
                    <input
                      type="file"
                      accept={MESSAGE_UPLOAD.accept}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) readFile(f, setComposeFile);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            <Button
              className="w-full mt-4 bg-[#26342b] hover:bg-[#3d5045]"
              disabled={startMutation.isPending || compose.subject.trim().length < 3 || !compose.message.trim()}
              onClick={() =>
                startMutation.mutate({
                  subject: compose.subject.trim(),
                  category: compose.category as never,
                  message: compose.message.trim(),
                  attachment: composeFile ?? undefined,
                })
              }
            >
              {startMutation.isPending ? "Sending…" : "Send Message"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
