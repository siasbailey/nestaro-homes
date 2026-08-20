import type { CookieOptions } from "hono/utils/cookie";

function isLocalhost(headers: Headers): boolean {
  const host = headers.get("host") || "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

export function getSessionCookieOptions(headers: Headers): CookieOptions {
  const localhost = isLocalhost(headers);
  const proto = headers.get("x-forwarded-proto");
  const isHttps = proto === "https" || !localhost;

  return {
    httpOnly: true,
    path: "/",
    sameSite: "Lax", // Same-site requests on www.nestarohomes.com should use Lax
    secure: isHttps,
  };
}