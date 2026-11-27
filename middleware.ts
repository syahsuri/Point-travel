import { NextResponse, type NextRequest } from "next/server";
import { signToken, verifyToken, COOKIE_NAME } from "@/lib/apiToken";

const COOKIE_MAX_AGE = 21600;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  maxAge: COOKIE_MAX_AGE,
} as const;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- 1. API routes: verify session token ---
  if (pathname.startsWith("/api/")) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const res = NextResponse.next();
    // A polling tab never reloads the page, so renew the cookie here before
    // it expires. Token format is `<payload>.<exp>.<sig>` (lib/apiToken.ts).
    const exp = Number(token.split(".")[1]);
    if (exp - Date.now() / 1000 < COOKIE_MAX_AGE / 2) {
      res.cookies.set(COOKIE_NAME, await signToken(), COOKIE_OPTIONS);
    }
    return res;
  }

  // --- 2. Page routes: issue/refresh the session cookie ---
  const res = NextResponse.next();
  const existing = req.cookies.get(COOKIE_NAME)?.value;
  if (!existing || !(await verifyToken(existing))) {
    res.cookies.set(COOKIE_NAME, await signToken(), COOKIE_OPTIONS);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};