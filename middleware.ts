import { NextResponse, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { signToken, verifyToken, COOKIE_NAME } from "@/lib/apiToken";

// Requires: npm install @upstash/ratelimit @upstash/redis
// And env vars UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "60 s"), // 30 requests/min per IP
  analytics: true,
  prefix: "flighttracker",
});

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- 1. API routes: verify session token + rate limit ---
  if (pathname.startsWith("/api/")) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const { success, limit, remaining, reset } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
          },
        }
      );
    }

    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!(await verifyToken(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
  }

  // --- 2. Page routes: issue/refresh the session cookie ---
  const res = NextResponse.next();
  const existing = req.cookies.get(COOKIE_NAME)?.value;
  if (!existing || !(await verifyToken(existing))) {
    res.cookies.set(COOKIE_NAME, await signToken(), {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 21600,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
