import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import * as cookie from "cookie";
import { eq } from "drizzle-orm";
import type { User, Investor, AdminUser } from "@db/schema";
import { investors, adminUsers } from "@db/schema";
import { InvestorSession } from "@contracts/constants";
import { authenticateRequest } from "./kimi/auth";
import { verifyInvestorToken } from "./lib/investor-session";
import { adminTokenFromHeaders, verifyAdminToken, adminTokenStale } from "./lib/admin-session";
import { getDb } from "./queries/connection";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
  investor?: Investor;
  admin?: AdminUser;
};

async function resolveInvestor(headers: Headers): Promise<Investor | undefined> {
  const cookies = cookie.parse(headers.get("cookie") || "");
  const token = cookies[InvestorSession.cookieName];
  if (!token) return undefined;
  const claim = await verifyInvestorToken(token);
  if (!claim) return undefined;
  const rows = await getDb()
    .select()
    .from(investors)
    .where(eq(investors.id, claim.investorId))
    .limit(1);
  const investor = rows.at(0);
  // Deleted/suspended accounts lose access immediately
  if (!investor || investor.status !== "active") return undefined;
  return investor;
}

async function resolveAdmin(headers: Headers): Promise<AdminUser | undefined> {
  const token = adminTokenFromHeaders(headers);
  if (!token) return undefined;
  const claim = await verifyAdminToken(token);
  if (!claim) return undefined;
  const rows = await getDb()
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, claim.adminId))
    .limit(1);
  const admin = rows.at(0);
  if (!admin || admin.status !== "active") return undefined;
  // Tokens issued before a session-invalidation event are rejected
  if (adminTokenStale(admin, claim.iat)) return undefined;
  return admin;
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch {
    // Authentication is optional here
  }
  try {
    ctx.investor = await resolveInvestor(opts.req.headers);
  } catch {
    // Investor authentication is optional here
  }
  try {
    ctx.admin = await resolveAdmin(opts.req.headers);
  } catch {
    // Admin authentication is optional here
  }
  return ctx;
}
