"use server";

import { eq, and } from "drizzle-orm";

import { generateToken } from "@/lib/auth/api-auth";
import { getCurrentMembership } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";

// ─── List API Tokens ──────────────────────────────────────────────────────────

export async function listApiTokens() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const tokens = await db.query.apiTokens.findMany({
    where: (t, { eq: eq2 }) => eq2(t.accountId, ctx.accountId),
    orderBy: (t, { desc }) => desc(t.createdAt),
  });

  return {
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      tokenPrefix: t.tokenPrefix,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
    })),
  };
}

// ─── Create API Token ─────────────────────────────────────────────────────────

export async function createApiToken(name: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { error: "INVALID_INPUT" as const };
  }

  const { rawToken, tokenHash, tokenPrefix } = generateToken();

  await db.insert(apiTokens).values({
    accountId: ctx.accountId,
    name: trimmedName,
    tokenHash,
    tokenPrefix,
  });

  return { success: true, rawToken };
}

// ─── Revoke API Token ─────────────────────────────────────────────────────────

export async function revokeApiToken(tokenId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const token = await db.query.apiTokens.findFirst({
    where: (t, { eq: eq2, and: and2 }) => and2(eq2(t.id, tokenId), eq2(t.accountId, ctx.accountId)),
  });

  if (!token) {
    return { error: "NOT_FOUND" as const };
  }

  await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.accountId, ctx.accountId)));

  return { success: true };
}
