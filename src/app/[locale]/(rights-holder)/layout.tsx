import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { AppSidebar } from "@/components/app-sidebar";
import { AccountProvider } from "@/components/providers/account-provider";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { getActiveAccountCookie, getAllMemberships } from "@/lib/auth/membership";

import type { NavSection } from "@/components/app-sidebar";
import type { ReactNode } from "react";

export default async function RightsHolderLayout({ children }: { children: ReactNode }) {
  const [session, t] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getTranslations("navigation"),
  ]);

  const user = {
    name: session?.user.name ?? "",
    email: session?.user.email ?? "",
  };

  const [memberships, activeCookie] = await Promise.all([
    session ? getAllMemberships(session.user.id) : [],
    getActiveAccountCookie(),
  ]);

  const activeMembership = memberships.find((m) => m.accountId === activeCookie?.accountId);
  const canManageAccount = activeMembership?.role === "owner" || activeMembership?.role === "admin";

  const sections: NavSection[] = [
    {
      items: [
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
      key={activeCookie?.accountId ?? "no-account"}
      initialMemberships={memberships}
      initialActiveAccountId={activeCookie?.accountId ?? ""}
    >
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          user={user}
          sections={sections}
          profileHref="/account/profile"
          accountHref="/account/information"
          canManageAccount={canManageAccount}
        />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AccountProvider>
  );
}
