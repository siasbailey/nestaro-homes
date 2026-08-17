import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { crmStages, leadActivities, leads, type Lead } from "@db/schema";
import { FIRST_STAGE_KEY, leadSourceLabel, type LeadSourceKey } from "@contracts/crm";
import { notifyAdmin } from "./activity";

type DbLike = ReturnType<typeof getDb>;

export function leadRefFor(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `LD-${rand}`;
}

export async function addLeadActivity(
  leadId: number,
  type: string,
  description: string,
  opts: { notes?: string | null; adminId?: number | null; adminName?: string | null; db?: DbLike } = {},
) {
  try {
    await (opts.db ?? getDb()).insert(leadActivities).values({
      leadId,
      type,
      description: description.slice(0, 500),
      notes: opts.notes ?? null,
      adminId: opts.adminId ?? null,
      adminName: opts.adminName ?? null,
    });
  } catch (err) {
    console.error("lead activity failed:", err);
  }
}

async function stageKind(db: DbLike, stageKey: string): Promise<"open" | "won" | "lost"> {
  const rows = await db.select().from(crmStages).where(eq(crmStages.stageKey, stageKey)).limit(1);
  return rows[0]?.kind ?? "open";
}

export interface CaptureLeadInput {
  name: string;
  email: string;
  phone?: string | null;
  source: LeadSourceKey;
  interestedProperty?: string | null;
  investmentInterest?: string | null;
  mortgageInterest?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  notes?: string | null;
  notify?: boolean;
}

/**
 * Upsert a lead by email. Creates a new lead at the first pipeline stage when
 * the address is unknown; otherwise enriches the existing profile and logs the
 * renewed interest. Never throws — CRM capture must never break a user flow.
 */
export async function captureLead(input: CaptureLeadInput, db?: DbLike): Promise<number | null> {
  try {
    const d = db ?? getDb();
    const email = input.email.toLowerCase().trim();
    const name = input.name.trim();
    const now = new Date();

    const existing = await d.select().from(leads).where(eq(leads.email, email)).limit(1);
    const lead = existing[0];

    if (lead) {
      // Enrich blank fields only — never overwrite what the team already captured
      const patch: Partial<typeof leads.$inferInsert> = { lastContactAt: now };
      if (!lead.phone && input.phone) patch.phone = input.phone;
      if (!lead.country && input.country) patch.country = input.country;
      if (!lead.state && input.state) patch.state = input.state;
      if (!lead.city && input.city) patch.city = input.city;
      if (!lead.interestedProperty && input.interestedProperty) patch.interestedProperty = input.interestedProperty;
      if (!lead.investmentInterest && input.investmentInterest) patch.investmentInterest = input.investmentInterest;
      if (!lead.mortgageInterest && input.mortgageInterest) patch.mortgageInterest = input.mortgageInterest;
      await d.update(leads).set(patch).where(eq(leads.id, lead.id));
      await addLeadActivity(lead.id, "system", `New ${leadSourceLabel(input.source)} received`, {
        notes: input.notes ?? null,
        db: d,
      });
      return lead.id;
    }

    const [row] = await d
      .insert(leads)
      .values({
        leadRef: leadRefFor(),
        fullName: name,
        email,
        phone: input.phone ?? null,
        country: input.country ?? null,
        state: input.state ?? null,
        city: input.city ?? null,
        source: input.source,
        stage: FIRST_STAGE_KEY,
        interestedProperty: input.interestedProperty ?? null,
        investmentInterest: input.investmentInterest ?? null,
        mortgageInterest: input.mortgageInterest ?? null,
        notes: input.notes ?? null,
        lastContactAt: now,
      })
      .$returningId();

    await addLeadActivity(row.id, "created", `Lead captured via ${leadSourceLabel(input.source)}`, {
      notes: input.notes ?? null,
      adminName: "System",
      db: d,
    });

    if (input.notify !== false) {
      await notifyAdmin(
        "New Lead Captured",
        `${name} (${email}) — ${leadSourceLabel(input.source)}${input.interestedProperty ? ` · Interested in: ${input.interestedProperty}` : ""}`,
        "system",
        d,
      );
    }
    return row.id;
  } catch (err) {
    console.error("lead capture failed:", err);
    return null;
  }
}

/** Link a lead to a registered investor account (conversion signal). */
export async function linkLeadToInvestor(email: string, investorId: number, investorName: string): Promise<void> {
  try {
    const db = getDb();
    const rows = await db.select().from(leads).where(eq(leads.email, email.toLowerCase().trim())).limit(1);
    const lead = rows[0];
    if (!lead) return;
    if (!lead.investorId) {
      await db.update(leads).set({ investorId }).where(eq(leads.id, lead.id));
      await addLeadActivity(lead.id, "registered", `${investorName} registered a Nestaro Homes account`, {
        adminName: "System",
      });
    }
  } catch (err) {
    console.error("lead link failed:", err);
  }
}

export interface LeadEventInput {
  email: string;
  type: "mortgage_applied" | "investment_started" | "property_reserved" | "property_purchased" | "investment_completed" | "deal_closed";
  description: string;
  /** Move the lead to this stage unless it is already in a terminal stage. */
  stage?: string;
  notes?: string | null;
}

/** Record a conversion event on the lead timeline and advance the pipeline. */
export async function leadEvent(input: LeadEventInput): Promise<void> {
  try {
    const db = getDb();
    const rows = await db.select().from(leads).where(eq(leads.email, input.email.toLowerCase().trim())).limit(1);
    const lead: Lead | undefined = rows[0];
    if (!lead) return;

    const patch: Partial<typeof leads.$inferInsert> = { lastContactAt: new Date() };
    if (input.stage) {
      const kind = await stageKind(db, lead.stage);
      if (kind === "open" && lead.stage !== input.stage) {
        patch.stage = input.stage;
      }
    }
    await db.update(leads).set(patch).where(eq(leads.id, lead.id));
    await addLeadActivity(lead.id, input.type, input.description, {
      notes: input.notes ?? null,
      adminName: "System",
    });
  } catch (err) {
    console.error("lead event failed:", err);
  }
}

/** All stages ordered for pipeline/board rendering. */
export async function listStages(db?: DbLike) {
  const d = db ?? getDb();
  const rows = await d.select().from(crmStages);
  return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}
