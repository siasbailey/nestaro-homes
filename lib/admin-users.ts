import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { adminUsers, investors } from "@db/schema";
import { getDb } from "../queries/connection";
import { env } from "./env";

export const PRIMARY_ADMIN_EMAIL = "admin@flexhavens.local";

/**
 * Bootstrap the Primary Administrator on first use. The initial credentials
 * are the existing unified admin password (env.adminPassword) with the email
 * admin@flexhavens.local, so the current login keeps working.
 */
export async function ensurePrimaryAdmin() {
  const db = getDb();
  const existing = await db.select().from(adminUsers).limit(1);
  if (existing.length > 0) return null;

  const passwordHash = await bcrypt.hash(env.adminPassword, 12);
  const [row] = await db
    .insert(adminUsers)
    .values({
      firstName: "Primary",
      lastName: "Administrator",
      displayName: "Primary Administrator",
      email: PRIMARY_ADMIN_EMAIL,
      passwordHash,
      role: "primary",
      permissions: null,
      status: "active",
    })
    .$returningId();
  const created = await db.select().from(adminUsers).where(eq(adminUsers.id, row.id)).limit(1);
  return created[0] ?? null;
}

/**
 * The shadow investor account that backs investment-platform admin APIs
 * (audit attribution, notifications). Created on demand.
 */
export async function ensureShadowInvestor() {
  const db = getDb();
  let rows = await db.select().from(investors).where(eq(investors.email, PRIMARY_ADMIN_EMAIL)).limit(1);
  if (!rows.length) {
    const passwordHash = await bcrypt.hash(env.adminPassword + ":internal", 12);
    await db.insert(investors).values({
      name: "Administrator",
      email: PRIMARY_ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      emailVerified: "yes",
      kycStatus: "verified",
      referralCode: "ADMIN001",
    });
    rows = await db.select().from(investors).where(eq(investors.email, PRIMARY_ADMIN_EMAIL)).limit(1);
  } else if (rows[0].role !== "admin") {
    await db.update(investors).set({ role: "admin" }).where(eq(investors.id, rows[0].id));
  }
  return rows[0];
}
