import type { NextRequest } from "next/server";

/**
 * Hosts allowed to call our /api/* routes directly.
 * Add any additional preview/staging domains here if needed.
 */
const ALLOWED_HOSTS = new Set([
  "flight.gukgukcraft.id",
  "flight.co.id",
  ...(process.env.NODE_ENV !== "production" ? ["localhost:3000"] : []),
]);

/**
 * Checks that a request's Origin (preferred) or Referer header matches an
 * allowed host. This is NOT a strong security boundary on its own — these
 * headers are trivial to spoof from curl/Python — but it blocks:
 *   - other websites' client-side JS from calling our API (real browsers
 *     send accurate Origin headers, and this can't be spoofed from a
 *     <script> running on another origin)
 *   - the most casual/lazy scrapers that don't bother setting headers
 *
 * Combine with rate limiting (middleware.ts) and optionally a signed
 * session token (lib/apiToken.ts) for real protection.
 */
export function isSameOriginRequest(req: NextRequest): boolean {
  const candidate = req.headers.get("origin") ?? req.headers.get("referer");
  if (!candidate) return false;

  try {
    return ALLOWED_HOSTS.has(new URL(candidate).host);
  } catch {
    return false;
  }
}