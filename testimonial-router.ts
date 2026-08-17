import { z } from "zod";
import { asc, desc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, investorQuery, publicQuery, primaryAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { customers, investments, investorNotifications, mortgages, products, testimonials } from "@db/schema";
import { TESTIMONIAL_PHOTO } from "@contracts/testimonials";
import { logAudit, notifyAdmin } from "./lib/activity";

function validatePhoto(photo: { dataUrl: string; size: number }) {
  if (photo.size > TESTIMONIAL_PHOTO.maxBytes) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Photo exceeds the 2 MB size limit." });
  }
  if (photo.dataUrl.length > TESTIMONIAL_PHOTO.maxBytesBase64 || !TESTIMONIAL_PHOTO.dataUrlPattern.test(photo.dataUrl)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Photo must be a JPG or PNG image." });
  }
}

const photoInput = z.object({ dataUrl: z.string(), size: z.number().int().positive() }).nullable().optional();

export const testimonialRouter = createRouter({
  // ── Public: approved testimonials for the website ─────────────
  publicList: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: testimonials.id,
        customerName: testimonials.customerName,
        photo: testimonials.photo,
        propertyName: testimonials.propertyName,
        investmentPlan: testimonials.investmentPlan,
        mortgagePlan: testimonials.mortgagePlan,
        rating: testimonials.rating,
        title: testimonials.title,
        message: testimonials.message,
        featured: testimonials.featured,
        sortOrder: testimonials.sortOrder,
        createdAt: testimonials.createdAt,
        investorId: testimonials.investorId,
      })
      .from(testimonials)
      .where(eq(testimonials.status, "approved"))
      .orderBy(desc(testimonials.featured), asc(testimonials.sortOrder), desc(testimonials.createdAt))
      .limit(30);
    return rows.map((r) => ({ ...r, verified: r.investorId != null }));
  }),

  // ── User: eligibility, my submissions, submit ─────────────────
  myTestimonials: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(testimonials)
      .where(eq(testimonials.investorId, ctx.investor.id))
      .orderBy(desc(testimonials.createdAt));
    return rows.filter((r) => !r.deletedAt);
  }),

  eligibility: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const [invs, morts] = await Promise.all([
      db.select({ id: investments.id }).from(investments).where(eq(investments.investorId, ctx.investor.id)).limit(1),
      db.select({ id: mortgages.id }).from(mortgages).where(eq(mortgages.investorId, ctx.investor.id)).limit(1),
    ]);
    const custRows = await db
      .select({ id: customers.id })
      .from(customers)
      .where(sql`LOWER(${customers.email}) = ${ctx.investor.email.toLowerCase()}`)
      .limit(1);
    const verified = ctx.investor.verificationTier !== "tier1";
    const hasMilestone = invs.length > 0 || morts.length > 0 || custRows.length > 0;
    return { eligible: verified || hasMilestone, verified, hasMilestone, tier: ctx.investor.verificationTier };
  }),

  submit: investorQuery
    .input(
      z.object({
        rating: z.number().int().min(1).max(5),
        title: z.string().max(255).optional(),
        message: z.string().min(20).max(3000),
        propertyName: z.string().max(255).optional(),
        investmentPlan: z.string().max(255).optional(),
        mortgagePlan: z.string().max(255).optional(),
        photo: photoInput,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Eligibility: verified investor or has reached a purchase/investment milestone
      const [invs, morts] = await Promise.all([
        db.select({ id: investments.id }).from(investments).where(eq(investments.investorId, ctx.investor.id)).limit(1),
        db.select({ id: mortgages.id }).from(mortgages).where(eq(mortgages.investorId, ctx.investor.id)).limit(1),
      ]);
      const custRows = await db
        .select({ id: customers.id })
        .from(customers)
        .where(sql`LOWER(${customers.email}) = ${ctx.investor.email.toLowerCase()}`)
        .limit(1);
      const eligible = ctx.investor.verificationTier !== "tier1" || invs.length || morts.length || custRows.length;
      if (!eligible) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Testimonials are available after you complete verification or reach an investment or purchase milestone." });
      }

      // Duplicate prevention: one pending or approved testimonial per customer
      const mine = await db.select().from(testimonials).where(eq(testimonials.investorId, ctx.investor.id));
      if (mine.some((t) => !t.deletedAt && (t.status === "pending" || t.status === "approved"))) {
        throw new TRPCError({ code: "CONFLICT", message: "You already have a testimonial on record. Contact support if you would like to update it." });
      }

      if (input.photo) validatePhoto(input.photo);

      await db.insert(testimonials).values({
        investorId: ctx.investor.id,
        customerName: ctx.investor.name,
        photo: input.photo?.dataUrl ?? null,
        propertyName: input.propertyName || null,
        investmentPlan: input.investmentPlan || null,
        mortgagePlan: input.mortgagePlan || null,
        rating: input.rating,
        title: input.title || null,
        message: input.message,
        status: "pending",
      });

      await notifyAdmin("New Testimonial Submitted", `${ctx.investor.name} submitted a ${input.rating}-star testimonial — pending your review.`, "system");
      await logAudit(null, ctx.investor.name, "testimonial_submitted", `${ctx.investor.name} submitted a ${input.rating}-star testimonial${input.propertyName ? ` for ${input.propertyName}` : ""}`, ctx.req.headers);
      return { success: true };
    }),

  // ── Admin management (Primary) ────────────────────────────────
  adminList: primaryAdminQuery
    .input(z.object({ status: z.string().optional(), search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let rows = await db.select().from(testimonials).where(isNull(testimonials.deletedAt)).orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt));
      if (input?.status) rows = rows.filter((t) => t.status === input.status);
      const q = input?.search?.trim().toLowerCase();
      if (q) rows = rows.filter((t) => [t.customerName, t.title ?? "", t.message, t.propertyName ?? ""].join(" ").toLowerCase().includes(q));
      return rows;
    }),

  analytics: primaryAdminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(testimonials).where(isNull(testimonials.deletedAt));

    const total = rows.length;
    const pending = rows.filter((t) => t.status === "pending").length;
    const approved = rows.filter((t) => t.status === "approved").length;
    const rejected = rows.filter((t) => t.status === "rejected").length;
    const featured = rows.filter((t) => t.featured === "yes" && t.status === "approved").length;
    const rated = rows.filter((t) => t.rating > 0);
    const avgRating = rated.length ? Math.round((rated.reduce((s, t) => s + t.rating, 0) / rated.length) * 10) / 10 : 0;

    const distribution = [1, 2, 3, 4, 5].map((r) => ({ rating: `${r}★`, count: rows.filter((t) => t.rating === r).length }));

    const now = new Date();
    const months: { label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months.push({
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        count: rows.filter((t) => {
          const td = new Date(t.createdAt);
          return `${td.getFullYear()}-${td.getMonth()}` === key;
        }).length,
      });
    }

    const byProperty = new Map<string, number>();
    const byPlan = new Map<string, number>();
    for (const t of rows) {
      if (t.propertyName) byProperty.set(t.propertyName, (byProperty.get(t.propertyName) ?? 0) + 1);
      if (t.investmentPlan) byPlan.set(t.investmentPlan, (byPlan.get(t.investmentPlan) ?? 0) + 1);
    }

    return {
      cards: { total, pending, approved, rejected, avgRating, featured },
      charts: {
        distribution,
        monthly: months,
        byProperty: [...byProperty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })),
        byPlan: [...byPlan.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })),
      },
    };
  }),

  createTestimonial: primaryAdminQuery
    .input(
      z.object({
        customerName: z.string().min(2).max(255),
        rating: z.number().int().min(1).max(5),
        title: z.string().max(255).optional(),
        message: z.string().min(10).max(3000),
        propertyName: z.string().max(255).optional(),
        investmentPlan: z.string().max(255).optional(),
        mortgagePlan: z.string().max(255).optional(),
        featured: z.boolean().default(false),
        photo: photoInput,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (input.photo) validatePhoto(input.photo);
      const all = await db.select({ sortOrder: testimonials.sortOrder }).from(testimonials);
      const maxOrder = all.reduce((m, t) => Math.max(m, t.sortOrder), 0);

      await db.insert(testimonials).values({
        customerName: input.customerName.trim(),
        rating: input.rating,
        title: input.title || null,
        message: input.message,
        propertyName: input.propertyName || null,
        investmentPlan: input.investmentPlan || null,
        mortgagePlan: input.mortgagePlan || null,
        featured: input.featured ? "yes" : "no",
        photo: input.photo?.dataUrl ?? null,
        status: "approved",
        reviewedByName: ctx.admin.displayName,
        reviewedAt: new Date(),
        sortOrder: maxOrder + 1,
      });
      await logAudit(ctx.admin.id, ctx.admin.displayName, "testimonial_created", `Testimonial for "${input.customerName.trim()}" (${input.rating}★) created and published`, ctx.req.headers);
      return { success: true };
    }),

  updateTestimonial: primaryAdminQuery
    .input(
      z.object({
        id: z.number(),
        customerName: z.string().min(2).max(255).optional(),
        rating: z.number().int().min(1).max(5).optional(),
        title: z.string().max(255).nullable().optional(),
        message: z.string().min(10).max(3000).optional(),
        propertyName: z.string().max(255).nullable().optional(),
        investmentPlan: z.string().max(255).nullable().optional(),
        mortgagePlan: z.string().max(255).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const t = (await db.select().from(testimonials).where(eq(testimonials.id, input.id)).limit(1))[0];
      if (!t || t.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Testimonial not found" });

      const { id, ...fields } = input;
      const patch: Record<string, unknown> = {};
      const changes: string[] = [];
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue;
        const prev = (t as unknown as Record<string, unknown>)[k];
        const next = v === "" ? null : v;
        if (prev !== next) {
          patch[k] = next;
          changes.push(`${k}: "${String(prev ?? "—").slice(0, 60)}" → "${String(next ?? "—").slice(0, 60)}"`);
        }
      }
      if (Object.keys(patch).length) {
        await db.update(testimonials).set(patch).where(eq(testimonials.id, id));
        await logAudit(ctx.admin.id, ctx.admin.displayName, "testimonial_updated", `Testimonial #${id} (${t.customerName}) updated — ${changes.join("; ")}`, ctx.req.headers);
      }
      return { success: true };
    }),

  review: primaryAdminQuery
    .input(z.object({ id: z.number(), decision: z.enum(["approved", "rejected"]), note: z.string().max(1000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const t = (await db.select().from(testimonials).where(eq(testimonials.id, input.id)).limit(1))[0];
      if (!t || t.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Testimonial not found" });
      if (t.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending testimonials can be reviewed." });

      await db
        .update(testimonials)
        .set({ status: input.decision, adminNote: input.note || null, reviewedByName: ctx.admin.displayName, reviewedAt: new Date() })
        .where(eq(testimonials.id, t.id));

      if (t.investorId) {
        await db.insert(investorNotifications).values({
          investorId: t.investorId,
          title: input.decision === "approved" ? "Testimonial Approved" : "Testimonial Update",
          message:
            input.decision === "approved"
              ? "Thank you! Your testimonial has been approved and is now featured on our website."
              : `Your testimonial was reviewed but could not be published${input.note ? `: ${input.note}` : "."} You're welcome to submit an updated version.`,
          type: "info",
        });
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, `testimonial_${input.decision}`, `Testimonial #${t.id} (${t.customerName}, ${t.rating}★) ${input.decision}${input.note ? ` — note: ${input.note}` : ""}`, ctx.req.headers);
      return { success: true };
    }),

  setFeatured: primaryAdminQuery
    .input(z.object({ id: z.number(), featured: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const t = (await db.select().from(testimonials).where(eq(testimonials.id, input.id)).limit(1))[0];
      if (!t || t.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Testimonial not found" });
      if (input.featured && t.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved testimonials can be featured." });
      }
      await db.update(testimonials).set({ featured: input.featured ? "yes" : "no" }).where(eq(testimonials.id, t.id));
      await logAudit(ctx.admin.id, ctx.admin.displayName, input.featured ? "testimonial_featured" : "testimonial_unfeatured", `Testimonial #${t.id} (${t.customerName}) ${input.featured ? "featured on homepage" : "removed from homepage"}`, ctx.req.headers);
      return { success: true };
    }),

  setStatus: primaryAdminQuery
    .input(z.object({ id: z.number(), status: z.enum(["pending", "approved", "rejected", "archived"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const t = (await db.select().from(testimonials).where(eq(testimonials.id, input.id)).limit(1))[0];
      if (!t || t.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Testimonial not found" });
      const prev = t.status;
      await db.update(testimonials).set({ status: input.status, featured: input.status === "approved" ? t.featured : "no" }).where(eq(testimonials.id, t.id));
      await logAudit(ctx.admin.id, ctx.admin.displayName, "testimonial_status_changed", `Testimonial #${t.id} (${t.customerName}): ${prev} → ${input.status}`, ctx.req.headers);
      return { success: true };
    }),

  reorder: primaryAdminQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      for (let i = 0; i < input.ids.length; i++) {
        await db.update(testimonials).set({ sortOrder: i + 1 }).where(eq(testimonials.id, input.ids[i]));
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "testimonials_reordered", `Testimonials reordered (${input.ids.length} items)`, ctx.req.headers);
      return { success: true };
    }),

  deleteTestimonial: primaryAdminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const t = (await db.select().from(testimonials).where(eq(testimonials.id, input.id)).limit(1))[0];
      if (!t || t.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Testimonial not found" });
      // Soft delete — record remains for audit purposes
      await db.update(testimonials).set({ deletedAt: new Date(), status: "archived", featured: "no" }).where(eq(testimonials.id, t.id));
      await logAudit(ctx.admin.id, ctx.admin.displayName, "testimonial_deleted", `Testimonial #${t.id} (${t.customerName}) deleted (soft)`, ctx.req.headers);
      return { success: true };
    }),

  properties: primaryAdminQuery.query(async () => {
    const db = getDb();
    return db.select({ id: products.id, name: products.name }).from(products).orderBy(asc(products.name));
  }),
});
