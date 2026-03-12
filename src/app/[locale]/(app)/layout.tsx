import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MarketplaceFooter } from "@/components/marketplace-footer";
import { MarketplaceHeader } from "@/components/marketplace-header";
import { AccountProvider } from "@/components/providers/account-provider";
import { auth } from "@/lib/auth";
import { getActiveAccountCookie, getAllMemberships } from "@/lib/auth/membership";

import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  const user = {
    name: session?.user.name ?? "",
    email: session?.user.email ?? "",
  };

  const [memberships, activeCookie] = await Promise.all([
    session ? getAllMemberships(session.user.id) : [],
    getActiveAccountCookie(),
  ]);

  const activeMembership = memberships.find((m) => m.accountId === activeCookie?.accountId);

  // Onboarding guard — redirect to onboarding if not completed
  // Skip if already on the onboarding page to avoid redirect loop
  if (session && activeCookie) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "";
    const isOnOnboarding = pathname.includes("/onboarding");

    if (!isOnOnboarding) {
      if (
        activeMembership &&
        activeCookie.type === "exhibitor" &&
        !activeMembership.account.onboardingCompleted
      ) {
        const locale = pathname.split("/")[1] ?? "en";
        redirect(`/${locale}/onboarding`);
      }
    }
  }

  return (
    <AccountProvider
      key={activeCookie?.accountId ?? "no-account"}
      initialMemberships={memberships}
      initialActiveAccountId={activeCookie?.accountId ?? ""}
    >
      <div className="flex min-h-screen flex-col">
        <MarketplaceHeader user={user} />
        <main className="flex-1">{children}</main>
        <MarketplaceFooter initialCurrency={activeMembership?.account.preferredCurrency ?? "EUR"} />
      </div>
    </AccountProvider>
  );
}
