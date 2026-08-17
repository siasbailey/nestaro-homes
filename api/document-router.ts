import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { createRouter, investorQuery, investAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { documents, documentDownloads, investors, investorNotifications } from "@db/schema";
import { logAudit, logInvestorActivity } from "./lib/activity";
import { sendSystemMessage } from "./lib/messaging";
import { notifyUser } from "./lib/notify";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES, DOCUMENT_TYPE_OPTIONS, DOCUMENT_UPLOAD } from "@contracts/documents";

const categoryKeys = DOCUMENT_CATEGORIES.map((c) => c.key) as [string, ...string[]];
const statusKeys = DOCUMENT_STATUSES.map((s) => s.key) as [string, ...string[]];
const docTypeValues = DOCUMENT_TYPE_OPTIONS.map((t) => t.type) as [string, ...string[]];

const dataUrlField = z
  .string()
  .regex(DOCUMENT_UPLOAD.dataUrlPattern, "Only PDF, JPG, JPEG or PNG files are accepted")
  .max(DOCUMENT_UPLOAD.maxBytesBase64, "File is too large — maximum 3 MB");

const filterInput = z.object({
  category: z.enum(categoryKeys).optional(),
  status: z.enum(statusKeys).optional(),
  search: z.string().max(120).optional(),
});

function matchesSearch(d: { name: string; docRef: string; docType: string; reference: string | null; propertyName: string | null; orderId: number | null; mortgageId: number | null; investmentId: number | null; ownerName: string | null; ownerEmail: string | null }, q: string): boolean {
  const hay = [
    d.name,
    d.docRef,
    d.docType,
    d.reference ?? "",
    d.propertyName ?? "",
    d.ownerName ?? "",
    d.ownerEmail ?? "",
    d.orderId ? `order ${d.orderId}` : "",
    d.mortgageId ? `mortgage ${d.mortgageId}` : "",
    d.investmentId ? `investment ${d.investmentId}` : "",
  ]
    .join(" ")
    .toLowerCase();
  return q.toLowerCase().split(/\s+/).every((part) => hay.includes(part));
}

function strip<T extends { dataUrl: string }>(d: T): Omit<T, "dataUrl"> {
  const { dataUrl: _omit, ...rest } = d;
  return rest;
}

export const documentRouter = createRouter({
  // ════════════ INVESTOR ════════════

  /** The investor's document vault (their docs + docs addressed to their email). */
  myDocuments: investorQuery.input(filterInput.optional()).query(async ({ ctx, input }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(documents)
      .where(or(eq(documents.investorId, ctx.investor.id), eq(documents.ownerEmail, ctx.investor.email)))
      .orderBy(desc(documents.createdAt))
      .limit(500);

    let out = rows.map(strip);
    if (input?.category) out = out.filter((d) => d.category === input.category);
    if (input?.status) out = out.filter((d) => d.status === input.status);
    if (input?.search?.trim()) out = out.filter((d) => matchesSearch(d as never, input.search!.trim()));
    return out;
  }),

  /** Fetch one document for preview/download (ownership enforced). */
  getDocument: investorQuery
    .input(z.object({ id: z.number(), purpose: z.enum(["preview", "download"]).default("preview") }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db.select().from(documents).where(eq(documents.id, input.id)).limit(1);
      const docRow = rows[0];
      const isAdmin = ctx.investor.role === "admin";
      if (!docRow || (!isAdmin && docRow.investorId !== ctx.investor.id && docRow.ownerEmail !== ctx.investor.email)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      if (input.purpose === "download") {
        const headers = ctx.req.headers;
        const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        const ua = headers.get("user-agent");
        await db.insert(documentDownloads).values({
          documentId: docRow.id,
          investorId: ctx.investor.id,
          investorName: ctx.investor.name,
          ip,
          userAgent: ua?.slice(0, 500) ?? null,
        });
        await logInvestorActivity(ctx.investor.id, "document_downloaded", `Downloaded "${docRow.name}" (${docRow.docRef})`, headers);
      }

      return docRow;
    }),

  // ════════════ ADMIN (Primary) ════════════

  /** Every document in the vault, with download counts. */
  allDocuments: investAdminQuery.input(filterInput.optional()).query(async ({ input }) => {
    const db = getDb();
    const rows = await db.select().from(documents).orderBy(desc(documents.createdAt)).limit(1000);
    const dls = await db.select({ documentId: documentDownloads.documentId, n: sql<number>`count(*)` }).from(documentDownloads).groupBy(documentDownloads.documentId);
    const counts = new Map(dls.map((d) => [Number(d.documentId), Number(d.n)]));

    let out = rows.map((r) => ({ ...strip(r), downloadCount: counts.get(Number(r.id)) ?? 0 }));
    if (input?.category) out = out.filter((d) => d.category === input.category);
    if (input?.status) out = out.filter((d) => d.status === input.status);
    if (input?.search?.trim()) out = out.filter((d) => matchesSearch(d as never, input.search!.trim()));
    return out;
  }),

  /** Upload an official document and assign it to an investor / record. */
  uploadDocument: investAdminQuery
    .input(
      z.object({
        investorEmail: z.string().email(),
        category: z.enum(categoryKeys),
        docType: z.enum(docTypeValues),
        name: z.string().min(3).max(255),
        status: z.enum(statusKeys).default("uploaded"),
        dataUrl: dataUrlField,
        orderId: z.number().optional().nullable(),
        mortgageId: z.number().optional().nullable(),
        investmentId: z.number().optional().nullable(),
        reference: z.string().max(80).optional().nullable(),
        propertyName: z.string().max(255).optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const invRows = await db.select().from(investors).where(eq(investors.email, input.investorEmail)).limit(1);
      const inv = invRows[0];
      const adminName = ctx.investor.name;

      // Duplicate prevention: same name + owner + category + similar size
      const dupes = await db
        .select()
        .from(documents)
        .where(and(eq(documents.ownerEmail, input.investorEmail), eq(documents.category, input.category as never), eq(documents.name, input.name)))
        .limit(1);
      if (dupes[0]) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A document named "${input.name}" already exists for ${input.investorEmail} in this category. Replace the existing document instead.`,
        });
      }

      const docRef = `FH-UP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const [row] = await db
        .insert(documents)
        .values({
          docRef,
          investorId: inv?.id ?? null,
          ownerEmail: input.investorEmail,
          ownerName: inv?.name ?? input.investorEmail,
          category: input.category as never,
          docType: input.docType,
          name: input.name,
          status: input.status as never,
          orderId: input.orderId ?? null,
          mortgageId: input.mortgageId ?? null,
          investmentId: input.investmentId ?? null,
          reference: input.reference ?? null,
          propertyName: input.propertyName ?? null,
          dataUrl: input.dataUrl,
          fileSize: Math.round(input.dataUrl.length * 0.75),
          version: 1,
          uploadedByName: adminName,
          source: "uploaded",
        })
        .$returningId();

      if (inv) {
        await db.insert(investorNotifications).values({
          investorId: inv.id,
          title: "New Document Uploaded",
          message: `A new document "${input.name}" has been uploaded to your Document Center.`,
          type: "info",
        });
        void sendSystemMessage(inv.id, {
          subject: "Documents Uploaded",
          category: "general_inquiry",
          body: `A new document "${input.name}" (${input.docType}) has been added to your Document Center. Open the Documents tab in your dashboard to view or download it.`,
          propertyName: input.propertyName ?? null,
          notify: false,
        });
        void notifyUser(inv.id, {
          type: "document_uploaded",
          category: "documents",
          title: "New Document Available",
          message: `A new document "${input.name}" (${input.docType}) has been added to your Document Center.`,
          link: "/invest/dashboard?tab=documents",
          inApp: false,
          emailDetails: [
            { label: "Document", value: input.name },
            { label: "Type", value: input.docType },
          ],
        });
      }
      await logAudit(ctx.investor.id, adminName, "document_uploaded", `Uploaded "${input.name}" (${docRef}, ${input.category}/${input.docType}) for ${input.investorEmail}`, ctx.req.headers);
      return { success: true, id: row.id, docRef };
    }),

  /** Replace a document's file — version bumps, investor is notified. */
  replaceDocument: investAdminQuery
    .input(z.object({ id: z.number(), dataUrl: dataUrlField }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(documents).where(eq(documents.id, input.id)).limit(1);
      const docRow = rows[0];
      if (!docRow) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      const adminName = ctx.investor.name;

      await db
        .update(documents)
        .set({
          dataUrl: input.dataUrl,
          fileSize: Math.round(input.dataUrl.length * 0.75),
          version: docRow.version + 1,
          status: "available",
          uploadedByName: adminName,
        })
        .where(eq(documents.id, input.id));

      if (docRow.investorId) {
        await db.insert(investorNotifications).values({
          investorId: docRow.investorId,
          title: "Document Updated",
          message: `"${docRow.name}" was replaced with a new version (v${docRow.version + 1}).`,
          type: "info",
        });
      }
      await logAudit(ctx.investor.id, adminName, "document_replaced", `Replaced "${docRow.name}" (${docRow.docRef}) — v${docRow.version} → v${docRow.version + 1}`, ctx.req.headers);
      return { success: true };
    }),

  /** Change status (e.g. archive, mark awaiting signature). */
  setDocumentStatus: investAdminQuery
    .input(z.object({ id: z.number(), status: z.enum(statusKeys) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(documents).where(eq(documents.id, input.id)).limit(1);
      const docRow = rows[0];
      if (!docRow) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      const adminName = ctx.investor.name;

      await db.update(documents).set({ status: input.status as never }).where(eq(documents.id, input.id));
      await logAudit(ctx.investor.id, adminName, "document_status", `"${docRow.name}" (${docRow.docRef}): ${docRow.status} → ${input.status}`, ctx.req.headers);
      return { success: true };
    }),

  /** Permanently delete a document. */
  deleteDocument: investAdminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(documents).where(eq(documents.id, input.id)).limit(1);
      const docRow = rows[0];
      if (!docRow) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      const adminName = ctx.investor.name;

      await db.delete(documentDownloads).where(eq(documentDownloads.documentId, input.id));
      await db.delete(documents).where(eq(documents.id, input.id));
      await logAudit(ctx.investor.id, adminName, "document_deleted", `Deleted "${docRow.name}" (${docRow.docRef}) owned by ${docRow.ownerEmail ?? "—"}`, ctx.req.headers);
      return { success: true };
    }),

  /** Download history (optionally for one document). */
  downloadHistory: investAdminQuery
    .input(z.object({ documentId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          id: documentDownloads.id,
          documentId: documentDownloads.documentId,
          investorName: documentDownloads.investorName,
          ip: documentDownloads.ip,
          userAgent: documentDownloads.userAgent,
          createdAt: documentDownloads.createdAt,
          documentName: documents.name,
          docRef: documents.docRef,
        })
        .from(documentDownloads)
        .leftJoin(documents, eq(documentDownloads.documentId, documents.id))
        .where(input.documentId ? eq(documentDownloads.documentId, input.documentId) : sql`1=1`)
        .orderBy(desc(documentDownloads.createdAt))
        .limit(300);
      return rows;
    }),
});
