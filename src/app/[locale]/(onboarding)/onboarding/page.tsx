import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { listCinemasForAccount } from "@/lib/services/cinema-service";

import { OnboardingStepper } from "./onboarding-stepper";

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Use the active account cookie to find the correct membership
  const activeCookie = await getActiveAccountCookie();

  const membership = await db.query.accountMembers.findFirst({
    where: (am, { eq, and }) =>
      activeCookie
        ? and(eq(am.userId, session.user.id), eq(am.accountId, activeCookie.accountId))
        : eq(am.userId, session.user.id),
    with: { account: true },
  });

  // Determine current step
  let initialStep: 1 | 2 | 3 = 1;
  let account = null;
  let cinemas: Awaited<ReturnType<typeof listCinemasForAccount>> = [];
  let invitations: {
    id: string;
    email: string;
    role: string;
    expiresAt: Date;
    createdAt: Date;
  }[] = [];

  if (membership) {
    account = membership.account;

    // Already completed onboarding — redirect to catalog
    if (account.onboardingCompleted) {
      redirect(`/${locale}/catalog`);
    }

    // Members cannot do onboarding — only owner/admin
    if (membership.role === "member") {
      return <MemberBlocked />;
    }

    cinemas = await listCinemasForAccount(account.id);

    if (cinemas.length === 0) {
      initialStep = 2;
    } else {
      initialStep = 3;
      // Load pending invitations
      const pendingInvitations = await db.query.invitations.findMany({
        where: (inv, { eq, and, isNull }) =>
          and(eq(inv.accountId, account!.id), isNull(inv.acceptedAt)),
        orderBy: (inv, { desc }) => desc(inv.createdAt),
      });
      invitations = pendingInvitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      }));
    }
  }

  const accountData = account
    ? {
        id: account.id,
        companyName: account.companyName,
        country: account.country,
        address: account.address,
        city: account.city,
        postalCode: account.postalCode,
        vatNumber: account.vatNumber,
        preferredCurrency: account.preferredCurrency,
        contactEmail: account.contactEmail,
        contactPhone: account.contactPhone,
        cinemaType: account.cinemaType,
      }
    : null;

  const cinemaData = cinemas.map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city ?? "",
    country: c.country,
    rooms: c.rooms.map((r) => ({ id: r.id })),
  }));

  return (
    <OnboardingStepper
      initialStep={initialStep}
      account={accountData}
      cinemas={cinemaData}
      invitations={invitations}
    />
  );
}

// ─── Member blocked view ──────────────────────────────────────────────────────

async function MemberBlocked() {
  const { getTranslations } = await import("next-intl/server");
  const t = await getTranslations("onboarding.memberBlocked");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("description")}</p>
      </div>
    </div>
  );
}
