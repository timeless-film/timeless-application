/**
 * Shared constants and pure functions for the active account cookie.
 * This file is edge-safe — no Node.js or Next.js imports.
 */

export const ACTIVE_ACCOUNT_COOKIE = "active_account_id";

export type AccountType = "exhibitor" | "rights_holder" | "admin";

export interface ActiveAccountCookie {
  accountId: string;
  type: AccountType;
}

const VALID_TYPES: AccountType[] = ["exhibitor", "rights_holder", "admin"];

/**
 * Parse the active account cookie value.
 * Format: `accountId:type` (e.g. `a1b2-...:exhibitor`)
 */
export function parseActiveAccountCookie(value: string): ActiveAccountCookie | null {
  const separatorIndex = value.lastIndexOf(":");
  if (separatorIndex === -1) return null;

  const accountId = value.substring(0, separatorIndex);
  const type = value.substring(separatorIndex + 1);

  if (!accountId || !VALID_TYPES.includes(type as AccountType)) return null;

  return { accountId, type: type as AccountType };
}

/**
 * Encode account ID and type into the cookie value format.
 */
export function encodeActiveAccountCookie(accountId: string, type: AccountType): string {
  return `${accountId}:${type}`;
}

/**
 * Get the home path for a given account type.
 */
export function getHomePathForType(type: AccountType): string {
  switch (type) {
    case "exhibitor":
      return "/catalog";
    case "rights_holder":
      return "/home";
    case "admin":
      return "/dashboard";
  }
}
