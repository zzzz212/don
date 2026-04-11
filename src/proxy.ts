import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/analyze", "/chat", "/templates", "/report"];
const authRoutes = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for session token (NextAuth v5 stores it in this cookie)
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  const isAuthenticated = !!token;

  // Redirect authenticated users away from login/register
  if (isAuthenticated && authRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users to login
  if (
    !isAuthenticated &&
    protectedRoutes.some((r) => pathname.startsWith(r))
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/analyze/:path*",
    "/chat/:path*",
    "/templates/:path*",
    "/report/:path*",
    "/login",
    "/register",
  ],
};
