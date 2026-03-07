import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function LocaleRootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Check if user has an account linked
  const membership = await db.query.accountMembers.findFirst({
    where: (am, { eq }) => eq(am.userId, session.user.id),
    with: { account: true },
  });

  if (!membership) {
    redirect(`/${locale}/onboarding`);
  }

  // Redirect based on account type
  if (membership.account.type === "admin") {
    redirect(`/${locale}/dashboard`);
  }

  if (membership.account.type === "rights_holder") {
    redirect(`/${locale}/films`);
  }

  // Default: exhibitor
  redirect(`/${locale}/catalogue`);
}
