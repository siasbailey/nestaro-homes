import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createRouter, investorQuery, investAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { investors, kycRequests, kycDocuments, kycHistory, investorNotifications, type Investor } from "@db/schema";
import { logAudit, logInvestorActivity, notifyAdmin } from "./lib/activity";
import { sendSystemMessage } from "./lib/messaging";
import { notifyUser } from "./lib/notify";
import {
  KYC_DOC_TYPES,
  KYC_REQUIRED_DOCS,
  KYC_UPLOAD,
  kycDocTypeLabel,
  kycNextTier,
  kycTierLabel,
  kycTierLimits,
} from "@contracts/kyc";

const docInput = z.object({
  docType: z.enum(KYC_DOC_TYPES.map((d) => d.key) as [string, ...string[]]),
  name: z.string().min(1).max(255),
  dataUrl: z
    .string()
    .regex(KYC_UPLOAD.dataUrlPattern, "Only PDF, JPG, JPEG or PNG files are accepted")
    .max(KYC_UPLOAD.maxBytesBase64, "File is too large — maximum 3 MB per file"),
});

async function notify(investorId: number | null, title: string, message: string, type: "info" | "success" | "warning" | "error" = "info") {
  const db = getDb();
  await db.insert(investorNotifications).values({ investorId, title, message, type });
}

async function addHistory(
  investorId: number,
  action: string,
  opts: { fromTier?: string | null; toTier?: string | null; note?: string | null; actorName?: string | null } = {}
) {
  const db = getDb();
  await db.insert(kycHistory).values({
    investorId,
    action,
    fromTier: opts.fromTier ?? null,
    toTier: opts.toTier ?? null,
    note: opts.note ?? null,
    actorName: opts.actorName ?? null,
  });
}

async function currentOpenRequest(investorId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(kycRequests)
    .where(and(eq(kycRequests.investorId, investorId), inArray(kycRequests.status, ["pending", "more_info"])))
    .orderBy(desc(kycRequests.submittedAt))
    .limit(1);
  return rows[0] ?? null;
}

export const kycRouter = createRouter({
  // ════════════ INVESTOR SIDE ════════════

  /** Everything the investor Verification page needs. */
  myVerification: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const inv = ctx.investor;
    const open = await currentOpenRequest(inv.id);
    const docs = open
      ? await db.select().from(kycDocuments).where(eq(kycDocuments.requestId, open.id)).orderBy(desc(kycDocuments.uploadedAt))
      : [];
    const lastRequestRows = await db
      .select()
      .from(kycRequests)
      .where(eq(kycRequests.investorId, inv.id))
      .orderBy(desc(kycRequests.submittedAt))
      .limit(1);
    const history = await db
      .select()
      .from(kycHistory)
      .where(eq(kycHistory.investorId, inv.id))
      .orderBy(desc(kycHistory.createdAt))
      .limit(50);

    const tier = inv.verificationTier;
    return {
      tier,
      tierLabel: kycTierLabel(tier),
      status: inv.verificationStatus,
      limits: kycTierLimits(tier),
      emailVerified: inv.emailVerified === "yes",
      phone: inv.phone ?? null,
      nextTier: kycNextTier(tier),
      openRequest: open ?? null,
      openDocuments: docs,
      lastRequest: lastRequestRows[0] ?? null,
      history,
    };
  }),

  /** Submit a tier upgrade request with documents. */
  submitRequest: investorQuery
    .input(
      z.object({
        tierRequested: z.enum(["tier2", "tier3"]),
        sourceOfFunds: z.string().max(2000).optional(),
        documents: z.array(docInput).max(10),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const inv = ctx.investor;

      if (inv.verificationStatus === "suspended") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your verification is suspended. Please contact support." });
      }

      const expected = kycNextTier(inv.verificationTier);
      if (input.tierRequested !== expected) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: expected
            ? `You can only request ${kycTierLabel(expected)} from your current level.`
            : "You already hold the highest verification tier.",
        });
      }

      const open = await currentOpenRequest(inv.id);
      if (open) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a verification request under review." });
      }

      // Required documents per tier
      const required = KYC_REQUIRED_DOCS[input.tierRequested] ?? [];
      for (const req of required) {
        if (!input.documents.some((d) => d.docType === req)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Missing required document: ${kycDocTypeLabel(req)}` });
        }
      }
      if (input.tierRequested === "tier3" && !input.sourceOfFunds?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A Source of Funds declaration is required for Tier 3." });
      }
      if (input.tierRequested === "tier3" && input.documents.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Please upload at least one supporting document." });
      }

      const [row] = await db
        .insert(kycRequests)
        .values({
          investorId: inv.id,
          tierRequested: input.tierRequested,
          status: "pending",
          sourceOfFunds: input.sourceOfFunds?.trim() || null,
        })
        .$returningId();

      for (const doc of input.documents) {
        await db.insert(kycDocuments).values({
          requestId: row.id,
          investorId: inv.id,
          docType: doc.docType as never,
          name: doc.name,
          dataUrl: doc.dataUrl,
        });
      }

      await db.update(investors).set({ verificationStatus: "pending" }).where(eq(investors.id, inv.id));

      await addHistory(inv.id, "submitted", {
        fromTier: inv.verificationTier,
        toTier: input.tierRequested,
        note: `Submitted ${kycTierLabel(input.tierRequested)} verification request with ${input.documents.length} document(s)`,
        actorName: inv.name,
      });
      await logInvestorActivity(inv.id, "kyc_submitted", `Requested upgrade to ${kycTierLabel(input.tierRequested)}`, ctx.req.headers);

      await notify(inv.id, "Verification Request Submitted", `Your ${kycTierLabel(input.tierRequested)} verification request has been submitted and is pending review.`, "info");
      await notify(inv.id, "Documents Received", `We received your ${input.documents.length} verification document(s). You will be notified once the review is complete.`, "info");
      await notifyAdmin(
        "New Verification Request",
        `${inv.name} (${inv.email}) submitted a ${kycTierLabel(input.tierRequested)} verification request.`,
        "security"
      );

      return { success: true, requestId: row.id };
    }),

  /** Upload extra documents to an existing request marked "more_info". */
  uploadAdditional: investorQuery
    .input(z.object({ documents: z.array(docInput).min(1).max(10) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const inv = ctx.investor;
      const open = await currentOpenRequest(inv.id);
      if (!open || open.status !== "more_info") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "There is no verification request waiting for additional documents." });
      }

      for (const doc of input.documents) {
        await db.insert(kycDocuments).values({
          requestId: open.id,
          investorId: inv.id,
          docType: doc.docType as never,
          name: doc.name,
          dataUrl: doc.dataUrl,
        });
      }

      await db.update(kycRequests).set({ status: "pending" }).where(eq(kycRequests.id, open.id));
      await db.update(investors).set({ verificationStatus: "pending" }).where(eq(investors.id, inv.id));

      await addHistory(inv.id, "documents_uploaded", {
        note: `Uploaded ${input.documents.length} additional document(s) for the ${kycTierLabel(open.tierRequested)} request`,
        actorName: inv.name,
      });
      await notifyAdmin(
        "Additional Verification Documents",
        `${inv.name} (${inv.email}) uploaded ${input.documents.length} additional document(s) for their ${kycTierLabel(open.tierRequested)} verification.`,
        "security"
      );
      return { success: true };
    }),

  // ════════════ ADMIN SIDE (Primary Admin) ════════════

  /** All verification requests, newest first, with investor context. */
  verificationRequests: investAdminQuery.query(async () => {
    const db = getDb();
    const reqs = await db.select().from(kycRequests).orderBy(desc(kycRequests.submittedAt)).limit(200);
    if (reqs.length === 0) return [];
    const invIds = [...new Set(reqs.map((r) => r.investorId))];
    const invs = await db.select().from(investors).where(inArray(investors.id, invIds));
    const docCounts = await db.select().from(kycDocuments).where(inArray(kycDocuments.requestId, reqs.map((r) => r.id)));
    const invMap = new Map(invs.map((i) => [i.id, i]));
    return reqs.map((r) => {
      const inv = invMap.get(r.investorId);
      return {
        ...r,
        investorName: inv?.name ?? "Unknown",
        investorEmail: inv?.email ?? "—",
        currentTier: inv?.verificationTier ?? "tier1",
        documentCount: docCounts.filter((d) => d.requestId === r.id).length,
      };
    });
  }),

  /** One request with documents, investor, and full history. */
  verificationDetail: investAdminQuery
    .input(z.object({ requestId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(kycRequests).where(eq(kycRequests.id, input.requestId)).limit(1);
      const req = rows[0];
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Verification request not found" });
      const invRows = await db.select().from(investors).where(eq(investors.id, req.investorId)).limit(1);
      const docs = await db.select().from(kycDocuments).where(eq(kycDocuments.requestId, req.id)).orderBy(desc(kycDocuments.uploadedAt));
      const history = await db.select().from(kycHistory).where(eq(kycHistory.investorId, req.investorId)).orderBy(desc(kycHistory.createdAt)).limit(50);
      return { request: req, investor: invRows[0] ?? null, documents: docs, history };
    }),

  /** Approve / reject / request more information. */
  reviewVerification: investAdminQuery
    .input(
      z.object({
        requestId: z.number(),
        decision: z.enum(["approve", "reject", "more_info"]),
        notes: z.string().max(2000).optional(),
        rejectionReason: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(kycRequests).where(eq(kycRequests.id, input.requestId)).limit(1);
      const req = rows[0];
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Verification request not found" });
      if (req.status !== "pending" && req.status !== "more_info") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This request has already been reviewed." });
      }
      const adminName = ctx.admin?.displayName ?? "Primary Administrator";
      const invRows = await db.select().from(investors).where(eq(investors.id, req.investorId)).limit(1);
      const inv = invRows[0] as Investor | undefined;
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investor not found" });

      const now = new Date();
      if (input.decision === "approve") {
        await db.update(kycRequests).set({
          status: "approved",
          adminNotes: input.notes ?? null,
          rejectionReason: null,
          reviewedAt: now,
          reviewedById: ctx.admin?.id ?? null,
          reviewedByName: adminName,
        }).where(eq(kycRequests.id, req.id));
        await db.update(investors).set({
          verificationTier: req.tierRequested,
          verificationStatus: "approved",
        }).where(eq(investors.id, inv.id));
        await addHistory(inv.id, "approved", {
          fromTier: inv.verificationTier,
          toTier: req.tierRequested,
          note: input.notes || `${kycTierLabel(req.tierRequested)} verification approved`,
          actorName: adminName,
        });
        await addHistory(inv.id, "upgraded", {
          fromTier: inv.verificationTier,
          toTier: req.tierRequested,
          note: `Verification tier upgraded to ${kycTierLabel(req.tierRequested)}`,
          actorName: adminName,
        });
        await notify(inv.id, "Verification Approved", `Congratulations! Your ${kycTierLabel(req.tierRequested)} verification has been approved. Higher deposit and investment limits are now active on your account.`, "success");
        await notify(inv.id, "Verification Tier Upgraded", `Your account is now ${kycTierLabel(req.tierRequested)}.`, "success");
        void sendSystemMessage(inv.id, {
          subject: "Account Verified",
          category: "account_verification",
          body: `Congratulations! Your ${kycTierLabel(req.tierRequested)} verification has been approved. Your account is now fully verified and higher deposit and investment limits are active.`,
          notify: false,
        });
        void notifyUser(inv.id, {
          type: "account_verified",
          category: "account_security",
          title: "Account Verification Approved",
          message: `Congratulations! Your ${kycTierLabel(req.tierRequested)} verification has been approved. Higher deposit and investment limits are now active on your account.`,
          severity: "success",
          link: "/invest/dashboard?tab=verification",
          inApp: false,
          security: true,
          emailDetails: [{ label: "Verification Tier", value: kycTierLabel(req.tierRequested) }],
        });
      } else if (input.decision === "reject") {
        await db.update(kycRequests).set({
          status: "rejected",
          adminNotes: input.notes ?? null,
          rejectionReason: input.rejectionReason ?? null,
          reviewedAt: now,
          reviewedById: ctx.admin?.id ?? null,
          reviewedByName: adminName,
        }).where(eq(kycRequests.id, req.id));
        await db.update(investors).set({ verificationStatus: "rejected" }).where(eq(investors.id, inv.id));
        await addHistory(inv.id, "rejected", {
          fromTier: inv.verificationTier,
          toTier: req.tierRequested,
          note: input.rejectionReason || "Verification request rejected",
          actorName: adminName,
        });
        await notify(inv.id, "Verification Rejected", `Your ${kycTierLabel(req.tierRequested)} verification was rejected.${input.rejectionReason ? ` Reason: ${input.rejectionReason}` : ""} You may submit a new request with corrected documents.`, "warning");
      } else {
        await db.update(kycRequests).set({
          status: "more_info",
          adminNotes: input.notes ?? null,
          reviewedAt: now,
          reviewedById: ctx.admin?.id ?? null,
          reviewedByName: adminName,
        }).where(eq(kycRequests.id, req.id));
        await db.update(investors).set({ verificationStatus: "more_info" }).where(eq(investors.id, inv.id));
        await addHistory(inv.id, "more_info", {
          note: input.notes || "Additional information requested",
          actorName: adminName,
        });
        await notify(inv.id, "Additional Information Required", `The review team needs more information for your ${kycTierLabel(req.tierRequested)} verification.${input.notes ? ` Note: ${input.notes}` : ""} Please open the Verification page to upload the requested documents.`, "warning");
      }

      await logAudit(
        ctx.admin?.id ?? null,
        adminName,
        `kyc_${input.decision}`,
        `${input.decision === "approve" ? "Approved" : input.decision === "reject" ? "Rejected" : "Requested more info on"} ${kycTierLabel(req.tierRequested)} verification for ${inv.name} (${inv.email})${input.rejectionReason ? ` — reason: ${input.rejectionReason}` : ""}${input.notes ? ` — notes: ${input.notes}` : ""}`,
        ctx.req.headers
      );
      return { success: true };
    }),

  /** Directly upgrade or downgrade an investor's tier. */
  setVerificationTier: investAdminQuery
    .input(z.object({ investorId: z.number(), tier: z.enum(["tier1", "tier2", "tier3"]), note: z.string().max(2000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const invRows = await db.select().from(investors).where(eq(investors.id, input.investorId)).limit(1);
      const inv = invRows[0];
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investor not found" });
      const adminName = ctx.admin?.displayName ?? "Primary Administrator";
      const direction = input.tier > inv.verificationTier ? "upgraded" : "downgraded";

      await db.update(investors).set({
        verificationTier: input.tier,
        verificationStatus: input.tier === "tier1" ? "not_started" : "approved",
      }).where(eq(investors.id, inv.id));

      await addHistory(inv.id, direction, {
        fromTier: inv.verificationTier,
        toTier: input.tier,
        note: input.note || `Tier ${direction} by administrator`,
        actorName: adminName,
      });
      await notify(
        inv.id,
        `Verification Tier ${direction === "upgraded" ? "Upgraded" : "Changed"}`,
        `Your verification level is now ${kycTierLabel(input.tier)}.${input.note ? ` Note: ${input.note}` : ""}`,
        direction === "upgraded" ? "success" : "info"
      );
      await logAudit(
        ctx.admin?.id ?? null,
        adminName,
        `kyc_tier_${direction}`,
        `${kycTierLabel(inv.verificationTier)} → ${kycTierLabel(input.tier)} for ${inv.name} (${inv.email})${input.note ? ` — ${input.note}` : ""}`,
        ctx.req.headers
      );
      return { success: true };
    }),

  /** Suspend (or restore) an investor's verification. */
  suspendVerification: investAdminQuery
    .input(z.object({ investorId: z.number(), suspend: z.boolean(), note: z.string().max(2000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const invRows = await db.select().from(investors).where(eq(investors.id, input.investorId)).limit(1);
      const inv = invRows[0];
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investor not found" });
      const adminName = ctx.admin?.displayName ?? "Primary Administrator";

      await db.update(investors).set({
        verificationStatus: input.suspend ? "suspended" : inv.verificationTier === "tier1" ? "not_started" : "approved",
      }).where(eq(investors.id, inv.id));

      await addHistory(inv.id, input.suspend ? "suspended" : "unsuspended", {
        note: input.note || (input.suspend ? "Verification suspended by administrator" : "Verification suspension lifted"),
        actorName: adminName,
      });
      await notify(
        inv.id,
        input.suspend ? "Verification Suspended" : "Verification Restored",
        input.suspend
          ? `Your account verification has been suspended${input.note ? `: ${input.note}` : ""}. Transactions are disabled — please contact support.`
          : "Your verification suspension has been lifted. Full access is restored.",
        input.suspend ? "error" : "success"
      );
      await logAudit(
        ctx.admin?.id ?? null,
        adminName,
        input.suspend ? "kyc_suspended" : "kyc_unsuspended",
        `${input.suspend ? "Suspended" : "Restored"} verification for ${inv.name} (${inv.email})${input.note ? ` — ${input.note}` : ""}`,
        ctx.req.headers
      );
      return { success: true };
    }),

  /** Full verification history for one investor (admin view). */
  investorVerificationHistory: investAdminQuery
    .input(z.object({ investorId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(kycHistory).where(eq(kycHistory.investorId, input.investorId)).orderBy(desc(kycHistory.createdAt)).limit(100);
    }),
});
