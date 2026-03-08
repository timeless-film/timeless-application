import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { StripeConnectTab } from "@/components/account/stripe-connect-tab";
import { getCurrentMembership } from "@/lib/auth/membership";
import { stripe } from "@/lib/stripe";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("stripeConnect");
  return {
    title: t("title"),
  };
}

export default async function StripeConnectPage() {
  const ctx = await getCurrentMembership();

  if (!ctx || ctx.account.type !== "rights_holder") {
    redirect("/home");
  }

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    redirect("/account/information");
  }

  let status: "not_started" | "incomplete" | "complete" = "not_started";

  if (ctx.account.stripeConnectAccountId) {
    if (ctx.account.stripeConnectOnboardingComplete) {
      status = "complete";
    } else {
      // Check current Stripe status in case webhook hasn't fired yet
      const stripeAccount = await stripe.accounts.retrieve(ctx.account.stripeConnectAccountId);
      if (stripeAccount.details_submitted && stripeAccount.charges_enabled) {
        status = "complete";
      } else {
        status = "incomplete";
      }
    }
  }

  return <StripeConnectTab status={status} />;
}
