import * as jose from "jose";
import * as cookie from "cookie";
import { AdminSession, type AdminPermissionKey } from "@contracts/constants";
import type { AdminUser } from "@db/schema";
import { env } from "./env";

const JWT_ALG = "HS256";

export type AdminSessionPayload = {
  adminId: number;
  email: string;
  iat?: number;
};

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET || `${env.appSecret}:admin`;
  return new TextEncoder().encode(secret);
}

export async function signAdminToken(
  payload: AdminSessionPayload,
  expiresIn = "12h",
): Promise<string> {
  return new jose.SignJWT({ adminId: payload.adminId, email: payload.email })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, getSecret(), { algorithms: [JWT_ALG] });
    const { adminId, email, iat } = payload;
    if (typeof adminId !== "number" || typeof email !== "string") return null;
    return { adminId, email, iat: typeof iat === "number" ? iat : undefined };
  } catch {
    return null;
  }
}

export function adminTokenFromHeaders(headers: Headers): string | null {
  const cookies = cookie.parse(headers.get("cookie") || "");
  return cookies[AdminSession.cookieName] ?? null;
}

/** Parse the JSON permission array stored on an admin row. */
export function parsePermissions(admin: AdminUser): AdminPermissionKey[] {
  if (admin.role === "primary") return [] as AdminPermissionKey[]; // primary: unrestricted
  try {
    const parsed = JSON.parse(admin.permissions ?? "[]");
    return Array.isArray(parsed) ? (parsed as AdminPermissionKey[]) : [];
  } catch {
    return [];
  }
}

export function adminHasPermission(admin: AdminUser, key: AdminPermissionKey): boolean {
  if (admin.role === "primary") return true;
  return parsePermissions(admin).includes(key);
}

/** True when the token was issued before a session-invalidation event. */
export function adminTokenStale(admin: AdminUser, iat?: number): boolean {
  if (!admin.sessionsInvalidatedAt || !iat) return false;
  return new Date(admin.sessionsInvalidatedAt).getTime() > iat * 1000;
}
