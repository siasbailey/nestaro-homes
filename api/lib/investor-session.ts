import * as jose from "jose";
import { env } from "./env";

const JWT_ALG = "HS256";

export type InvestorSessionPayload = {
  investorId: number;
  email: string;
};

function getSecret() {
  // Dedicated secret with a safe fallback derived from the app secret
  const secret = process.env.INVESTOR_JWT_SECRET || `${env.appSecret}:investor`;
  return new TextEncoder().encode(secret);
}

export async function signInvestorToken(
  payload: InvestorSessionPayload,
  expiresIn: string = "30d",
): Promise<string> {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyInvestorToken(
  token: string,
): Promise<InvestorSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, getSecret(), {
      algorithms: [JWT_ALG],
    });
    const { investorId, email } = payload;
    if (typeof investorId !== "number" || typeof email !== "string") {
      return null;
    }
    return { investorId, email };
  } catch {
    return null;
  }
}
