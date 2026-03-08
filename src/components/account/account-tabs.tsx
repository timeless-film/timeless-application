"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface AccountTabsProps {
  showCinemas?: boolean;
  showApi?: boolean;
}

export function AccountTabs({ showCinemas = false, showApi = false }: AccountTabsProps) {
  const t = useTranslations("accountSettings");
  const pathname = usePathname();

  const tabs = [
    { label: t("tabs.information"), href: "/account/information" },
    { label: t("tabs.members"), href: "/account/members" },
    ...(showCinemas ? [{ label: t("tabs.cinemas"), href: "/account/cinemas" }] : []),
    ...(showApi ? [{ label: t("tabs.api"), href: "/account/api" }] : []),
  ];

  return (
    <nav className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
