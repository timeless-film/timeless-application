import { createHash, randomBytes } from "crypto";

import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { ACTIVE_ACCOUNT_COOKIE, parseActiveAccountCookie } from "@/lib/auth/active-account-cookie";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

const TOKEN_PREFIX = "tmls_";
const TOKEN_RANDOM_LENGTH = 40;
const DISPLAY_PREFIX_LENGTH = 13; // "tmls_" + 8 chars

interface VerifySuccess {
  success: true;
  accountId: string;
}

interface VerifyFailure {
  success: false;
}

type VerifyResult = VerifySuccess | VerifyFailure;

/**
 * Hash a raw API token using SHA-256.
 * The raw token is never stored — only the hash is persisted.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generate a new API token.
 * Format: tmls_ + 40 random hex characters.
 * Returns the raw token (shown once) and the hash (stored in DB).
 */
export function generateToken(): { rawToken: string; tokenHash: string; tokenPrefix: string } {
  const randomPart = randomBytes(TOKEN_RANDOM_LENGTH / 2).toString("hex");
  const rawToken = `${TOKEN_PREFIX}${randomPart}`;
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = rawToken.substring(0, DISPLAY_PREFIX_LENGTH);

  return { rawToken, tokenHash, tokenPrefix };
}

/**
 * Verify a Bearer token from the Authorization header.
 * Looks up the token hash in the database, updates lastUsedAt on success.
 */
export async function verifyBearerToken(request: NextRequest): Promise<VerifyResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { success: false };
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return { success: false };
  }

  const rawToken = parts[1];
  if (!rawToken || !rawToken.startsWith(TOKEN_PREFIX)) {
    return { success: false };
  }

  const tokenHash = hashToken(rawToken);

  const [token] = await db
    .select({ id: apiTokens.id, accountId: apiTokens.accountId })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1);

  if (!token) {
    return { success: false };
  }

  // Update lastUsedAt (fire & forget — don't block the response)
  db.update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, token.id))
    .then(() => {})
    .catch((error) => {
      console.error("Failed to update lastUsedAt for API token:", error);
    });

  return { success: true, accountId: token.accountId };
}

/**
 * Verify API authentication (Bearer token OR session cookie).
 * Tries Bearer token first (for external API clients), then session (for Next.js client-side).
 * Returns accountId if authenticated, or failure.
 */
export async function verifyApiAuth(request: NextRequest): Promise<VerifyResult> {
  // Try Bearer token first
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const bearerResult = await verifyBearerToken(request);
    if (bearerResult.success) {
      return bearerResult;
    }
  }

  // Try session cookie (Better Auth) + active account cookie
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return { success: false };
    }

    // Get active account ID from cookie
    const activeAccountCookie = request.cookies.get(ACTIVE_ACCOUNT_COOKIE);
    if (!activeAccountCookie?.value) {
      return { success: false };
    }

    const parsed = parseActiveAccountCookie(activeAccountCookie.value);
    if (!parsed) {
      return { success: false };
    }

    return { success: true, accountId: parsed.accountId };
  } catch (error) {
    console.error("Failed to verify session:", error);
    return { success: false };
  }
}
