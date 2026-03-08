/**
 * Pure helper functions used by the proxy (middleware).
 * Extracted for testability — no side effects, no external deps besides routing config.
 */

import type { AccountType } from "@/lib/auth/active-account-cookie";

// Pages accessible without being authenticated (after locale prefix)
export const PUBLIC_AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

// Paths that require a session but NOT an active account cookie
export const ACCOUNT_OPTIONAL_PATHS = [
  "/select-account",
  "/no-account",
  "/onboarding",
  "/accounts",
];

// API routes that don't require session-based authentication
// v1 API routes use Bearer token auth (handled by api-auth.ts), not proxy session
export const UNPROTECTED_API_PATHS = ["/api/auth", "/api/webhooks", "/api/debug", "/api/v1"];

// Map path prefixes to the account type that can access them
export const EXHIBITOR_PATHS = [
  "/catalog",
  "/cart",
  "/orders",
  "/requests",
  "/accept-invitation",
  "/home",
];
export const RIGHTS_HOLDER_PATHS = ["/films", "/validation-requests", "/wallet"];
export const ADMIN_PATHS = [
  "/dashboard",
  "/exhibitors",
  "/rights-holders",
  "/deliveries",
  "/settings",
  "/logs",
];

const SUPPORTED_LOCALES = ["en", "fr"];
const DEFAULT_LOCALE = "en";

export function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(en|fr)/, "");
}

export function extractLocale(pathname: string): string {
  const segments = pathname.split("/");
  const candidate = segments[1];
  return candidate && SUPPORTED_LOCALES.includes(candidate) ? candidate : DEFAULT_LOCALE;
}

export function isPublicAuthPath(pathname: string): boolean {
  const stripped = stripLocale(pathname);
  return stripped === "/" || PUBLIC_AUTH_PATHS.some((p) => stripped.startsWith(p));
}

export function isAccountOptionalPath(pathname: string): boolean {
  const stripped = stripLocale(pathname);
  // Root locale page (e.g. /en, /fr) is the account resolution entry point
  if (stripped === "" || stripped === "/") return true;
  return ACCOUNT_OPTIONAL_PATHS.some((p) => stripped === p || stripped.startsWith(p + "/"));
}

export function isUnprotectedApiPath(pathname: string): boolean {
  return UNPROTECTED_API_PATHS.some((p) => pathname.startsWith(p));
}

export function getRequiredAccountType(pathname: string): AccountType | null {
  const stripped = stripLocale(pathname);
  for (const prefix of EXHIBITOR_PATHS) {
    if (stripped === prefix || stripped.startsWith(prefix + "/")) return "exhibitor";
  }
  for (const prefix of RIGHTS_HOLDER_PATHS) {
    if (stripped === prefix || stripped.startsWith(prefix + "/")) return "rights_holder";
  }
  for (const prefix of ADMIN_PATHS) {
    if (stripped === prefix || stripped.startsWith(prefix + "/")) return "admin";
  }
  return null; // Shared path (e.g. /account, /profile)
}
