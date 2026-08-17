import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminPermQuery, createRouter, investorQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { adminUsers, appointments, leads, products, type Appointment } from "@db/schema";
import { APPOINTMENT_TYPES, appointmentTypeLabel } from "@contracts/crm";
import { addLeadActivity, captureLead } from "./lib/crm";
import {
  adminHasConflict,
  appointmentRefFor,
  combineDateTime,
  fmtWhen,
  generateAppointmentConfirmationPdf,
  notifyCustomer,
} from "./lib/appointments";
import { logAudit, logInvestorActivity, notifyAdmin } from "./lib/activity";
import { notifyAdminEmail } from "./lib/notify";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^\d{2}:\d{2}$/;

const apptQuery = () => adminPermQuery("appointments");

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const appointmentRouter = createRouter({
  // ── Public booking (property page, contact page, dashboards) ──
  book: publicQuery
    .input(
      z.object({
        name: z.string().min(2).max(255),
        email: z.string().email().max(320),
        phone: z.string().min(5).max(50),
        type: z.enum(Object.keys(APPOINTMENT_TYPES) as [string, ...string[]]),
        productId: z.number().optional(),
        date: z.string().regex(dateRe, "Use YYYY-MM-DD"),
        time: z.string().regex(timeRe, "Use HH:mm"),
        duration: z.number().int().min(15).max(480).optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const preferredAt = combineDateTime(input.date, input.time);
      if (preferredAt.getTime() < Date.now() - 5 * 60_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Please choose a date and time in the future." });
      }

      const email = input.email.toLowerCase().trim();

      // Duplicate protection: same person, same type, same slot still open
      const mine = await db.select().from(appointments).where(eq(appointments.email, email));
      const dupe = mine.find(
        (a) =>
          (a.status === "pending" || a.status === "confirmed") &&
          a.type === input.type &&
          new Date(a.preferredAt).getTime() === preferredAt.getTime(),
      );
      if (dupe) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have a booking for this appointment type at that date and time.",
        });
      }

      let propertyName: string | null = null;
      if (input.productId) {
        const p = (await db.select().from(products).where(eq(products.id, input.productId)).limit(1))[0];
        propertyName = p?.name ?? null;
      }
      if (input.type === "property_inspection" && !propertyName && input.productId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const leadId = await captureLead({
        name: input.name,
        email,
        phone: input.phone,
        source: "appointment_request",
        interestedProperty: propertyName,
        investmentInterest: input.type === "investment_consultation" ? "Investment Consultation" : null,
        mortgageInterest: input.type === "mortgage_consultation" ? "Mortgage Consultation" : null,
        notes: input.notes || null,
        notify: false,
      });

      const ref = appointmentRefFor();
      await db
        .insert(appointments)
        .values({
          appointmentRef: ref,
          investorId: ctx.investor?.id ?? null,
          leadId,
          customerName: input.name.trim(),
          email,
          phone: input.phone,
          type: input.type as never,
          productId: input.productId ?? null,
          propertyName,
          preferredAt,
          durationMinutes: input.duration ?? (APPOINTMENT_TYPES as Record<string, { defaultDuration: number }>)[input.type]?.defaultDuration ?? 60,
          notes: input.notes || null,
          status: "pending",
        });

      if (leadId) {
        await addLeadActivity(leadId, "appointment", `Appointment requested: ${appointmentTypeLabel(input.type)} — ${fmtWhen(preferredAt)}`, {
          notes: input.notes || null,
          adminName: "System",
        });
      }
      if (ctx.investor) {
        await logInvestorActivity(ctx.investor.id, "appointment_booked", `${appointmentTypeLabel(input.type)} (${ref}) for ${fmtWhen(preferredAt)}`, ctx.req.headers);
      }
      await notifyAdmin(
        "New Appointment Request",
        `${input.name.trim()} requested ${appointmentTypeLabel(input.type)} on ${fmtWhen(preferredAt)}${propertyName ? ` — ${propertyName}` : ""}.`,
        "system",
      );
      void notifyAdminEmail({
        eyebrow: "New Appointment Request",
        heading: `${appointmentTypeLabel(input.type)} — ${input.name.trim()}`,
        intro: `${input.name.trim()} requested ${appointmentTypeLabel(input.type)} on ${fmtWhen(preferredAt)}.`,
        details: [
          { label: "Name", value: input.name.trim() },
          { label: "Type", value: appointmentTypeLabel(input.type) },
          { label: "Preferred Time", value: fmtWhen(preferredAt) },
          { label: "Property", value: propertyName ?? "" },
          { label: "Reference", value: ref },
          { label: "Status", value: "Pending Confirmation" },
        ],
        adminLink: "/admin/dashboard?section=appointments",
        ctaLabel: "View Appointments",
        reqHeaders: ctx.req.headers,
      });
      await notifyCustomer(
        { investorId: ctx.investor?.id ?? null, email, customerName: input.name.trim(), appointmentRef: ref },
        "Appointment Request Received",
        `Your request for a ${appointmentTypeLabel(input.type)} on ${fmtWhen(preferredAt)} has been received. Our team will confirm your appointment shortly.`,
        ctx.req.headers,
      );
      await logAudit(null, "Customer", "appointment_requested", `${ref} — ${input.name.trim()} (${email}) requested ${appointmentTypeLabel(input.type)} for ${fmtWhen(preferredAt)}${propertyName ? `, property: ${propertyName}` : ""}`, ctx.req.headers);

      return { success: true, reference: ref };
    }),

  // ── Customer dashboard ────────────────────────────────────────
  myAppointments: investorQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db.select().from(appointments).where(eq(appointments.investorId, ctx.investor.id)).orderBy(desc(appointments.preferredAt));
  }),

  cancelMine: investorQuery
    .input(z.object({ id: z.number(), reason: z.string().max(500).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const appt = (await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1))[0];
      if (!appt || appt.investorId !== ctx.investor.id) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      if (appt.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only appointments awaiting confirmation can be cancelled online. Please contact our team to cancel a confirmed appointment." });
      }

      await db
        .update(appointments)
        .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: input.reason || "Cancelled by customer" })
        .where(eq(appointments.id, appt.id));

      if (appt.leadId) {
        await addLeadActivity(appt.leadId, "appointment", `Appointment cancelled by customer: ${appointmentTypeLabel(appt.type)} (${appt.appointmentRef})`, { adminName: "System" });
      }
      await notifyAdmin("Appointment Cancelled", `${appt.customerName} cancelled ${appointmentTypeLabel(appt.type)} (${appt.appointmentRef}) scheduled for ${fmtWhen(new Date(appt.preferredAt))}.`, "system");
      await logInvestorActivity(ctx.investor.id, "appointment_cancelled", `${appt.appointmentRef} — ${appointmentTypeLabel(appt.type)}`, ctx.req.headers);
      await logAudit(null, "Customer", "appointment_cancelled", `${appt.appointmentRef} cancelled by ${appt.customerName} — ${input.reason || "no reason given"}`, ctx.req.headers);
      return { success: true };
    }),

  rescheduleMine: investorQuery
    .input(
      z.object({
        id: z.number(),
        date: z.string().regex(dateRe),
        time: z.string().regex(timeRe),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const appt = (await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1))[0];
      if (!appt || appt.investorId !== ctx.investor.id) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      if (!["pending", "confirmed", "rescheduled"].includes(appt.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment can no longer be rescheduled." });
      }
      const preferredAt = combineDateTime(input.date, input.time);
      if (preferredAt.getTime() < Date.now()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Please choose a date and time in the future." });
      }

      await db
        .update(appointments)
        .set({
          preferredAt,
          status: "pending",
          confirmedAt: null,
          reminder24hAt: null,
          reminder1hAt: null,
          notes: input.note ? `${appt.notes ? `${appt.notes}\n` : ""}[Reschedule note] ${input.note}` : appt.notes,
        })
        .where(eq(appointments.id, appt.id));

      if (appt.leadId) {
        await addLeadActivity(appt.leadId, "appointment", `Reschedule requested: ${appointmentTypeLabel(appt.type)} (${appt.appointmentRef}) → ${fmtWhen(preferredAt)}`, { adminName: "System" });
      }
      await notifyAdmin("Appointment Reschedule Requested", `${appt.customerName} requested to move ${appointmentTypeLabel(appt.type)} (${appt.appointmentRef}) to ${fmtWhen(preferredAt)}.`, "system");
      await logInvestorActivity(ctx.investor.id, "appointment_rescheduled", `${appt.appointmentRef} → ${fmtWhen(preferredAt)}`, ctx.req.headers);
      await logAudit(null, "Customer", "appointment_reschedule_requested", `${appt.appointmentRef} — ${appt.customerName} requested ${fmtWhen(preferredAt)}`, ctx.req.headers);
      return { success: true };
    }),

  confirmationPdf: investorQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const appt = (await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1))[0];
      if (!appt || appt.investorId !== ctx.investor.id) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      if (!["confirmed", "rescheduled", "completed"].includes(appt.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Confirmation is available once your appointment has been confirmed." });
      }
      const dataUrl = await generateAppointmentConfirmationPdf(appt);
      return { dataUrl, filename: `Appointment-${appt.appointmentRef}.pdf` };
    }),

  // ── Admin management ──────────────────────────────────────────
  list: apptQuery()
    .input(
      z
        .object({
          status: z.string().optional(),
          type: z.string().optional(),
          assignedAdminId: z.number().optional(),
          search: z.string().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      let rows = await db.select().from(appointments).orderBy(desc(appointments.preferredAt));
      if (input?.status) rows = rows.filter((a) => a.status === input.status);
      if (input?.type) rows = rows.filter((a) => a.type === input.type);
      if (input?.assignedAdminId) rows = rows.filter((a) => a.assignedAdminId === input.assignedAdminId);
      if (input?.dateFrom) rows = rows.filter((a) => new Date(a.preferredAt) >= new Date(`${input.dateFrom}T00:00:00`));
      if (input?.dateTo) rows = rows.filter((a) => new Date(a.preferredAt) <= new Date(`${input.dateTo}T23:59:59`));
      const q = input?.search?.trim().toLowerCase();
      if (q) {
        rows = rows.filter((a) =>
          [a.customerName, a.email, a.phone, a.appointmentRef, a.propertyName ?? ""].join(" ").toLowerCase().includes(q),
        );
      }
      return rows.slice(0, 500);
    }),

  confirm: apptQuery()
    .input(
      z.object({
        id: z.number(),
        assignedAdminId: z.number().nullable().optional(),
        location: z.string().max(255).optional(),
        meetingLink: z.string().max(500).optional(),
        durationMinutes: z.number().int().min(15).max(480).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const appt = (await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1))[0];
      if (!appt) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      if (!["pending", "rescheduled"].includes(appt.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Only pending appointments can be confirmed (current status: ${appt.status}).` });
      }

      const assigneeId = input.assignedAdminId !== undefined ? input.assignedAdminId : appt.assignedAdminId;
      let assigneeName: string | null = appt.assignedAdminName;
      if (input.assignedAdminId !== undefined) {
        if (input.assignedAdminId === null) {
          assigneeName = null;
        } else {
          const adm = (await db.select().from(adminUsers).where(eq(adminUsers.id, input.assignedAdminId)).limit(1))[0];
          if (!adm || adm.status !== "active") throw new TRPCError({ code: "NOT_FOUND", message: "Administrator not found" });
          assigneeName = adm.displayName;
        }
      }

      const duration = input.durationMinutes ?? appt.durationMinutes;
      if (assigneeId) {
        const conflict = await adminHasConflict(assigneeId, new Date(appt.preferredAt), duration, appt.id);
        if (conflict) {
          throw new TRPCError({ code: "CONFLICT", message: `${assigneeName} already has an appointment overlapping this time slot. Choose a different time or assign another administrator.` });
        }
      }

      await db
        .update(appointments)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          assignedAdminId: assigneeId ?? null,
          assignedAdminName: assigneeName,
          location: input.location !== undefined ? input.location || null : appt.location,
          meetingLink: input.meetingLink !== undefined ? input.meetingLink || null : appt.meetingLink,
          durationMinutes: duration,
        })
        .where(eq(appointments.id, appt.id));

      const when = fmtWhen(new Date(appt.preferredAt));
      if (appt.leadId) {
        await addLeadActivity(appt.leadId, "appointment", `Appointment confirmed: ${appointmentTypeLabel(appt.type)} — ${when}`, {
          adminId: ctx.admin.id,
          adminName: ctx.admin.displayName,
        });
      }
      await notifyCustomer(
        appt,
        "Appointment Confirmed",
        `Your ${appointmentTypeLabel(appt.type)} is confirmed for ${when}${input.location ? ` at ${input.location}` : ""}${input.meetingLink ? `. Meeting link: ${input.meetingLink}` : ""}${assigneeName ? `. Your consultant: ${assigneeName}` : ""}.`,
        ctx.req.headers,
      );
      if (assigneeId && assigneeId !== ctx.admin.id) {
        await notifyAdmin("Appointment Assigned", `${ctx.admin.displayName} confirmed and assigned ${appointmentTypeLabel(appt.type)} (${appt.appointmentRef}) with ${appt.customerName} on ${when} to you.`, "system", undefined, assigneeId);
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "appointment_confirmed", `${appt.appointmentRef} — ${appt.customerName}, ${appointmentTypeLabel(appt.type)} on ${when}${assigneeName ? `, assigned to ${assigneeName}` : ""}`, ctx.req.headers);
      return { success: true };
    }),

  reschedule: apptQuery()
    .input(
      z.object({
        id: z.number(),
        date: z.string().regex(dateRe),
        time: z.string().regex(timeRe),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const appt = (await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1))[0];
      if (!appt) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      if (["completed", "cancelled", "no_show"].includes(appt.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment can no longer be rescheduled." });
      }
      const preferredAt = combineDateTime(input.date, input.time);

      if (appt.assignedAdminId) {
        const conflict = await adminHasConflict(appt.assignedAdminId, preferredAt, appt.durationMinutes, appt.id);
        if (conflict) {
          throw new TRPCError({ code: "CONFLICT", message: `${appt.assignedAdminName} already has an appointment overlapping the new time slot.` });
        }
      }

      const oldWhen = fmtWhen(new Date(appt.preferredAt));
      await db
        .update(appointments)
        .set({ preferredAt, status: "rescheduled", reminder24hAt: null, reminder1hAt: null })
        .where(eq(appointments.id, appt.id));

      const newWhen = fmtWhen(preferredAt);
      if (appt.leadId) {
        await addLeadActivity(appt.leadId, "appointment", `Appointment rescheduled: ${oldWhen} → ${newWhen}`, {
          notes: input.note || null,
          adminId: ctx.admin.id,
          adminName: ctx.admin.displayName,
        });
      }
      await notifyCustomer(appt, "Appointment Rescheduled", `Your ${appointmentTypeLabel(appt.type)} has been moved from ${oldWhen} to ${newWhen}.${input.note ? ` Note: ${input.note}` : ""}`, ctx.req.headers);
      await logAudit(ctx.admin.id, ctx.admin.displayName, "appointment_rescheduled", `${appt.appointmentRef} — ${oldWhen} → ${newWhen}${input.note ? ` (${input.note})` : ""}`, ctx.req.headers);
      return { success: true };
    }),

  cancel: apptQuery()
    .input(z.object({ id: z.number(), reason: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const appt = (await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1))[0];
      if (!appt) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      if (["completed", "cancelled", "no_show"].includes(appt.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment is already closed." });
      }

      await db
        .update(appointments)
        .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: input.reason })
        .where(eq(appointments.id, appt.id));

      if (appt.leadId) {
        await addLeadActivity(appt.leadId, "appointment", `Appointment cancelled: ${appointmentTypeLabel(appt.type)} — ${fmtWhen(new Date(appt.preferredAt))}`, {
          notes: input.reason,
          adminId: ctx.admin.id,
          adminName: ctx.admin.displayName,
        });
      }
      await notifyCustomer(appt, "Appointment Cancelled", `Your ${appointmentTypeLabel(appt.type)} scheduled for ${fmtWhen(new Date(appt.preferredAt))} has been cancelled. Reason: ${input.reason}. Please contact us to book a new appointment.`, ctx.req.headers);
      await logAudit(ctx.admin.id, ctx.admin.displayName, "appointment_cancelled", `${appt.appointmentRef} — ${appt.customerName}, reason: ${input.reason}`, ctx.req.headers);
      return { success: true };
    }),

  complete: apptQuery()
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const appt = (await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1))[0];
      if (!appt) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      if (!["confirmed", "rescheduled", "pending"].includes(appt.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment is already closed." });
      }

      await db.update(appointments).set({ status: "completed", completedAt: new Date() }).where(eq(appointments.id, appt.id));
      if (appt.leadId) {
        await addLeadActivity(appt.leadId, "appointment", `Appointment completed: ${appointmentTypeLabel(appt.type)} (${appt.appointmentRef})`, {
          adminId: ctx.admin.id,
          adminName: ctx.admin.displayName,
        });
      }
      await notifyCustomer(appt, "Appointment Completed", `Thank you for meeting with us. We hope your ${appointmentTypeLabel(appt.type)} was helpful — our team will follow up with next steps shortly.`, ctx.req.headers);
      await logAudit(ctx.admin.id, ctx.admin.displayName, "appointment_completed", `${appt.appointmentRef} — ${appt.customerName}`, ctx.req.headers);
      return { success: true };
    }),

  noShow: apptQuery()
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const appt = (await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1))[0];
      if (!appt) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      if (!["confirmed", "rescheduled", "pending"].includes(appt.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment is already closed." });
      }

      await db.update(appointments).set({ status: "no_show" }).where(eq(appointments.id, appt.id));
      if (appt.leadId) {
        await addLeadActivity(appt.leadId, "appointment", `Customer did not show up: ${appointmentTypeLabel(appt.type)} (${appt.appointmentRef})`, {
          adminId: ctx.admin.id,
          adminName: ctx.admin.displayName,
        });
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "appointment_no_show", `${appt.appointmentRef} — ${appt.customerName} marked as no-show`, ctx.req.headers);
      return { success: true };
    }),

  assign: apptQuery()
    .input(z.object({ id: z.number(), adminId: z.number().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const appt = (await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1))[0];
      if (!appt) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });

      let name: string | null = null;
      if (input.adminId) {
        const adm = (await db.select().from(adminUsers).where(eq(adminUsers.id, input.adminId)).limit(1))[0];
        if (!adm || adm.status !== "active") throw new TRPCError({ code: "NOT_FOUND", message: "Administrator not found" });
        name = adm.displayName;
        if (["confirmed", "rescheduled"].includes(appt.status)) {
          const conflict = await adminHasConflict(input.adminId, new Date(appt.preferredAt), appt.durationMinutes, appt.id);
          if (conflict) {
            throw new TRPCError({ code: "CONFLICT", message: `${name} already has an appointment overlapping this time slot.` });
          }
        }
      }

      const prev = appt.assignedAdminName ?? "Unassigned";
      await db.update(appointments).set({ assignedAdminId: input.adminId, assignedAdminName: name }).where(eq(appointments.id, appt.id));
      if (input.adminId && name && input.adminId !== ctx.admin.id) {
        await notifyAdmin("Appointment Assigned", `${ctx.admin.displayName} assigned ${appointmentTypeLabel(appt.type)} (${appt.appointmentRef}) with ${appt.customerName} on ${fmtWhen(new Date(appt.preferredAt))} to you.`, "system", undefined, input.adminId);
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "appointment_assigned", `${appt.appointmentRef} assignment: "${prev}" → "${name ?? "Unassigned"}"`, ctx.req.headers);
      return { success: true };
    }),

  addNotes: apptQuery()
    .input(z.object({ id: z.number(), note: z.string().min(1).max(2000) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const appt = (await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1))[0];
      if (!appt) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });

      const stamp = new Date().toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const entry = `[${stamp} — ${ctx.admin.displayName}] ${input.note}`;
      const adminNotes = appt.adminNotes ? `${appt.adminNotes}\n${entry}` : entry;
      await db.update(appointments).set({ adminNotes }).where(eq(appointments.id, appt.id));

      if (appt.leadId) {
        await addLeadActivity(appt.leadId, "appointment", `Meeting notes added to ${appt.appointmentRef}`, {
          notes: input.note,
          adminId: ctx.admin.id,
          adminName: ctx.admin.displayName,
        });
      }
      await logAudit(ctx.admin.id, ctx.admin.displayName, "appointment_notes_added", `${appt.appointmentRef} — notes added`, ctx.req.headers);
      return { success: true };
    }),

  createForLead: apptQuery()
    .input(
      z.object({
        leadId: z.number(),
        type: z.enum(Object.keys(APPOINTMENT_TYPES) as [string, ...string[]]),
        date: z.string().regex(dateRe),
        time: z.string().regex(timeRe),
        duration: z.number().int().min(15).max(480).optional(),
        location: z.string().max(255).optional(),
        meetingLink: z.string().max(500).optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const lead = (await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1))[0];
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });

      const preferredAt = combineDateTime(input.date, input.time);
      const ref = appointmentRefFor();
      await db.insert(appointments).values({
        appointmentRef: ref,
        investorId: lead.investorId,
        leadId: lead.id,
        customerName: lead.fullName,
        email: lead.email,
        phone: lead.phone ?? "—",
        type: input.type as never,
        propertyName: lead.interestedProperty,
        preferredAt,
        durationMinutes: input.duration ?? (APPOINTMENT_TYPES as Record<string, { defaultDuration: number }>)[input.type]?.defaultDuration ?? 60,
        location: input.location || null,
        meetingLink: input.meetingLink || null,
        notes: input.notes || null,
        status: "pending",
      });

      await addLeadActivity(lead.id, "appointment", `Appointment created by ${ctx.admin.displayName}: ${appointmentTypeLabel(input.type)} — ${fmtWhen(preferredAt)}`, {
        notes: input.notes || null,
        adminId: ctx.admin.id,
        adminName: ctx.admin.displayName,
      });
      await logAudit(ctx.admin.id, ctx.admin.displayName, "appointment_created_for_lead", `${ref} — ${lead.fullName}, ${appointmentTypeLabel(input.type)} on ${fmtWhen(preferredAt)}`, ctx.req.headers);
      return { success: true, reference: ref };
    }),

  exportCsv: apptQuery()
    .input(
      z
        .object({
          status: z.string().optional(),
          type: z.string().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
        })
        .optional(),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      let rows = await db.select().from(appointments).orderBy(desc(appointments.preferredAt));
      if (input?.status) rows = rows.filter((a) => a.status === input.status);
      if (input?.type) rows = rows.filter((a) => a.type === input.type);
      if (input?.dateFrom) rows = rows.filter((a) => new Date(a.preferredAt) >= new Date(`${input.dateFrom}T00:00:00`));
      if (input?.dateTo) rows = rows.filter((a) => new Date(a.preferredAt) <= new Date(`${input.dateTo}T23:59:59`));

      const header = ["Reference", "Customer", "Email", "Phone", "Type", "Property", "Date", "Time", "Duration (min)", "Status", "Assigned To", "Location", "Meeting Link", "Notes", "Created"];
      const lines = rows.map((a: Appointment) => {
        const d = new Date(a.preferredAt);
        return [
          a.appointmentRef,
          a.customerName,
          a.email,
          a.phone,
          appointmentTypeLabel(a.type),
          a.propertyName ?? "",
          d.toLocaleDateString("en-US"),
          d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          a.durationMinutes,
          a.status.replace(/_/g, " "),
          a.assignedAdminName ?? "",
          a.location ?? "",
          a.meetingLink ?? "",
          a.notes ?? "",
          new Date(a.createdAt).toLocaleString("en-US"),
        ].map(csvEscape).join(",");
      });
      const csv = [header.join(","), ...lines].join("\n");
      await logAudit(ctx.admin.id, ctx.admin.displayName, "appointments_exported", `Exported ${rows.length} appointment(s) to CSV`, ctx.req.headers);
      return { csv, filename: `appointments-${new Date().toISOString().slice(0, 10)}.csv`, count: rows.length };
    }),
});
