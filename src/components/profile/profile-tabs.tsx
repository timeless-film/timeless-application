"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function ProfileTabs() {
  const t = useTranslations("profile");
  const pathname = usePathname();

  const tabs = [
    { label: t("tabs.profile"), href: "/account/profile" },
    { label: t("tabs.sessions"), href: "/account/profile/sessions" },
  ];

  return (
    <nav className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/account/profile"
            ? pathname === "/account/profile"
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
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
