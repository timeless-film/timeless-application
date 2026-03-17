import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { RightsHolderSidebar } from "@/components/layout/rights-holder-sidebar";
import { MarketplaceFooter } from "@/components/marketplace-footer";
import { MarketplaceHeader } from "@/components/marketplace-header";
import { AccountProvider } from "@/components/providers/account-provider";
import { StripeConnectBanner } from "@/components/shared/stripe-connect-banner";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { requireTermsAcceptance, requireTermsOfSaleAcceptance } from "@/lib/auth/legal-guards";
import { getActiveAccountCookie, getAllMemberships } from "@/lib/auth/membership";

import type { NavSection } from "@/components/app-sidebar";
import type { ReactNode } from "react";

export default async function HomeLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  // CGU acceptance guard
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const locale = pathname.split("/")[1] ?? "en";
  await requireTermsAcceptance(session.user.id, locale);

  const [memberships, activeCookie] = await Promise.all([
    getAllMemberships(session.user.id),
    getActiveAccountCookie(),
  ]);

  if (!activeCookie) {
    redirect("/accounts");
  }

  const user = {
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };

  const activeMembership = memberships.find((m) => m.accountId === activeCookie.accountId);
  const canManageAccount = activeMembership?.role === "owner" || activeMembership?.role === "admin";

  // Exhibitor layout — marketplace header
  if (activeCookie.type === "exhibitor") {
    // Onboarding guard
    if (activeMembership && !activeMembership.account.onboardingCompleted) {
      redirect(`/${locale}/onboarding`);
    }

    // CGV acceptance guard (after onboarding)
    if (activeMembership) {
      await requireTermsOfSaleAcceptance(
        activeCookie.accountId,
        activeMembership.account.country ?? "FR",
        locale
      );
    }

    return (
      <AccountProvider
        key={activeCookie.accountId}
        initialMemberships={memberships}
        initialActiveAccountId={activeCookie.accountId}
      >
        <div className="flex min-h-screen flex-col">
          <MarketplaceHeader user={user} />
          <main className="flex-1">{children}</main>
          <MarketplaceFooter
            initialCurrency={activeMembership?.account.preferredCurrency ?? "EUR"}
          />
        </div>
      </AccountProvider>
    );
  }

  // Rights holder layout — sidebar
  if (activeCookie.type === "rights_holder") {
    // CGV acceptance guard
    if (activeMembership) {
      await requireTermsOfSaleAcceptance(
        activeCookie.accountId,
        activeMembership.account.country ?? "",
        locale
      );
    }

    const t = await getTranslations("navigation");
    const showBanner = !activeMembership?.account.stripeConnectOnboardingComplete;

    const sections: NavSection[] = [
      {
        items: [
          { title: t("home"), href: "/home", icon: "gauge" },
          { title: t("films"), href: "/films", icon: "film" },
          { title: t("validationRequests"), href: "/validation-requests", icon: "clipboard-list" },
          { title: t("wallet"), href: "/wallet", icon: "wallet" },
        ],
      },
      ...(canManageAccount
        ? [
            {
              label: t("account"),
              items: [
                {
                  title: t("manageAccount"),
                  href: "/account/information",
                  icon: "settings" as const,
                },
              ],
            },
          ]
        : []),
    ];

    return (
      <AccountProvider
        key={activeCookie.accountId}
        initialMemberships={memberships}
        initialActiveAccountId={activeCookie.accountId}
      >
        <SidebarProvider
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties
          }
        >
          <RightsHolderSidebar
            variant="inset"
            user={user}
            sections={sections}
            profileHref="/account/profile"
            accountHref="/account/information"
            canManageAccount={canManageAccount}
            showLanguageSwitcher
          />
          <SidebarInset>
            <SiteHeader showLanguageSwitcher={false} />
            {showBanner && <StripeConnectBanner canManage={canManageAccount} />}
            <div className="flex flex-1 flex-col">
              <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">{children}</div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </AccountProvider>
    );
  }

  // Admin — redirect to dashboard
  redirect("/admin/dashboard");
}
