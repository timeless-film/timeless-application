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

export default async function AdminLayout({ children }: { children: ReactNode }) {
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
        { title: t("dashboard"), href: "/dashboard", icon: "gauge" },
        { title: t("adminOrders"), href: "/order-management", icon: "shopping-cart" },
        { title: t("exhibitors"), href: "/exhibitors", icon: "users" },
        { title: t("rightsHolders"), href: "/rights-holders", icon: "shield-check" },
        { title: t("deliveries"), href: "/deliveries", icon: "truck" },
      ],
    },
    {
      label: t("management"),
      items: [
        { title: t("settings"), href: "/settings", icon: "settings" },
        { title: t("logs"), href: "/logs", icon: "scroll-text" },
      ],
    },
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
          canManageAccount={canManageAccount}
        />
        <SidebarInset className="overflow-hidden">
          <SiteHeader />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-6">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AccountProvider>
  );
}
