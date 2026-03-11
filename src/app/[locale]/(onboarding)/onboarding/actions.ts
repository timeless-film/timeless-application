"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

import { auth } from "@/lib/auth";
import { ACTIVE_ACCOUNT_COOKIE, encodeActiveAccountCookie } from "@/lib/auth/active-account-cookie";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { accountMembers, accounts } from "@/lib/db/schema";
import { createCinemaWithDefaultRoom } from "@/lib/services/cinema-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step1Input {
  companyName: string;
  country: string;
  address?: string;
  city?: string;
  postalCode?: string;
  vatNumber?: string;
  preferredCurrency?: string;
  contactEmail?: string;
  contactPhone?: string;
  cinemaType?: string;
}

interface CinemaInput {
  name: string;
  country: string;
  city: string;
  address?: string;
  postalCode?: string;
}

// ─── Step 1 — Company information ─────────────────────────────────────────────

export async function submitOnboardingStep1(input: Step1Input) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  if (
    !input.companyName.trim() ||
    !input.country.trim() ||
    !input.address?.trim() ||
    !input.city?.trim() ||
    !input.postalCode?.trim()
  ) {
    return { error: "INVALID_INPUT" as const };
  }

  // Find the membership for the active account (or first membership for new users)
  const activeCookie = await getActiveAccountCookie();
  const existingMembership = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2, and }) =>
      activeCookie
        ? and(eq2(am.userId, session.user.id), eq2(am.accountId, activeCookie.accountId))
        : eq2(am.userId, session.user.id),
    with: { account: true },
  });

  if (existingMembership) {
    // Update existing account instead of creating a new one
    const [updated] = await db
      .update(accounts)
      .set({
        companyName: input.companyName.trim(),
        country: input.country,
        address: input.address?.trim() || null,
        city: input.city?.trim() || null,
        postalCode: input.postalCode?.trim() || null,
        vatNumber: input.vatNumber?.trim() || null,
        preferredCurrency: input.preferredCurrency || "EUR",
        contactEmail: input.contactEmail?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        cinemaType: input.cinemaType as typeof accounts.$inferInsert.cinemaType,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, existingMembership.accountId))
      .returning();

    return { success: true as const, accountId: updated!.id };
  }

  // Create new account
  const [account] = await db
    .insert(accounts)
    .values({
      type: "exhibitor",
      companyName: input.companyName.trim(),
      country: input.country,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      vatNumber: input.vatNumber?.trim() || null,
      preferredCurrency: input.preferredCurrency || "EUR",
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      cinemaType: input.cinemaType as typeof accounts.$inferInsert.cinemaType,
    })
    .returning();

  if (!account) {
    return { error: "CREATION_FAILED" as const };
  }

  // Link user as owner
  await db.insert(accountMembers).values({
    accountId: account.id,
    userId: session.user.id,
    role: "owner",
  });

  // Set the active account cookie
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ACCOUNT_COOKIE, encodeActiveAccountCookie(account.id, "exhibitor"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return { success: true as const, accountId: account.id };
}

// ─── Step 2 — Add a cinema ────────────────────────────────────────────────────

export async function addOnboardingCinema(input: CinemaInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  if (!input.name.trim() || !input.country.trim() || !input.city.trim()) {
    return { error: "INVALID_INPUT" as const };
  }

  const activeCookie = await getActiveAccountCookie();
  const membership = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2, and }) =>
      activeCookie
        ? and(eq2(am.userId, session.user.id), eq2(am.accountId, activeCookie.accountId))
        : eq2(am.userId, session.user.id),
  });

  if (!membership) return { error: "NO_ACCOUNT" as const };

  const result = await createCinemaWithDefaultRoom(membership.accountId, {
    name: input.name,
    country: input.country,
    city: input.city,
    address: input.address,
    postalCode: input.postalCode,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const, cinema: result.cinema };
}

// ─── Step 3 — Complete onboarding ─────────────────────────────────────────────

export async function completeOnboarding() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const activeCookie = await getActiveAccountCookie();
  const membership = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2, and }) =>
      activeCookie
        ? and(eq2(am.userId, session.user.id), eq2(am.accountId, activeCookie.accountId))
        : eq2(am.userId, session.user.id),
    with: { account: true },
  });

  if (!membership) return { error: "NO_ACCOUNT" as const };

  // Verify at least 1 cinema exists
  const cinemaCount = await db.query.cinemas.findMany({
    where: (c, { eq: eq2, and, isNull }) =>
      and(eq2(c.accountId, membership.accountId), isNull(c.archivedAt)),
    limit: 1,
  });

  if (cinemaCount.length === 0) {
    return { error: "MUST_ADD_CINEMA" as const };
  }

  await db
    .update(accounts)
    .set({ onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(accounts.id, membership.accountId));

  revalidatePath("/", "layout");
  return { success: true as const };
}
