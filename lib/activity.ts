import { getDb } from "../queries/connection";
import { investorActivityLogs, auditLogs, adminNotifications } from "@db/schema";

/** Accepts a transaction handle so logs commit/rollback with the operation. */
type DbLike = { insert: ReturnType<typeof getDb>["insert"] };

function ipFromHeaders(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null
  );
}

export async function logInvestorActivity(
  investorId: number,
  action: string,
  details: string | null,
  headers?: Headers,
  db?: DbLike,
) {
  try {
    await (db ?? getDb()).insert(investorActivityLogs).values({
      investorId,
      action,
      details,
      ipAddress: headers ? ipFromHeaders(headers) : null,
      userAgent: headers ? headers.get("user-agent") : null,
    });
  } catch (err) {
    console.error("activity log failed:", err);
  }
}

export async function logAudit(
  adminId: number | null,
  adminName: string,
  action: string,
  details: string | null,
  headers?: Headers,
  db?: DbLike,
) {
  try {
    await (db ?? getDb()).insert(auditLogs).values({
      adminId,
      adminName,
      action,
      details,
      ipAddress: headers ? ipFromHeaders(headers) : null,
      userAgent: headers ? headers.get("user-agent") : null,
    });
  } catch (err) {
    console.error("audit log failed:", err);
  }
}

export async function notifyAdmin(
  title: string,
  message: string,
  type: "investment" | "deposit" | "withdrawal" | "roi" | "order" | "security" | "system" = "system",
  db?: DbLike,
  adminId?: number | null,
) {
  try {
    await (db ?? getDb()).insert(adminNotifications).values({ title, message, type, adminId: adminId ?? null });
  } catch (err) {
    console.error("admin notification failed:", err);
  }
}
