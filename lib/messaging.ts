import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import { conversations, investorNotifications, messages } from "@db/schema";
import { MESSAGE_UPLOAD, type MessageCategoryKey } from "@contracts/messaging";

type DbLike = ReturnType<typeof getDb>;

export function convRefFor(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MSG-${rand}`;
}

/** Validate a messaging attachment (throws TRPCError on failure). */
export function validateAttachment(att: { name: string; dataUrl: string; size: number }) {
  const lower = att.name.toLowerCase();
  const hasExt = MESSAGE_UPLOAD.extensions.some((ext) => lower.endsWith(ext));
  if (!hasExt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Unsupported file type. Allowed: ${MESSAGE_UPLOAD.extensions.join(", ")}` });
  }
  if (att.size > MESSAGE_UPLOAD.maxBytes) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "File exceeds the 3 MB size limit." });
  }
  if (att.dataUrl.length > MESSAGE_UPLOAD.maxBytesBase64 || !MESSAGE_UPLOAD.dataUrlPattern.test(att.dataUrl)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or oversized file data." });
  }
}

export interface SystemMessageInput {
  subject: string;
  category: MessageCategoryKey;
  body: string;
  propertyName?: string | null;
  /** When false, no separate notification entry is created (caller handles it). */
  notify?: boolean;
}

/**
 * Create a system-generated conversation in a user's inbox. Used for major
 * account events (deposit approved, ROI paid, mortgage decision, …).
 * Never throws — messaging must never break a financial flow.
 */
export async function sendSystemMessage(
  investorId: number,
  input: SystemMessageInput,
  db?: DbLike,
): Promise<void> {
  try {
    const d = db ?? getDb();
    const now = new Date();
    const [row] = await d
      .insert(conversations)
      .values({
        convRef: convRefFor(),
        investorId,
        subject: input.subject.slice(0, 255),
        category: input.category,
        status: "open",
        priority: "normal",
        lastMessageBy: "system",
        lastMessageAt: now,
        propertyName: input.propertyName ?? null,
        systemGenerated: "yes",
      })
      .$returningId();
    await d.insert(messages).values({
      conversationId: row.id,
      senderType: "system",
      senderName: "Nestaro Homes",
      body: input.body,
    });
    if (input.notify !== false) {
      await d.insert(investorNotifications).values({
        investorId,
        title: input.subject.slice(0, 255),
        message: input.body.slice(0, 500),
        type: "info",
      });
    }
  } catch (err) {
    console.error("system message failed:", err);
  }
}

/** Unread counters for a conversation, per side. */
export function unreadFor(conv: { lastMessageAt: Date | null; userLastReadAt: Date | null; adminLastReadAt: Date | null }, side: "user" | "admin"): boolean {
  const last = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
  const read = side === "user" ? conv.userLastReadAt : conv.adminLastReadAt;
  const readAt = read ? new Date(read).getTime() : 0;
  return last > readAt;
}
