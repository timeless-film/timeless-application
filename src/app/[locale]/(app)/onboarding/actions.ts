"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ACTIVE_ACCOUNT_COOKIE, encodeActiveAccountCookie } from "@/lib/auth/active-account-cookie";
import { db } from "@/lib/db";
import { accountMembers, accounts } from "@/lib/db/schema";

export interface OnboardingFormState {
  error?: string;
}

/**
 * Server action for the onboarding form.
 *
 * Uses the React 19 form action pattern (FormData + useActionState):
 * - On success: sets the active account cookie and calls redirect() —
 *   handled by Next.js action framework, no client-side JS needed.
 * - On error: returns { error: "CODE" } which the client renders inline.
 */
export async function createExhibitorAccountAction(
  _prevState: OnboardingFormState | null,
  formData: FormData
): Promise<OnboardingFormState> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "UNAUTHORIZED" };
  }

  const companyName = (formData.get("companyName") as string | null)?.trim();
  const country = formData.get("country") as string | null;
  const locale = (formData.get("locale") as string | null) ?? "en";

  if (!companyName || !country) {
    return { error: "INVALID_INPUT" };
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
      companyName,
      country,
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

  // Set the active account cookie immediately
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ACCOUNT_COOKIE, encodeActiveAccountCookie(account.id, "exhibitor"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // redirect() is handled by the Next.js action framework — it throws
  // NEXT_REDIRECT which React 19's useActionState processes correctly.
  // No client-side navigation needed.
  // Force layout re-render so AccountProvider gets fresh memberships
  revalidatePath("/", "layout");
  redirect(`/${locale}/catalog`);
}
