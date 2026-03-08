import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/membership";
import { createConnectOnboardingLink } from "@/lib/stripe";

export default async function StripeConnectRefreshPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const ctx = await getCurrentMembership();
  if (!ctx || ctx.account.type !== "rights_holder") redirect("/home");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/account/information");
  if (!ctx.account.stripeConnectAccountId) redirect("/account/information?tab=stripe-connect");

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const locale = pathname.split("/")[1] ?? "en";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { url } = await createConnectOnboardingLink({
    accountId: ctx.account.stripeConnectAccountId,
    email: ctx.account.contactEmail ?? session.user.email,
    returnUrl: `${baseUrl}/${locale}/account/stripe-connect`,
    refreshUrl: `${baseUrl}/${locale}/account/stripe-connect/refresh`,
  });

  redirect(url);
}
