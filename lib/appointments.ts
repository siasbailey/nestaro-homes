import { and, eq, inArray, ne } from "drizzle-orm";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { getDb } from "../queries/connection";
import { appointments, investorNotifications, type Appointment } from "@db/schema";
import { appointmentTypeLabel } from "@contracts/crm";
import { sendEmail, Company, appBaseUrl } from "./email";
import { notifyUser } from "./notify";

type DbLike = ReturnType<typeof getDb>;

const NAVY: [number, number, number] = [30, 58, 95];
const COPPER: [number, number, number] = [200, 149, 108];
const GRAY: [number, number, number] = [110, 110, 110];

export function appointmentRefFor(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `APT-${rand}`;
}

/** Combine a YYYY-MM-DD date and HH:mm time into a server-local Date (PT). */
export function combineDateTime(date: string, time: string): Date {
  const d = new Date(`${date}T${time}:00`);
  if (isNaN(d.getTime())) throw new Error("Invalid date or time");
  return d;
}

/**
 * Double-booking guard: true when the admin already has a confirmed or
 * rescheduled appointment overlapping [start, start + duration).
 */
export async function adminHasConflict(
  adminId: number,
  start: Date,
  durationMinutes: number,
  excludeId?: number,
  db?: DbLike,
): Promise<boolean> {
  const d = db ?? getDb();
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const rows = await d
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.assignedAdminId, adminId),
        inArray(appointments.status, ["confirmed", "rescheduled"]),
        excludeId ? ne(appointments.id, excludeId) : undefined,
      ),
    );
  return rows.some((a) => {
    const aStart = new Date(a.preferredAt);
    const aEnd = new Date(aStart.getTime() + (a.durationMinutes || 60) * 60_000);
    return aStart < end && start < aEnd;
  });
}

export function fmtWhen(d: Date): string {
  return `${d.toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} (PT)`;
}

/** Notify the customer in-app when registered, and by email otherwise. */
export async function notifyCustomer(
  appt: Pick<Appointment, "investorId" | "email" | "customerName" | "appointmentRef">,
  title: string,
  message: string,
  reqHeaders?: Headers,
): Promise<void> {
  try {
    const db = getDb();
    if (appt.investorId) {
      await db.insert(investorNotifications).values({
        investorId: appt.investorId,
        title,
        message,
        type: "info",
        category: "meetings",
        link: "/invest/dashboard?tab=appointments",
        relatedRef: appt.appointmentRef,
      });
      // Branded email alongside the in-app record (honours meeting-reminder preference)
      void notifyUser(appt.investorId, {
        type: "appointment_update",
        category: "meetings",
        title,
        message,
        link: "/invest/dashboard?tab=appointments",
        relatedRef: appt.appointmentRef,
        inApp: false,
        reqHeaders,
      });
    } else {
      const baseUrl = appBaseUrl(reqHeaders);
      await sendEmail({
        to: appt.email,
        subject: `${title} — ${Company.name}`,
        html: `
          <div style="font-family:Georgia,serif;background:#f7f4ee;padding:32px">
            <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee">
              <div style="background:#26342b;padding:20px 28px">
                <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:1px">NESTARO HOMES</span>
                <span style="color:#c47a45;font-size:11px;display:block;letter-spacing:2px;text-transform:uppercase">Real Estate Development Ltd</span>
              </div>
              <div style="padding:28px">
                <h2 style="color:#26342b;margin:0 0 12px">${title}</h2>
                <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 8px">Dear ${appt.customerName},</p>
                <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px">${message}</p>
                <p style="color:#888;font-size:12px">Reference: <strong>${appt.appointmentRef}</strong></p>
                <p style="color:#888;font-size:12px;margin-top:20px">${Company.name} · ${Company.email} · ${Company.phone}</p>
                <p style="color:#aaa;font-size:11px"><a href="${baseUrl}" style="color:#c47a45">${baseUrl}</a></p>
              </div>
            </div>
          </div>`,
        text: `${title}\n\nDear ${appt.customerName},\n\n${message}\n\nReference: ${appt.appointmentRef}\n\n${Company.name}`,
      });
    }
  } catch (err) {
    console.error("customer appointment notification failed:", err);
  }
}

/** Branded appointment confirmation PDF (generated on demand, not stored). */
export async function generateAppointmentConfirmationPdf(appt: Appointment): Promise<string> {
  const doc = new jsPDF();
  const W = 210;

  // ── Header band ──
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 36, "F");
  doc.setFillColor(...COPPER);
  doc.rect(0, 36, W, 1.6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("NESTARO HOMES", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COPPER);
  doc.text(Company.legalName, 14, 23);
  doc.setTextColor(230, 230, 230);
  doc.setFontSize(8);
  doc.text("Portland, Oregon 97209, United States", 14, 29.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("APPOINTMENT CONFIRMATION", W - 14, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COPPER);
  doc.text(`Ref: ${appt.appointmentRef}`, W - 14, 24, { align: "right" });

  let y = 46;
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`${Company.email}  ·  ${Company.phone}  ·  ${Company.hours}`, 14, y);

  y += 8;
  const when = new Date(appt.preferredAt);
  const dateStr = when.toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const timeStr = when.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.setFontSize(9.5);
  doc.text("CUSTOMER", 14, y);
  doc.text("APPOINTMENT DETAILS", 120, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text(appt.customerName, 14, y + 6);
  doc.setFontSize(9);
  doc.text(appt.email, 14, y + 11.5);
  if (appt.phone) doc.text(appt.phone, 14, y + 16.5);

  const meta: [string, string][] = [
    ["Reference", appt.appointmentRef],
    ["Status", appt.status.replace(/_/g, " ").toUpperCase()],
    ["Date", dateStr],
    ["Time", `${timeStr} (PT)`],
  ];
  meta.forEach(([k, v], i) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(`${k}:`, 120, y + 6 + i * 5.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.text(v, 145, y + 6 + i * 5.5);
  });

  y += 24 + (meta.length - 2) * 5.5;

  const lines: [string, string][] = [
    ["Appointment Type", appointmentTypeLabel(appt.type)],
    ["Duration", `${appt.durationMinutes} minutes`],
  ];
  if (appt.propertyName) lines.push(["Property", appt.propertyName]);
  if (appt.location) lines.push(["Meeting Location", appt.location]);
  if (appt.meetingLink) lines.push(["Meeting Link", appt.meetingLink]);
  if (appt.assignedAdminName) lines.push(["Your Consultant", appt.assignedAdminName]);

  autoTable(doc, {
    startY: y,
    head: [["Description", "Details"]],
    body: lines,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9.5, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [250, 248, 245] },
    columnStyles: { 0: { cellWidth: 70, fontStyle: "bold", textColor: NAVY } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  const noteLines = doc.splitTextToSize(
    "Please arrive 10 minutes before your scheduled time and present this confirmation (or the reference number) on arrival. To reschedule or cancel, contact our team at least 24 hours in advance.",
    W - 28,
  );
  doc.text(noteLines, 14, y);

  // ── QR + signature ──
  y = 245;
  try {
    const qr = await QRCode.toDataURL(`${appt.appointmentRef}|${appt.type}|${appt.preferredAt.toISOString()}`, { width: 120, margin: 0 });
    doc.addImage(qr, "PNG", 14, y, 24, 24);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text("Scan to verify", 14, y + 28);
  } catch {
    // QR is decorative — never block the document
  }

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(W - 80, y + 20, W - 14, y + 20);
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text("Authorized Signature", W - 80, y + 25);
  doc.text(Company.legalName, W - 80, y + 30);

  // ── Footer ──
  doc.setFillColor(250, 248, 245);
  doc.rect(0, 282, W, 15, "F");
  doc.setFontSize(7.5);
  doc.text(
    "This confirmation was generated electronically by Nestaro Homes LLC and is valid without a physical signature.",
    W / 2,
    288,
    { align: "center" },
  );
  doc.text(`${appt.appointmentRef}  ·  ${Company.email}  ·  Portland, Oregon, USA`, W / 2, 293, { align: "center" });

  return doc.output("datauristring");
}
