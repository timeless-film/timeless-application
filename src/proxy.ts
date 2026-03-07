import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";
import {
  ACTIVE_ACCOUNT_COOKIE,
  getHomePathForType,
  parseActiveAccountCookie,
} from "@/lib/auth/active-account-cookie";
import {
  extractLocale,
  getRequiredAccountType,
  isAccountOptionalPath,
  isPublicAuthPath,
  isUnprotectedApiPath,
} from "@/lib/auth/proxy-helpers";

const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
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
    const locale = extractLocale(pathname);
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Account-optional paths (select-account, no-account, onboarding) — allow through
  if (isAccountOptionalPath(pathname)) {
    return intlResponse;
  }

  // --- Active account guard ---
  const activeAccountCookie = request.cookies.get(ACTIVE_ACCOUNT_COOKIE);

  // No cookie → redirect to root (which handles account resolution)
  if (!activeAccountCookie?.value) {
    const locale = extractLocale(pathname);
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  const parsed = parseActiveAccountCookie(activeAccountCookie.value);

  // Invalid cookie format → clear and redirect to root
  if (!parsed) {
    const locale = extractLocale(pathname);
    const response = NextResponse.redirect(new URL(`/${locale}`, request.url));
    response.cookies.delete(ACTIVE_ACCOUNT_COOKIE);
    return response;
  }

  // Check path compatibility with account type
  const requiredType = getRequiredAccountType(pathname);
  if (requiredType && requiredType !== parsed.type) {
    // Mismatch → redirect to the correct home for their account type
    const locale = extractLocale(pathname);
    const redirectPath = getHomePathForType(parsed.type);
    return NextResponse.redirect(new URL(`/${locale}${redirectPath}`, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
