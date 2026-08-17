import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminPermQuery, createRouter, investorQuery, primaryAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { adminUsers, conversations, investorNotifications, investors, messages, type Conversation } from "@db/schema";
import { MESSAGE_CATEGORIES, messageCategoryLabel } from "@contracts/messaging";
import { convRefFor, unreadFor, validateAttachment } from "./lib/messaging";
import { notifyUser } from "./lib/notify";
import { logAudit, notifyAdmin } from "./lib/activity";

const supportQuery = () => adminPermQuery("support");

const attachmentInput = z
  .object({ name: z.string().max(255), dataUrl: z.string(), size: z.number().int().positive() })
  .optional();

function canAccess(conv: Conversation, ctx: { admin: { id: number; role: string } }): boolean {
  return ctx.admin.role === "primary" || conv.assignedAdminId === ctx.admin.id;
}

async function notifyInvestor(investorId: number, title: string, message: string) {
  try {
    await getDb().insert(investorNotifications).values({ investorId, title, message, type: "info", category: "messages", link: "/invest/dashboard?tab=messages" });
    void notifyUser(investorId, {
      type: "support_update",
      category: "messages",
      title,
      message,
      link: "/invest/dashboard?tab=messages",
      inApp: false,
    });
  } catch (err) {
    console.error("investor message notification failed:", err);
  }
}

export const messageRouter = createRouter({
  // ── User inbox ────────────────────────────────────────────────
  myConversations: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.investorId, ctx.investor.id))
      .orderBy(desc(conversations.lastMessageAt));
    return rows.map((c) => ({ ...c, unread: unreadFor(c, "user") }));
  }),

  myUnreadCount: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.investorId, ctx.investor.id));
    return { count: rows.filter((c) => unreadFor(c, "user")).length };
  }),

  myConversation: investorQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conv = (await db.select().from(conversations).where(eq(conversations.id, input.id)).limit(1))[0];
      if (!conv || conv.investorId !== ctx.investor.id) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(asc(messages.createdAt));
      // Mark the user's side as read
      await db.update(conversations).set({ userLastReadAt: new Date() }).where(eq(conversations.id, conv.id));
      return { conversation: conv, messages: msgs };
    }),

  startConversation: investorQuery
    .input(
      z.object({
        subject: z.string().min(3).max(255),
        category: z.enum(Object.keys(MESSAGE_CATEGORIES) as [string, ...string[]]),
        message: z.string().min(1).max(5000),
        attachment: attachmentInput,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (input.attachment) validateAttachment(input.attachment);

      // Duplicate protection: identical open conversation from the same user
      const existing = await db
        .select()
        .from(conversations)
        .where(eq(conversations.investorId, ctx.investor.id));
      const dupe = existing.find(
        (c) =>
          c.status === "open" &&
          c.subject.toLowerCase() === input.subject.trim().toLowerCase() &&
          c.systemGenerated === "no" &&
          Date.now() - new Date(c.createdAt).getTime() < 24 * 60 * 60_000,
      );
      if (dupe) {
        throw new TRPCError({ code: "CONFLICT", message: "You already have an open conversation with this subject. Please reply in that thread instead." });
      }

      const now = new Date();
      const priority = input.category === "complaint" ? "high" : "normal";
      const [row] = await db
        .insert(conversations)
        .values({
          convRef: convRefFor(),
          investorId: ctx.investor.id,
          subject: input.subject.trim(),
          category: input.category as never,
          status: "open",
          priority,
          lastMessageBy: "user",
          lastMessageAt: now,
          userLastReadAt: now,
        })
        .$returningId();

      await db.insert(messages).values({
        conversationId: row.id,
        senderType: "user",
        senderName: ctx.investor.name,
        body: input.message,
        attachmentName: input.attachment?.name ?? null,
        attachmentUrl: input.attachment?.dataUrl ?? null,
        attachmentSize: input.attachment?.size ?? null,
      });

      await notifyAdmin(
        input.category === "complaint" ? "Complaint Submitted" : "New Conversation",
        `${ctx.investor.name} started "${input.subject.trim()}" (${messageCategoryLabel(input.category)})${input.attachment ? " — includes an attachment" : ""}.`,
        "system",
      );
      await logAudit(null, ctx.investor.name, "conversation_started", `${ctx.investor.name} started conversation "${input.subject.trim()}" (${messageCategoryLabel(input.category)})`, ctx.req.headers);
      const conv = (await db.select().from(conversations).where(eq(conversations.id, row.id)).limit(1))[0];
      return { success: true, id: row.id, convRef: conv.convRef };
    }),

  reply: investorQuery
    .input(z.object({ id: z.number(), message: z.string().min(1).max(5000), attachment: attachmentInput }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const conv = (await db.select().from(conversations).where(eq(conversations.id, input.id)).limit(1))[0];
      if (!conv || conv.investorId !== ctx.investor.id) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      if (conv.status !== "open") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This conversation is closed. Please start a new conversation." });
      }
      if (input.attachment) validateAttachment(input.attachment);

      await db.insert(messages).values({
        conversationId: conv.id,
        senderType: "user",
        senderName: ctx.investor.name,
        body: input.message,
        attachmentName: input.attachment?.name ?? null,
        attachmentUrl: input.attachment?.dataUrl ?? null,
        attachmentSize: input.attachment?.size ?? null,
      });
      await db
        .update(conversations)
        .set({ lastMessageBy: "user", lastMessageAt: new Date(), userLastReadAt: new Date() })
        .where(eq(conversations.id, conv.id));

      if (conv.assignedAdminId) {
        await notifyAdmin("User Reply Received", `${ctx.investor.name} replied in "${conv.subject}" (${conv.convRef}).`, "system", undefined, conv.assignedAdminId);
      } else {
        await notifyAdmin("User Reply Received", `${ctx.investor.name} replied in "${conv.subject}" (${conv.convRef}).`, "system");
      }
      await logAudit(null, ctx.investor.name, "message_sent", `${ctx.investor.name} replied in conversation ${conv.convRef} ("${conv.subject}")`, ctx.req.headers);
      return { success: true };
    }),

  deleteMyMessage: investorQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const msg = (await db.select().from(messages).where(eq(messages.id, input.id)).limit(1))[0];
      if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      const conv = (await db.select().from(conversations).where(eq(conversations.id, msg.conversationId)).limit(1))[0];
      if (!conv || conv.investorId !== ctx.investor.id || msg.senderType !== "user") {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own messages." });
      }
      await db.update(messages).set({ deleted: "yes", body: "", attachmentName: null, attachmentUrl: null, attachmentSize: null }).where(eq(messages.id, msg.id));
      return { success: true };
    }),

  // ── Admin inbox ───────────────────────────────────────────────
  conversations: supportQuery()
    .input(
      z
        .object({
          search: z.string().optional(),
          category: z.string().optional(),
          status: z.string().optional(),
          priority: z.string().optional(),
          assignedAdminId: z.number().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          quick: z.enum(["unread", "high_priority", "closed", "awaiting_reply", "assigned_to_me"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      let rows = await db.select().from(conversations).orderBy(desc(conversations.lastMessageAt));
      const investorRows = await db.select({ id: investors.id, name: investors.name, email: investors.email }).from(investors);
      const invMap = new Map(investorRows.map((i) => [i.id, i]));

      // Secondary admins only see conversations assigned to them
      if (ctx.admin.role !== "primary") {
        rows = rows.filter((c) => c.assignedAdminId === ctx.admin.id);
      }

      const q = input?.search?.trim().toLowerCase();
      if (q) {
        rows = rows.filter((c) => {
          const inv = invMap.get(c.investorId);
          return [c.subject, c.convRef, c.propertyName ?? "", inv?.name ?? "", inv?.email ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q);
        });
      }
      if (input?.category) rows = rows.filter((c) => c.category === input.category);
      if (input?.status) rows = rows.filter((c) => c.status === input.status);
      if (input?.priority) rows = rows.filter((c) => c.priority === input.priority);
      if (input?.assignedAdminId) rows = rows.filter((c) => c.assignedAdminId === input.assignedAdminId);
      if (input?.dateFrom) rows = rows.filter((c) => new Date(c.createdAt) >= new Date(`${input.dateFrom}T00:00:00`));
      if (input?.dateTo) rows = rows.filter((c) => new Date(c.createdAt) <= new Date(`${input.dateTo}T23:59:59`));

      switch (input?.quick) {
        case "unread":
          rows = rows.filter((c) => unreadFor(c, "admin"));
          break;
        case "high_priority":
          rows = rows.filter((c) => c.priority === "high" || c.priority === "urgent");
          break;
        case "closed":
          rows = rows.filter((c) => c.status === "closed");
          break;
        case "awaiting_reply":
          rows = rows.filter((c) => c.status === "open" && c.lastMessageBy === "user");
          break;
        case "assigned_to_me":
          rows = rows.filter((c) => c.assignedAdminId === ctx.admin.id);
          break;
      }

      return rows.slice(0, 300).map((c) => ({
        ...c,
        investor: invMap.get(c.investorId) ?? null,
        unread: unreadFor(c, "admin"),
      }));
    }),

  adminUnreadCount: supportQuery().query(async ({ ctx }) => {
    const db = getDb();
    let rows = await db.select().from(conversations);
    if (ctx.admin.role !== "primary") rows = rows.filter((c) => c.assignedAdminId === ctx.admin.id);
    return { count: rows.filter((c) => unreadFor(c, "admin")).length };
  }),

  conversation: supportQuery()
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conv = (await db.select().from(conversations).where(eq(conversations.id, input.id)).limit(1))[0];
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      if (!canAccess(conv, ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "This conversation is assigned to another administrator." });

      const msgs = await db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(asc(messages.createdAt));
      const inv = (await db.select({ id: investors.id, name: investors.name, email: investors.email, phone: investors.phone }).from(investors).where(eq(investors.id, conv.investorId)).limit(1))[0];
      await db.update(conversations).set({ adminLastReadAt: new Date() }).where(eq(conversations.id, conv.id));
      return { conversation: conv, messages: msgs, investor: inv ?? null };
    }),

  adminReply: supportQuery()
    .input(z.object({ id: z.number(), message: z.string().min(1).max(5000), attachment: attachmentInput }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const conv = (await db.select().from(conversations).where(eq(conversations.id, input.id)).limit(1))[0];
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      if (!canAccess(conv, ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "This conversation is assigned to another administrator." });
      if (conv.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Reopen the conversation before replying." });
      if (input.attachment) validateAttachment(input.attachment);

      await db.insert(messages).values({
        conversationId: conv.id,
        senderType: "admin",
        senderName: ctx.admin.displayName,
        adminId: ctx.admin.id,
        body: input.message,
        attachmentName: input.attachment?.name ?? null,
        attachmentUrl: input.attachment?.dataUrl ?? null,
        attachmentSize: input.attachment?.size ?? null,
      });
      await db
        .update(conversations)
        .set({ lastMessageBy: "admin", lastMessageAt: new Date(), adminLastReadAt: new Date() })
        .where(eq(conversations.id, conv.id));

      await notifyInvestor(conv.investorId, "Reply Received", `${ctx.admin.displayName} replied to your conversation "${conv.subject}"${input.attachment ? " — an attachment was included" : ""}. Open Messages to view it.`);
      await logAudit(ctx.admin.id, ctx.admin.displayName, "message_sent", `Replied to conversation ${conv.convRef} ("${conv.subject}")${input.attachment ? " with attachment" : ""}`, ctx.req.headers);
      return { success: true };
    }),

  assignConversation: primaryAdminQuery
    .input(z.object({ id: z.number(), adminId: z.number().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const conv = (await db.select().from(conversations).where(eq(conversations.id, input.id)).limit(1))[0];
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });

      let name: string | null = null;
      if (input.adminId) {
        const adm = (await db.select().from(adminUsers).where(eq(adminUsers.id, input.adminId)).limit(1))[0];
        if (!adm || adm.status !== "active") throw new TRPCError({ code: "NOT_FOUND", message: "Administrator not found" });
        name = adm.displayName;
      }
      const prev = conv.assignedAdminName ?? "Unassigned";
      await db.update(conversations).set({ assignedAdminId: input.adminId, assignedAdminName: name }).where(eq(conversations.id, conv.id));

      if (input.adminId && name && input.adminId !== ctx.admin.id) {
        await notifyAdmin(
          prev === "Unassigned" ? "Conversation Assigned" : "Conversation Transferred",
          `${ctx.admin.displayName} ${prev === "Unassigned" ? "assigned" : "transferred"} conversation "${conv.subject}" (${conv.convRef}) to you.`,
          "system",
          undefined,
          input.adminId,
        );
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, prev === "Unassigned" ? "conversation_assigned" : "conversation_transferred", `${conv.convRef} ("${conv.subject}"): "${prev}" → "${name ?? "Unassigned"}"`, ctx.req.headers);
      return { success: true };
    }),

  setConversationStatus: supportQuery()
    .input(z.object({ id: z.number(), status: z.enum(["open", "closed", "archived"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const conv = (await db.select().from(conversations).where(eq(conversations.id, input.id)).limit(1))[0];
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      if (!canAccess(conv, ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "This conversation is assigned to another administrator." });

      const prev = conv.status;
      await db.update(conversations).set({ status: input.status }).where(eq(conversations.id, conv.id));

      if (input.status === "closed") {
        await notifyInvestor(conv.investorId, "Conversation Closed", `Your conversation "${conv.subject}" (${conv.convRef}) has been closed by our team. Start a new conversation if you need further assistance.`);
      } else if (prev === "closed" && input.status === "open") {
        await notifyInvestor(conv.investorId, "Conversation Reopened", `Your conversation "${conv.subject}" (${conv.convRef}) has been reopened. Our team will continue assisting you.`);
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, `conversation_${input.status === "open" ? "reopened" : input.status}`, `${conv.convRef} ("${conv.subject}"): ${prev} → ${input.status}`, ctx.req.headers);
      return { success: true };
    }),

  setConversationPriority: supportQuery()
    .input(z.object({ id: z.number(), priority: z.enum(["low", "normal", "high", "urgent"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const conv = (await db.select().from(conversations).where(eq(conversations.id, input.id)).limit(1))[0];
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      if (!canAccess(conv, ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "This conversation is assigned to another administrator." });

      const prev = conv.priority;
      await db.update(conversations).set({ priority: input.priority }).where(eq(conversations.id, conv.id));
      await logAudit(ctx.admin.id, ctx.admin.displayName, "conversation_priority_changed", `${conv.convRef}: priority ${prev} → ${input.priority}`, ctx.req.headers);
      return { success: true };
    }),

  forwardMessage: supportQuery()
    .input(z.object({ messageId: z.number(), adminId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const msg = (await db.select().from(messages).where(eq(messages.id, input.messageId)).limit(1))[0];
      if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      const conv = (await db.select().from(conversations).where(eq(conversations.id, msg.conversationId)).limit(1))[0];
      if (!conv || !canAccess(conv, ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied." });
      const adm = (await db.select().from(adminUsers).where(eq(adminUsers.id, input.adminId)).limit(1))[0];
      if (!adm || adm.status !== "active") throw new TRPCError({ code: "NOT_FOUND", message: "Administrator not found" });

      await notifyAdmin(
        "Forwarded Message",
        `${ctx.admin.displayName} forwarded a message from conversation "${conv.subject}" (${conv.convRef}):\n"${msg.body.slice(0, 400)}"`,
        "system",
        undefined,
        input.adminId,
      );
      await logAudit(ctx.admin.id, ctx.admin.displayName, "conversation_forwarded", `${conv.convRef} message #${msg.id} forwarded to ${adm.displayName}`, ctx.req.headers);
      return { success: true };
    }),

  deleteMessage: supportQuery()
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const msg = (await db.select().from(messages).where(eq(messages.id, input.id)).limit(1))[0];
      if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      const conv = (await db.select().from(conversations).where(eq(conversations.id, msg.conversationId)).limit(1))[0];
      if (!conv || !canAccess(conv, ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied." });

      await db.update(messages).set({ deleted: "yes", body: "", attachmentName: null, attachmentUrl: null, attachmentSize: null }).where(eq(messages.id, msg.id));
      await logAudit(ctx.admin.id, ctx.admin.displayName, "message_deleted", `Message #${msg.id} in ${conv.convRef} deleted (soft)`, ctx.req.headers);
      return { success: true };
    }),

  exportConversation: supportQuery()
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const conv = (await db.select().from(conversations).where(eq(conversations.id, input.id)).limit(1))[0];
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      if (!canAccess(conv, ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "This conversation is assigned to another administrator." });

      const msgs = await db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(asc(messages.createdAt));
      const inv = (await db.select().from(investors).where(eq(investors.id, conv.investorId)).limit(1))[0];
      const line = "─".repeat(60);
      const header = [
        "NESTARO HOMES — Conversation Transcript",
        line,
        `Reference : ${conv.convRef}`,
        `Subject   : ${conv.subject}`,
        `Category  : ${messageCategoryLabel(conv.category)}`,
        `Customer  : ${inv ? `${inv.name} <${inv.email}>` : `Investor #${conv.investorId}`}`,
        `Status    : ${conv.status}   Priority: ${conv.priority}`,
        `Assigned  : ${conv.assignedAdminName ?? "—"}`,
        `Created   : ${new Date(conv.createdAt).toLocaleString("en-US")}`,
        line,
        "",
      ];
      const body = msgs.map((m) => {
        const who = m.senderType === "user" ? (inv?.name ?? "Customer") : m.senderType === "system" ? "Nestaro Homes (System)" : `${m.senderName} (Admin)`;
        const text = m.deleted === "yes" ? "[message deleted]" : m.body;
        const att = m.attachmentName ? `\n[Attachment: ${m.attachmentName}]` : "";
        return `[${new Date(m.createdAt).toLocaleString("en-US")}] ${who}:\n${text}${att}\n`;
      });
      await logAudit(ctx.admin.id, ctx.admin.displayName, "conversation_exported", `${conv.convRef} ("${conv.subject}") exported`, ctx.req.headers);
      return { text: [...header, ...body].join("\n"), filename: `conversation-${conv.convRef}.txt` };
    }),
});
