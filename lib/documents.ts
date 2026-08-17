import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { getDb } from "../queries/connection";
import { documents, investors, type Document } from "@db/schema";
import { and, eq } from "drizzle-orm";
import { logAudit, notifyAdmin } from "./activity";
import { Company } from "./email";
import { notifyUser } from "./notify";

const NAVY: [number, number, number] = [30, 58, 95];
const COPPER: [number, number, number] = [200, 149, 108];
const GRAY: [number, number, number] = [110, 110, 110];

/** Format money values for PDF documents. */
export function pdfMoney(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!isFinite(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface ReceiptLine {
  label: string;
  value: string;
}

export interface DocGenInput {
  investorId?: number | null;
  ownerEmail?: string | null;
  ownerName: string;
  category: Document["category"];
  docType: string;
  name?: string;
  amount?: number | string | null;
  reference?: string | null;
  propertyName?: string | null;
  links?: {
    orderId?: number | null;
    mortgageId?: number | null;
    investmentId?: number | null;
    depositId?: number | null;
    withdrawalId?: number | null;
  };
  lines: ReceiptLine[];
  note?: string;
  status?: Document["status"];
  /** Set false to skip the in-app + email notification (default true). */
  notify?: boolean;
}

function docRefFor(docType: string): string {
  const initials = docType
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4)
    .padEnd(2, "X");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FH-${initials}-${rand}`;
}

async function buildPdf(input: DocGenInput, docRef: string, createdAt: Date): Promise<string> {
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

  // Document type, right-aligned
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(input.docType.toUpperCase(), W - 14, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COPPER);
  doc.text(`Receipt No: ${docRef}`, W - 14, 24, { align: "right" });

  let y = 46;

  // ── Company contact + prepared-for block ──
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`${Company.email}  ·  ${Company.phone}  ·  ${Company.hours}`, 14, y);

  y += 8;
  const dateStr = createdAt.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.setFontSize(9.5);
  doc.text("PREPARED FOR", 14, y);
  doc.text("DOCUMENT DETAILS", 120, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text(input.ownerName, 14, y + 6);
  if (input.ownerEmail) doc.text(input.ownerEmail, 14, y + 11.5);

  doc.setFontSize(9);
  const meta: [string, string][] = [
    ["Date", dateStr],
    ["Time", `${timeStr} (PT)`],
  ];
  if (input.reference) meta.unshift(["Reference", input.reference]);
  if (input.propertyName) meta.push(["Property", input.propertyName]);
  meta.forEach(([k, v], i) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(`${k}:`, 120, y + 6 + i * 5.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.text(v, 145, y + 6 + i * 5.5);
  });

  y += 22 + Math.max(0, meta.length - 2) * 5.5;

  // ── Detail table ──
  autoTable(doc, {
    startY: y,
    head: [["Description", "Details"]],
    body: input.lines.map((l) => [l.label, l.value]),
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9.5, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [250, 248, 245] },
    columnStyles: { 0: { cellWidth: 70, fontStyle: "bold", textColor: NAVY } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── Amount box ──
  if (input.amount != null) {
    doc.setFillColor(...NAVY);
    doc.roundedRect(W - 14 - 78, y, 78, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(pdfMoney(input.amount), W - 14 - 39, y + 10, { align: "center" });
    doc.setFontSize(7.5);
    doc.setTextColor(...COPPER);
    doc.text("AMOUNT", W - 14 - 39, y + 4.5, { align: "center" });
    y += 22;
  }

  // ── Note ──
  if (input.note) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    const wrapped = doc.splitTextToSize(input.note, W - 28);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 4.5 + 4;
  }

  // ── QR + signature ──
  y = Math.max(y + 10, 245);
  try {
    const qr = await QRCode.toDataURL(`${docRef}|${input.reference ?? ""}`, { width: 120, margin: 0 });
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
  doc.setTextColor(...GRAY);
  doc.text(
    "This document was generated electronically by Nestaro Homes LLC and is valid without a physical signature.",
    W / 2,
    288,
    { align: "center" }
  );
  doc.text(`${docRef}  ·  ${Company.email}  ·  Portland, Oregon, USA`, W / 2, 293, { align: "center" });

  return doc.output("datauristring");
}

/**
 * Generate a branded PDF, store it in the document vault, notify the
 * investor, and audit-log the event. Never throws — failures are
 * reported to the admin and return null so transactions never break.
 */
export async function generatePdfDocument(input: DocGenInput): Promise<number | null> {
  try {
    const db = getDb();
    const docRef = docRefFor(input.docType);
    const now = new Date();

    // Resolve the owning investor when only an email is known
    let investorId = input.investorId ?? null;
    if (!investorId && input.ownerEmail) {
      const rows = await db.select().from(investors).where(eq(investors.email, input.ownerEmail)).limit(1);
      investorId = rows[0]?.id ?? null;
    }

    // Duplicate guard: the same document (type + reference) is never generated twice
    if (input.reference) {
      const existing = await db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.docType, input.docType), eq(documents.reference, input.reference)))
        .limit(1);
      if (existing.length) return existing[0].id;
    }

    const dataUrl = await buildPdf(input, docRef, now);
    const name = input.name || `${input.docType} — ${input.reference ?? docRef}`;

    const [row] = await db
      .insert(documents)
      .values({
        docRef,
        investorId,
        ownerEmail: input.ownerEmail ?? null,
        ownerName: input.ownerName,
        category: input.category,
        docType: input.docType,
        name,
        status: input.status ?? "generated",
        orderId: input.links?.orderId ?? null,
        mortgageId: input.links?.mortgageId ?? null,
        investmentId: input.links?.investmentId ?? null,
        depositId: input.links?.depositId ?? null,
        withdrawalId: input.links?.withdrawalId ?? null,
        reference: input.reference ?? null,
        propertyName: input.propertyName ?? null,
        dataUrl,
        fileSize: Math.round(dataUrl.length * 0.75),
        version: 1,
        uploadedByName: "System",
        source: "generated",
      })
      .$returningId();

    if (investorId && input.notify !== false) {
      // Centralized notification: in-app record + branded email, deep-linked to this document
      await notifyUser(investorId, {
        type: "document_generated",
        category: "documents",
        title: "New Document Available",
        message: `A new document "${name}" has been generated and is ready for download in your Document Center.`,
        link: `/invest/dashboard?tab=documents&doc=${docRef}`,
        relatedRef: input.reference ?? docRef,
        ctaLabel: "View Document",
        emailDetails: [
          { label: "Document", value: name },
          { label: "Type", value: input.docType },
        ],
      });
    }

    await logAudit(null, "System", "document_generated", `Generated ${input.docType} (${docRef}) for ${input.ownerName}${input.ownerEmail ? ` (${input.ownerEmail})` : ""}`);
    return row.id;
  } catch (err) {
    console.error("document generation failed:", err);
    await notifyAdmin(
      "Document Generation Failed",
      `Failed to generate ${input.docType} for ${input.ownerName}: ${err instanceof Error ? err.message : String(err)}`,
      "system"
    ).catch(() => undefined);
    return null;
  }
}
