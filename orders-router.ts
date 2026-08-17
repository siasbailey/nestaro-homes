import { z } from "zod";
import { fmtMoney, fmtDateTime } from "./lib/format";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { orders, orderItems, customers, trackingHistory, orderDocuments } from "@db/schema";
import { eq } from "drizzle-orm";
import { notifyAdmin, logAudit } from "./lib/activity";
import { notifyAdminEmail } from "./lib/notify";
import { PAYMENT_METHOD_LABELS } from "@contracts/constants";
import { sendPurchaseProgressEmail } from "./lib/email";
import { generatePdfDocument } from "./lib/documents";
import { captureLead, leadEvent } from "./lib/crm";

function generateOrderNumber() {
  const prefix = "FH-NG";
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${year}-${random}`;
}

export const ordersRouter = createRouter({
  create: publicQuery
    .input(z.object({
      customer: z.object({
        firstName: z.string().min(1),
        middleName: z.string().optional(),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        country: z.string().min(1),
        state: z.string().min(1),
        city: z.string().min(1),
        postalCode: z.string().min(1),
      }),
      items: z.array(z.object({
        productId: z.number(),
        productName: z.string(),
        quantity: z.number().min(1),
        unitPrice: z.number(),
        totalPrice: z.number(),
      })),
      paymentMethod: z.enum(["paypal", "bank", "crypto"]),
      totalAmount: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      
      // Create customer
      const [customer] = await db.insert(customers).values({
        firstName: input.customer.firstName,
        middleName: input.customer.middleName || null,
        lastName: input.customer.lastName,
        email: input.customer.email,
        phone: input.customer.phone,
        country: input.customer.country,
        state: input.customer.state,
        city: input.customer.city,
        postalCode: input.customer.postalCode,
      }).$returningId();

      const customerId = customer.id;
      const orderNumber = generateOrderNumber();
      
      // Estimated handover date (14 days from now)
      const estimatedDelivery = new Date();
      estimatedDelivery.setDate(estimatedDelivery.getDate() + 14);

      // Create order
      const [order] = await db.insert(orders).values({
        orderNumber,
        customerId,
        totalAmount: String(input.totalAmount),
        paymentMethod: input.paymentMethod,
        paymentStatus: "pending",
        orderStatus: "purchase_request",
        transitDay: 0,
        estimatedDelivery,
      }).$returningId();

      // Create order items
      for (const item of input.items) {
        await db.insert(orderItems).values({
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice),
          totalPrice: String(item.totalPrice),
        });
      }

      // Create initial tracking history
      await db.insert(trackingHistory).values({
        orderId: order.id,
        status: "purchase_request",
        transitDay: 0,
        note: "Purchase request submitted successfully",
      });

      await notifyAdmin(
        "New Property Order Placed",
        `${input.customer.firstName} ${input.customer.lastName} placed order ${orderNumber} (${fmtMoney(input.totalAmount)}) via ${input.paymentMethod}.`,
        "order",
      );
      void notifyAdminEmail({
        eyebrow: "New Property Purchase",
        heading: `Property Order ${orderNumber} — ${fmtMoney(input.totalAmount)}`,
        intro: `${input.customer.firstName} ${input.customer.lastName} submitted a property purchase request. Payment verification is required.`,
        details: [
          { label: "Customer", value: `${input.customer.firstName} ${input.customer.lastName} · ${input.customer.email}` },
          { label: "Items", value: input.items.map((i) => `${i.productName} × ${i.quantity}`).join(", ") },
          { label: "Total", value: fmtMoney(input.totalAmount) },
          { label: "Payment Method", value: PAYMENT_METHOD_LABELS[input.paymentMethod] ?? input.paymentMethod },
          { label: "Reference", value: orderNumber },
          { label: "Date / Time", value: fmtDateTime(new Date()) },
          { label: "Status", value: "Pending Payment Verification" },
        ],
        adminLink: "/admin/property",
        ctaLabel: "View Orders",
        reqHeaders: ctx.req.headers,
      });

      // Email the buyer their purchase confirmation + tracking link
      await sendPurchaseProgressEmail({
        to: input.customer.email,
        name: `${input.customer.firstName} ${input.customer.lastName}`,
        orderNumber,
        stageLabel: "Purchase Request Submitted",
        note: `Thank you for your purchase of ${input.items.map((i) => i.productName).join(", ")} (${fmtMoney(input.totalAmount)}). Our team is reviewing your request and will verify your payment shortly.`,
        estimatedNext: "Payment Verification",
      });

      // Auto-generate purchase documents for the buyer's document vault
      const buyerName = `${input.customer.firstName} ${input.customer.lastName}`;
      const propertyNames = input.items.map((i) => i.productName).join(", ");
      const firstProperty = input.items[0]?.productName ?? null;
      void generatePdfDocument({
        ownerEmail: input.customer.email,
        ownerName: buyerName,
        category: "property",
        docType: "Purchase Agreement",
        amount: input.totalAmount,
        reference: orderNumber,
        propertyName: firstProperty,
        links: { orderId: order.id },
        lines: [
          { label: "Property", value: propertyNames },
          { label: "Buyer", value: buyerName },
          { label: "Purchase Price", value: fmtMoney(input.totalAmount) },
          { label: "Payment Method", value: input.paymentMethod === "bank" ? "Bank Transfer" : input.paymentMethod === "paypal" ? "PayPal" : input.paymentMethod === "crypto" ? "Cryptocurrency" : "Mortgage" },
          { label: "Status", value: "Purchase Request Submitted" },
        ],
        note: "This agreement records your property purchase with Nestaro Homes LLC Title documentation and handover follow the purchase progress stages.",
      });
      void generatePdfDocument({
        ownerEmail: input.customer.email,
        ownerName: buyerName,
        category: "financial",
        docType: "Sales Invoice",
        amount: input.totalAmount,
        reference: orderNumber,
        propertyName: firstProperty,
        links: { orderId: order.id },
        lines: [
          { label: "Property", value: propertyNames },
          { label: "Billed To", value: buyerName },
          ...input.items.map((i, idx) => ({ label: `Item ${idx + 1}`, value: `${i.productName} × ${i.quantity} — ${fmtMoney(i.totalPrice)}` })),
          { label: "Total Due", value: fmtMoney(input.totalAmount) },
        ],
        note: "Please retain this invoice for your records. A purchase receipt will be issued once payment is verified.",
      });

      // CRM: capture the buyer as a lead and log the purchase event
      void (async () => {
        await captureLead({
          name: buyerName,
          email: input.customer.email,
          phone: input.customer.phone,
          country: input.customer.country,
          state: input.customer.state,
          city: input.customer.city,
          source: "property_inquiry",
          interestedProperty: propertyNames,
          notes: `Purchase request ${orderNumber} — ${fmtMoney(input.totalAmount)}`,
          notify: false,
        });
        await leadEvent({
          email: input.customer.email,
          type: "property_reserved",
          description: `Property purchase initiated: ${propertyNames} (${orderNumber})`,
          stage: "payment_pending",
          notes: `Total: ${fmtMoney(input.totalAmount)} via ${input.paymentMethod}`,
        });
        await logAudit(null, buyerName, "property_purchase_initiated", `Property purchase initiated: ${propertyNames} (Order ${orderNumber}, ${fmtMoney(input.totalAmount)}) by ${buyerName} (${input.customer.email})`, ctx.req.headers);
      })();

      return { orderNumber, orderId: order.id };
    }),

  track: publicQuery
    .input(z.object({
      orderNumber: z.string(),
      email: z.string().email(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      
      const orderResult = await db.select().from(orders).where(eq(orders.orderNumber, input.orderNumber));
      if (!orderResult.length) return null;
      
      const order = orderResult[0];
      
      // Verify email matches customer
      const customerResult = await db.select().from(customers).where(eq(customers.id, order.customerId));
      if (!customerResult.length || customerResult[0].email !== input.email) return null;
      
      // Get order items
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      
      // Get tracking history
      const history = await db.select().from(trackingHistory)
        .where(eq(trackingHistory.orderId, order.id))
        .orderBy(trackingHistory.createdAt);

      // Get supporting documents
      const documents = await db.select().from(orderDocuments)
        .where(eq(orderDocuments.orderId, order.id))
        .orderBy(orderDocuments.uploadedAt);

      return { order, customer: customerResult[0], items, history, documents };
    }),
});
