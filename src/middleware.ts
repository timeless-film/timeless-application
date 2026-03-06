import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Pages accessible without being authenticated (after locale prefix)
const PUBLIC_AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

// API routes that don't require authentication
const UNPROTECTED_API_PATHS = ["/api/auth", "/api/webhooks"];

function isPublicAuthPath(pathname: string): boolean {
  const stripped = pathname.replace(/^\/(en|fr)/, "");
  return stripped === "/" || PUBLIC_AUTH_PATHS.some((p) => stripped.startsWith(p));
}

function isUnprotectedApiPath(pathname: string): boolean {
  return UNPROTECTED_API_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes — handle separately from intl middleware
  if (pathname.startsWith("/api/")) {
    if (isUnprotectedApiPath(pathname)) {
      return NextResponse.next();
    }
    const session = getSessionCookie(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Run next-intl middleware (locale detection + redirect for missing prefix)
  const intlResponse = intlMiddleware(request);

  // Skip auth check for public pages
  if (isPublicAuthPath(pathname)) {
    return intlResponse;
  }

  // Verify session for protected pages
  const session = getSessionCookie(request);
  if (!session) {
    const segments = pathname.split("/");
    const locale = routing.locales.includes(segments[1] as "en" | "fr")
      ? segments[1]
      : routing.defaultLocale;

    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
