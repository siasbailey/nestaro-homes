import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { appointments, leadFollowUps, leads } from "@db/schema";
import { appointmentTypeLabel } from "@contracts/crm";
import { addLeadActivity } from "./crm";
import { fmtWhen, notifyCustomer } from "./appointments";
import { notifyAdmin } from "./activity";

/**
 * CRM automation sweep, every 5 minutes:
 *  - 24h and 1h appointment reminders (customer + assigned admin)
 *  - follow-up due reminders (assigned admin)
 */
async function sweep() {
  const db = getDb();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60_000);
  const in75m = new Date(now.getTime() + 75 * 60_000);

  // ── 24h appointment reminders ──
  const due24 = await db
    .select()
    .from(appointments)
    .where(
      and(
        inArray(appointments.status, ["confirmed", "rescheduled"]),
        gt(appointments.preferredAt, now),
        lte(appointments.preferredAt, in24h),
        isNull(appointments.reminder24hAt),
      ),
    );
  for (const a of due24) {
    const when = fmtWhen(new Date(a.preferredAt));
    await notifyCustomer(a, "Appointment Reminder (24 hours)", `This is a reminder of your ${appointmentTypeLabel(a.type)} tomorrow — ${when}${a.location ? ` at ${a.location}` : ""}${a.meetingLink ? `. Meeting link: ${a.meetingLink}` : ""}.`);
    if (a.assignedAdminId) {
      await notifyAdmin("Appointment Reminder (24h)", `${appointmentTypeLabel(a.type)} (${a.appointmentRef}) with ${a.customerName} is scheduled for ${when}.`, "system", undefined, a.assignedAdminId);
    }
    await db.update(appointments).set({ reminder24hAt: now }).where(eq(appointments.id, a.id));
  }

  // ── 1h appointment reminders ──
  const due1 = await db
    .select()
    .from(appointments)
    .where(
      and(
        inArray(appointments.status, ["confirmed", "rescheduled"]),
        gt(appointments.preferredAt, now),
        lte(appointments.preferredAt, in75m),
        isNull(appointments.reminder1hAt),
      ),
    );
  for (const a of due1) {
    const when = fmtWhen(new Date(a.preferredAt));
    await notifyCustomer(a, "Appointment Reminder (1 hour)", `Your ${appointmentTypeLabel(a.type)} starts soon — ${when}${a.location ? ` at ${a.location}` : ""}${a.meetingLink ? `. Meeting link: ${a.meetingLink}` : ""}.`);
    if (a.assignedAdminId) {
      await notifyAdmin("Appointment Starting Soon", `${appointmentTypeLabel(a.type)} (${a.appointmentRef}) with ${a.customerName} starts at ${when}.`, "system", undefined, a.assignedAdminId);
    }
    await db.update(appointments).set({ reminder1hAt: now }).where(eq(appointments.id, a.id));
  }

  // ── Follow-up due reminders ──
  const followUps = await db
    .select()
    .from(leadFollowUps)
    .where(
      and(
        eq(leadFollowUps.status, "pending"),
        lte(leadFollowUps.dueAt, in75m),
        isNull(leadFollowUps.reminderSentAt),
      ),
    );
  for (const f of followUps) {
    const lead = (await db.select().from(leads).where(eq(leads.id, f.leadId)).limit(1))[0];
    const leadName = lead ? `${lead.fullName} (${lead.leadRef})` : `Lead #${f.leadId}`;
    await notifyAdmin(
      "Follow-up Due",
      `"${f.title}" for ${leadName} is due ${fmtWhen(new Date(f.dueAt))}. Priority: ${f.priority}.`,
      "system",
      undefined,
      f.assignedAdminId ?? null,
    );
    await db.update(leadFollowUps).set({ reminderSentAt: now }).where(eq(leadFollowUps.id, f.id));
  }
}

export function startCrmScheduler() {
  const tick = async () => {
    try {
      await sweep();
    } catch (err) {
      console.error("CRM scheduler sweep failed:", err);
    }
  };
  // First sweep shortly after boot, then every 5 minutes
  setTimeout(tick, 20_000).unref?.();
  setInterval(tick, 5 * 60_000).unref?.();
  console.log("CRM reminder scheduler started (5-minute sweep).");
}
