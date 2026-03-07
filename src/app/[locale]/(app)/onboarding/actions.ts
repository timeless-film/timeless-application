"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountMembers, accounts } from "@/lib/db/schema";

interface OnboardingInput {
  companyName: string;
  country: string;
}

export async function createExhibitorAccount(input: OnboardingInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "UNAUTHORIZED" };
  }

  // Check if user already has an account
  const existingMembership = await db.query.accountMembers.findFirst({
    where: (am, { eq }) => eq(am.userId, session.user.id),
  });

  if (existingMembership) {
    return { error: "ALREADY_HAS_ACCOUNT" };
  }

  // Create the exhibitor account
  const [account] = await db
    .insert(accounts)
    .values({
      type: "exhibitor",
      companyName: input.companyName,
      country: input.country,
    })
    .returning();

  if (!account) {
    return { error: "CREATION_FAILED" };
  }

  // Link user as owner
  await db.insert(accountMembers).values({
    accountId: account.id,
    userId: session.user.id,
    role: "owner",
  });

  return { success: true, accountId: account.id };
}

export async function redirectAfterOnboarding(locale: string) {
  redirect(`/${locale}/catalogue`);
}
