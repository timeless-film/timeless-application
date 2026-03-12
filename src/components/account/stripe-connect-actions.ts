"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { getPayoutSchedule, updatePayoutSchedule } from "@/lib/services/wallet-service";
import { createConnectOnboardingLink, stripe } from "@/lib/stripe";

import type { PayoutScheduleInput } from "@/lib/services/wallet-service";

/**
 * Creates (or reuses) a Stripe Connect Express account and returns the onboarding URL.
 * Only owner/admin of a rights_holder account can call this.
 */
export async function startStripeConnectOnboarding(params: {
  returnUrl: string;
  refreshUrl: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.account.type !== "rights_holder") {
    return { error: "FORBIDDEN" as const };
  }

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const { accountId, url } = await createConnectOnboardingLink({
    accountId: ctx.account.stripeConnectAccountId ?? undefined,
    email: ctx.account.contactEmail ?? session.user.email,
    returnUrl: params.returnUrl,
    refreshUrl: params.refreshUrl,
  });

  // Persist the Stripe Connect account ID if it was just created
  if (!ctx.account.stripeConnectAccountId) {
    await db
      .update(accounts)
      .set({ stripeConnectAccountId: accountId, updatedAt: new Date() })
      .where(eq(accounts.id, ctx.account.id));
  }

  return { success: true as const, url };
}

/**
 * Checks the current Stripe Connect onboarding status by querying the Stripe API.
 * Returns the current status from Stripe (not cached DB value).
 */
export async function checkStripeConnectStatus() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.account.type !== "rights_holder") {
    return { error: "FORBIDDEN" as const };
  }

  if (!ctx.account.stripeConnectAccountId) {
    return { success: true as const, status: "not_started" as const };
  }

  const stripeAccount = await stripe.accounts.retrieve(ctx.account.stripeConnectAccountId);

  const isComplete = stripeAccount.details_submitted && stripeAccount.charges_enabled;

  // Keep the local flag aligned with Stripe in case the webhook was missed.
  if (isComplete !== ctx.account.stripeConnectOnboardingComplete) {
    await db
      .update(accounts)
      .set({ stripeConnectOnboardingComplete: isComplete, updatedAt: new Date() })
      .where(eq(accounts.id, ctx.account.id));
    revalidatePath("/", "layout");
  }

  if (isComplete) {
    return { success: true as const, status: "complete" as const };
  }

  if (stripeAccount.details_submitted) {
    return { success: true as const, status: "pending_verification" as const };
  }

  return { success: true as const, status: "incomplete" as const };
}

/**
 * Creates a login link to the Stripe Express dashboard for the connected account.
 */
export async function createStripeConnectDashboardLink() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.account.type !== "rights_holder") {
    return { error: "FORBIDDEN" as const };
  }

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  if (!ctx.account.stripeConnectAccountId || !ctx.account.stripeConnectOnboardingComplete) {
    return { error: "NOT_CONFIGURED" as const };
  }

  const loginLink = await stripe.accounts.createLoginLink(ctx.account.stripeConnectAccountId);

  return { success: true as const, url: loginLink.url };
}

/**
 * Detaches the locally linked Stripe Connect account so onboarding can restart.
 * This does not delete the remote Stripe account.
 */
export async function detachStripeConnectAccount() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.account.type !== "rights_holder") {
    return { error: "FORBIDDEN" as const };
  }

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  await db
    .update(accounts)
    .set({
      stripeConnectAccountId: null,
      stripeConnectOnboardingComplete: false,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, ctx.account.id));

  revalidatePath("/", "layout");
  revalidatePath("/account/stripe-connect");
  revalidatePath("/account/information");

  return { success: true as const };
}

/**
 * Fetches the current payout schedule for the connected Stripe account.
 */
export async function fetchPayoutSchedule() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.account.type !== "rights_holder") {
    return { error: "FORBIDDEN" as const };
  }

  if (!ctx.account.stripeConnectAccountId || !ctx.account.stripeConnectOnboardingComplete) {
    return { error: "NOT_CONFIGURED" as const };
  }

  const schedule = await getPayoutSchedule(ctx.account.stripeConnectAccountId);
  return { success: true as const, schedule };
}

/**
 * Updates the payout schedule for the connected Stripe account.
 */
export async function updatePayoutSettings(input: PayoutScheduleInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.account.type !== "rights_holder") {
    return { error: "FORBIDDEN" as const };
  }

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  if (!ctx.account.stripeConnectAccountId || !ctx.account.stripeConnectOnboardingComplete) {
    return { error: "NOT_CONFIGURED" as const };
  }

  try {
    await updatePayoutSchedule(ctx.account.stripeConnectAccountId, input);
    return { success: true as const };
  } catch (error) {
    console.error("Failed to update payout schedule:", error);
    return { error: "UNKNOWN" as const };
  }
}
