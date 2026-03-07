import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";

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

  const sections: NavSection[] = [
    {
      items: [
        { title: t("dashboard"), href: "/dashboard", icon: "gauge" },
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
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={user} sections={sections} profileHref="/account/profile" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
