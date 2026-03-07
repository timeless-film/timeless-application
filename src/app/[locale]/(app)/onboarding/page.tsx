import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // If user already has an account, redirect to catalog
  const membership = await db.query.accountMembers.findFirst({
    where: (am, { eq }) => eq(am.userId, session.user.id),
  });

  if (membership) {
    redirect(`/${locale}/catalog`);
  }

  return <OnboardingForm />;
}
