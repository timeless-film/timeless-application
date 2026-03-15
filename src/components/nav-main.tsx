"use client";

import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";

export function NavMain({
  label,
  items,
}: {
  label?: string;
  items: {
    title: string;
    href: string;
    icon?: LucideIcon;
    badge?: number;
    badgeVariant?: "default" | "destructive";
  }[];
}) {
  const pathname = usePathname();
  const normalizedPathname = pathname.replace(/^\/(en|fr)(?=\/|$)/, "") || "/";

  function isItemActive(href: string) {
    const normalizedHref = href.startsWith("/") ? href : `/${href}`;
    return (
      normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)
    );
  }

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={isItemActive(item.href)} tooltip={item.title}>
                <Link href={item.href}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {item.badge !== undefined && (
                <SidebarMenuBadge
                  className={cn(
                    "rounded-full min-w-5 h-5 text-xs",
                    item.badgeVariant === "destructive" && item.badge > 0
                      ? "bg-destructive !text-white font-semibold"
                      : "bg-sidebar-accent text-sidebar-foreground/60"
                  )}
                >
                  {item.badge}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
