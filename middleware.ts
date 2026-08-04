import { NextResponse, type NextRequest } from "next/server";
import { signToken, verifyToken, COOKIE_NAME } from "@/lib/apiToken";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- 1. API routes: verify session token ---
  if (pathname.startsWith("/api/")) {
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