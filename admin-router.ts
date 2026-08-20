import { z } from "zod";
import * as cookie from "cookie";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, adminSessionQuery, adminPermQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { orders, orderItems, customers, trackingHistory, orderDocuments, contactSubmissions, products, adminUsers, investors, teamMembers } from "./db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { getSessionCookieOptions } from "./lib/cookies";
import { signAdminToken, parsePermissions } from "./lib/admin-session";
import { ensurePrimaryAdmin } from "./lib/admin-users";
import { checkRateLimit, resetRateLimit } from "./lib/rate-limit";
import { notifyAdmin, logAudit } from "./lib/activity";
// Keep purchase-stage definitions local so this router does not depend on the
// unavailable @contracts/purchase-stages path.
const PURCHASE_STAGE_KEYS = [
  "purchase_request",
  "payment_verification",
  "purchase_agreement",
  "legal_documentation",
  "property_allocation",
  "title_documentation",
  "final_inspection",
  "handed_over",
] as const;

const PURCHASE_STAGE_LABELS: Record<(typeof PURCHASE_STAGE_KEYS)[number], string> = {
  purchase_request: "Purchase Request",
  payment_verification: "Payment Verification",
  purchase_agreement: "Purchase Agreement",
  legal_documentation: "Legal Documentation",
  property_allocation: "Property Allocation",
  title_documentation: "Title Documentation",
  final_inspection: "Final Inspection",
  handed_over: "Handed Over",
};

function purchaseStageLabel(stage: (typeof PURCHASE_STAGE_KEYS)[number]) {
  return PURCHASE_STAGE_LABELS[stage];
}

function purchaseStageNext(stage: (typeof PURCHASE_STAGE_KEYS)[number]) {
  const index = PURCHASE_STAGE_KEYS.indexOf(stage);
  return index >= 0 && index < PURCHASE_STAGE_KEYS.length - 1
    ? PURCHASE_STAGE_LABELS[PURCHASE_STAGE_KEYS[index + 1]]
    : null;
}
import { sendPurchaseProgressEmail } from "./lib/email";
import { fmtMoney } from "./lib/format";
import { generatePdfDocument } from "./lib/documents";
import { leadEvent } from "./lib/crm";
import { sendSystemMessage } from "./lib/messaging";
import { notifyUser, notifyAdminEmail } from "./lib/notify";

// Keep the admin cookie configuration local so this router does not depend on
// the unavailable @contracts/constants path.
const AdminSession = {
  cookieName: "admin_session",
  maxAgeMs: 12 * 60 * 60 * 1000,
} as const;

type AdminUser = Parameters<typeof parsePermissions>[0];

function sanitizeAdmin(admin: AdminUser) {
  const { passwordHash: _ignored, ...rest } = admin;
  return { ...rest, permissions: parsePermissions(admin) };
}

export const adminRouter = createRouter({
  // Unified admin login — one password opens both Property Orders and
  // Investment Platform sections of the admin dashboard.
  login: publicQuery
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const email = input.email.toLowerCase().trim();
      const ip = ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const rateKey = `admin-login:${email}:${ip}`;
      if (!checkRateLimit(rateKey, 5, 10 * 60 * 1000)) {
        await notifyAdmin(
          "Suspicious Admin Login Attempts",
          `Repeated failed admin login attempts for ${email} from IP ${ip}. Rate limit applied.`,
          "security",
        );
        void notifyAdminEmail({
          eyebrow: "Security Alert — Admin Login Attempts",
          heading: "Suspicious Admin Login Activity",
          intro: `Repeated failed admin login attempts were detected and temporarily rate-limited.`,
          details: [
            { label: "Account", value: email },
            { label: "IP Address", value: ip },
            { label: "Action Taken", value: "Rate-limited for 10 minutes" },
          ],
          adminLink: "/admin/dashboard?section=audit",
          ctaLabel: "View Audit Log",
          reqHeaders: ctx.req.headers,
        });
        throw new Error("Too many attempts. Please wait 10 minutes and try again.");
      }

      // First-ever login: bootstrap the Primary Administrator from the
      // existing unified admin password (email admin@flexhavens.local).
      await ensurePrimaryAdmin();

      const rows = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
      const admin = rows.at(0);
      if (!admin || !(await bcrypt.compare(input.password, admin.passwordHash))) {
        await logAudit(null, email, "admin_login_failed", `Failed admin login attempt from IP ${ip}`, ctx.req.headers);
        throw new Error("Invalid email or password");
      }
      if (admin.status !== "active") {
        throw new Error("This administrator account has been suspended. Contact the Primary Administrator.");
      }
      resetRateLimit(rateKey);

      await db.update(adminUsers).set({ lastSignInAt: new Date() }).where(eq(adminUsers.id, admin.id));

      const opts = getSessionCookieOptions(ctx.req.headers);
      const sameSite = opts.sameSite?.toLowerCase() as "lax" | "none";

      // Admin session cookie (12h)
      const jwt = await signAdminToken({ adminId: admin.id, email: admin.email });
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(AdminSession.cookieName, jwt, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite,
          secure: opts.secure,
          maxAge: AdminSession.maxAgeMs / 1000,
        }),
      );

      await logAudit(admin.id, admin.displayName, "admin_login", "Signed into the admin dashboard", ctx.req.headers);
      return { success: true, admin: sanitizeAdmin(admin) };
    }),

  logout: adminSessionQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(AdminSession.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    await logAudit(ctx.admin.id, ctx.admin.displayName, "admin_logout", "Signed out of the admin dashboard", ctx.req.headers);
    return { success: true };
  }),

  adminMe: adminSessionQuery.query(({ ctx }) => sanitizeAdmin(ctx.admin)),

  // Property analytics for the unified Reports section
  propertyAnalytics: adminPermQuery("reports").query(async () => {
    const db = getDb();
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(2000);

    const months: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-US", { month: "short" }) });
    }
    const bucket = (date: Date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${d.getMonth()}`;
    };

    return {
      totalOrders: allOrders.length,
      completedOrders: allOrders.filter((o) => o.orderStatus === "handed_over").length,
      pendingOrders: allOrders.filter((o) => o.orderStatus === "purchase_request" || o.orderStatus === "payment_verification").length,
      failedPayments: allOrders.filter((o) => o.paymentStatus === "failed").length,
      totalRevenue: allOrders
        .filter((o) => o.orderStatus !== "cancelled")
        .reduce((s, o) => s + Number(o.totalAmount), 0),
      statusOverview: Object.entries(
        allOrders.reduce<Record<string, number>>((acc, o) => {
          acc[o.orderStatus] = (acc[o.orderStatus] ?? 0) + 1;
          return acc;
        }, {}),
      ).map(([status, count]) => ({ status, count })),
      monthlyRevenue: months.map((m) => ({
        month: m.label,
        revenue: allOrders
          .filter((o) => o.orderStatus !== "cancelled" && bucket(o.createdAt) === m.key)
          .reduce((s, o) => s + Number(o.totalAmount), 0),
        orders: allOrders.filter((o) => bucket(o.createdAt) === m.key).length,
      })),
    };
  }),

  // Stats for dashboard
  stats: adminPermQuery("orders").query(async () => {
    const db = getDb();
    const allOrders = await db.select().from(orders);
    const allContacts = await db.select().from(contactSubmissions);
    const allProducts = await db.select().from(products);
    
    const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const pendingOrders = allOrders.filter(o => o.orderStatus === "purchase_request" || o.orderStatus === "payment_verification").length;
    const inTransitOrders = allOrders.filter(o => ["purchase_agreement", "legal_documentation", "property_allocation", "title_documentation", "final_inspection"].includes(o.orderStatus)).length;
    const deliveredOrders = allOrders.filter(o => o.orderStatus === "handed_over").length;
    
    return {
      totalOrders: allOrders.length,
      totalRevenue,
      pendingOrders,
      inTransitOrders,
      deliveredOrders,
      totalContacts: allContacts.length,
      unreadContacts: allContacts.filter(c => c.isRead === "no").length,
      totalProducts: allProducts.length,
    };
  }),

  // List all orders with customer info
  orders: adminPermQuery("orders")
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
      
      const results = [];
      for (const order of allOrders) {
        const customer = await db.select().from(customers).where(eq(customers.id, order.customerId));
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        
        // Filter by search
        if (input?.search) {
          const search = input.search.toLowerCase();
          const customerName = customer.length ? `${customer[0].firstName} ${customer[0].lastName}`.toLowerCase() : "";
          if (!order.orderNumber.toLowerCase().includes(search) && !customerName.includes(search)) {
            continue;
          }
        }
        
        // Filter by status
        if (input?.status && input.status !== "all" && order.orderStatus !== input.status) {
          continue;
        }
        
        results.push({
          ...order,
          customer: customer[0] || null,
          items,
        });
      }
      
      return results;
    }),

  // Get single order details
  orderDetail: adminPermQuery("orders")
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const order = await db.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order.length) return null;
      
      const customer = await db.select().from(customers).where(eq(customers.id, order[0].customerId));
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order[0].id));
      const history = await db.select().from(trackingHistory)
        .where(eq(trackingHistory.orderId, order[0].id))
        .orderBy(trackingHistory.createdAt);
      
      const documents = await db.select().from(orderDocuments)
        .where(eq(orderDocuments.orderId, order[0].id))
        .orderBy(orderDocuments.uploadedAt);

      return { order: order[0], customer: customer[0] || null, items, history, documents };
    }),

  // Update order status / tracking
  updateStatus: adminPermQuery("orders")
    .input(z.object({
      orderId: z.number(),
      status: z.enum([...PURCHASE_STAGE_KEYS, "cancelled"]),
      note: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      await db.update(orders)
        .set({ orderStatus: input.status })
        .where(eq(orders.id, input.orderId));
      
      // Add tracking history entry
      const stageLabel = input.status === "cancelled" ? "Cancelled" : purchaseStageLabel(input.status);
      await db.insert(trackingHistory).values({
        orderId: input.orderId,
        status: input.status as any,
        note: input.note || `Purchase moved to: ${stageLabel}`,
      });

      // Notify the buyer automatically (branded email with tracking link)
      const orderRow = await db.select().from(orders).where(eq(orders.id, input.orderId));
      if (orderRow.length) {
        const cust = await db.select().from(customers).where(eq(customers.id, orderRow[0].customerId));
        if (cust.length) {
          await sendPurchaseProgressEmail({
            to: cust[0].email,
            name: `${cust[0].firstName} ${cust[0].lastName}`,
            orderNumber: orderRow[0].orderNumber,
            stageLabel,
            note: input.note || null,
            estimatedNext: input.status === "cancelled" ? null : purchaseStageNext(input.status),
            reqHeaders: ctx.req.headers,
          });

          // Auto-generate stage documents for the buyer's document vault
          if (input.status === "payment_verification" || input.status === "handed_over") {
            const itemRows = await db.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
            const propertyNames = itemRows.map((i) => i.productName).join(", ") || "Property";
            const buyerName = `${cust[0].firstName} ${cust[0].lastName}`;
            const buyerEmail = cust[0].email;
            const total = Number(orderRow[0].totalAmount);
            if (input.status === "payment_verification") {
              void generatePdfDocument({
                ownerEmail: buyerEmail,
                ownerName: buyerName,
                category: "financial",
                docType: "Purchase Receipt",
                amount: total,
                reference: orderRow[0].orderNumber,
                propertyName: itemRows[0]?.productName ?? null,
                links: { orderId: input.orderId },
                lines: [
                  { label: "Property", value: propertyNames },
                  { label: "Buyer", value: buyerName },
                  { label: "Amount Paid", value: fmtMoney(total) },
                  { label: "Status", value: "Payment Verified" },
                ],
                note: "Your payment has been verified. Legal documentation and title processing will now proceed.",
              });
            } else {
              void generatePdfDocument({
                ownerEmail: buyerEmail,
                ownerName: buyerName,
                category: "property",
                docType: "Handover Certificate",
                amount: total,
                reference: orderRow[0].orderNumber,
                propertyName: itemRows[0]?.productName ?? null,
                links: { orderId: input.orderId },
                lines: [
                  { label: "Property", value: propertyNames },
                  { label: "New Owner", value: buyerName },
                  { label: "Purchase Value", value: fmtMoney(total) },
                  { label: "Status", value: "Property Successfully Handed Over" },
                ],
                note: "This certificate confirms the successful handover of the property described above. Congratulations on your new home.",
              });
            }
          }

          // CRM: a completed handover converts the lead to "Property Purchased"
          if (input.status === "handed_over") {
            void leadEvent({
              email: cust[0].email,
              type: "property_purchased",
              description: `Property purchased and handed over (Order ${orderRow[0].orderNumber})`,
              stage: "property_purchased",
            });
            // Messaging: registered buyers get a permanent system message
            void (async () => {
              const invRows = await db.select().from(investors).where(eq(investors.email, cust[0].email.toLowerCase())).limit(1);
              if (invRows[0]) {
                await sendSystemMessage(invRows[0].id, {
                  subject: "Property Purchased",
                  category: "property_inquiry",
                  body: `Congratulations! Your property purchase (Order ${orderRow[0].orderNumber}) is complete and the property has been handed over. All purchase documents are available in your Documents vault.`,
                  propertyName: null,
                  notify: false,
                });
                await notifyUser(invRows[0].id, {
                  type: "property_handover_completed",
                  category: "property",
                  title: "Property Handover Completed",
                  message: `Congratulations! Your property purchase (Order ${orderRow[0].orderNumber}) is complete and the property has been handed over. All purchase documents are available in your Documents vault.`,
                  severity: "success",
                  link: "/invest/dashboard?tab=purchases",
                  relatedRef: orderRow[0].orderNumber,
                  inApp: false,
                });
              }
            })();
          }
        }
      }

      await notifyAdmin(
        "Purchase Progress Updated",
        `Order #${orderRow[0]?.orderNumber ?? input.orderId} moved to: ${stageLabel}.`,
        "order",
      );
      await logAudit(ctx.admin.id, ctx.admin.displayName, "order_updated", `Order #${input.orderId} moved to stage: ${stageLabel}`, ctx.req.headers);

      return { success: true };
    }),

  // Upload a supporting document (agreement, title doc, inspection report…)
  uploadOrderDocument: adminPermQuery("orders")
    .input(z.object({
      orderId: z.number(),
      name: z.string().min(1).max(255),
      dataUrl: z.string().max(3_000_000).regex(/^data:(application\/pdf|image\/(jpeg|jpg|png|webp));base64,/i, "Only PDF or image files are allowed"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const order = await db.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order.length) throw new Error("Order not found");
      await db.insert(orderDocuments).values({
        orderId: input.orderId,
        name: input.name,
        dataUrl: input.dataUrl,
      });
      await logAudit(ctx.admin.id, ctx.admin.displayName, "order_document_uploaded", `Document "${input.name}" uploaded to order ${order[0].orderNumber}`, ctx.req.headers);
      return { success: true };
    }),

  // Remove a supporting document
  deleteOrderDocument: adminPermQuery("orders")
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.delete(orderDocuments).where(eq(orderDocuments.id, input.documentId));
      await logAudit(ctx.admin.id, ctx.admin.displayName, "order_document_deleted", `Document #${input.documentId} removed`, ctx.req.headers);
      return { success: true };
    }),

  // Update payment status
  updatePayment: adminPermQuery("orders")
    .input(z.object({
      orderId: z.number(),
      paymentStatus: z.enum(["pending", "confirmed", "failed"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.update(orders)
        .set({ paymentStatus: input.paymentStatus })
        .where(eq(orders.id, input.orderId));
      if (input.paymentStatus === "failed") {
        await notifyAdmin("Failed Payment", `Payment marked as failed for order #${input.orderId}.`, "order");
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "payment_updated", `Order #${input.orderId} payment marked ${input.paymentStatus}`, ctx.req.headers);
      return { success: true };
    }),

  // Add admin note
  addNote: adminPermQuery("orders")
    .input(z.object({
      orderId: z.number(),
      note: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.select().from(orders).where(eq(orders.id, input.orderId));
      if (!existing.length) throw new Error("Order not found");
      
      const currentNotes = existing[0].adminNotes || "";
      const newNote = `${new Date().toISOString()}: ${input.note}\n${currentNotes}`;
      
      await db.update(orders)
        .set({ adminNotes: newNote })
        .where(eq(orders.id, input.orderId));
      await logAudit(ctx.admin.id, ctx.admin.displayName, "order_note_added", `Note added to order #${input.orderId}`, ctx.req.headers);
      
      return { success: true };
    }),

  // Contact submissions
  contacts: adminPermQuery("contact").query(async () => {
    const db = getDb();
    return db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt));
  }),

  // ── Property Price Management (Catalog permission) ────────────
  properties: adminPermQuery("catalog").query(async () => {
    const db = getDb();
return db.select().from(products); 
 }),

  updatePropertyPrice: adminPermQuery("catalog")
    .input(
      z.object({
        productId: z.number().int().positive(),
        price: z
          .number()
          .positive("Price must be greater than zero")
          .max(9_999_999_999.99, "Price is too large"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      const product = rows.at(0);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }
      const newPrice = input.price.toFixed(2);
      const oldPrice = Number(product.price);
      if (Number(newPrice) === oldPrice) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The new price is the same as the current price",
        });
      }
      await db.update(products).set({ price: newPrice }).where(eq(products.id, product.id));
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        "property_price_updated",
        `Property price updated: ${product.name} — ${fmtMoney(oldPrice)} → ${fmtMoney(Number(newPrice))}`,
        ctx.req.headers,
      );
      return { success: true, product: { ...product, price: newPrice } };
    }),

  // ── Property Media Management (Catalog permission) ────────────
  updatePropertyImages: adminPermQuery("catalog")
    .input(
      z.object({
        productId: z.number().int().positive(),
        images: z.array(z.string().min(1).max(4_500_000)).max(12),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      const product = rows.at(0);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }
      for (const img of input.images) {
        const ok = img.startsWith("/") || img.startsWith("https://") || img.startsWith("http://") || img.startsWith("data:image/");
        if (!ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid image source. Only site images, URLs or uploaded photos are allowed." });
        }
      }
      const stored = JSON.stringify(input.images);
      await db.update(products).set({ images: stored }).where(eq(products.id, product.id));
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        "property_images_updated",
        `Property images updated: ${product.name} — ${input.images.length} image(s)`,
        ctx.req.headers,
      );
      return { success: true, product: { ...product, images: stored } };
    }),

  // ── Team Section Management (Content permission) ──────────────
  teamMembers: adminPermQuery("content").query(async () => {
    const db = getDb();
    return db.select().from(teamMembers).orderBy(asc(teamMembers.sortOrder), asc(teamMembers.id));
  }),

  saveTeamMember: adminPermQuery("content")
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().trim().min(2).max(150),
        role: z.string().trim().min(2).max(150),
        bio: z.string().trim().max(2000).optional(),
        photo: z.string().max(4_500_000).optional(),
        sortOrder: z.number().int().min(0).max(999).default(0),
        isActive: z.enum(["yes", "no"]).default("yes"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (input.photo) {
        const ok = input.photo.startsWith("/") || input.photo.startsWith("https://") || input.photo.startsWith("http://") || input.photo.startsWith("data:image/");
        if (!ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid photo source. Only site images, URLs or uploaded photos are allowed." });
        }
      }
      const values = {
        name: input.name,
        role: input.role,
        bio: input.bio?.trim() || null,
        photo: input.photo || null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      };
      let memberId: number;
      if (input.id != null) {
        const existing = await db.select({ id: teamMembers.id }).from(teamMembers).where(eq(teamMembers.id, input.id)).limit(1);
        if (!existing.at(0)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found" });
        }
        await db.update(teamMembers).set(values).where(eq(teamMembers.id, input.id));
        memberId = input.id;
      } else {
        const [row] = await db.insert(teamMembers).values(values).$returningId();
        memberId = row.id;
      }
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        input.id != null ? "team_member_updated" : "team_member_added",
        `Team member ${input.id != null ? "updated" : "added"}: ${input.name} (${input.role})`,
        ctx.req.headers,
      );
      return { success: true, memberId };
    }),

  removeTeamMember: adminPermQuery("content")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.select({ name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, input.id)).limit(1);
      await db.delete(teamMembers).where(eq(teamMembers.id, input.id));
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        "team_member_removed",
        `Team member removed: ${existing.at(0)?.name ?? `#${input.id}`}`,
        ctx.req.headers,
      );
      return { success: true };
    }),

  reorderTeamMembers: adminPermQuery("content")
    .input(z.object({ orderedIds: z.array(z.number().int().positive()).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      for (let i = 0; i < input.orderedIds.length; i++) {
        await db.update(teamMembers).set({ sortOrder: i }).where(eq(teamMembers.id, input.orderedIds[i]));
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "team_members_reordered", `Team order updated (${input.orderedIds.length} members)`, ctx.req.headers);
      return { success: true };
    }),
});