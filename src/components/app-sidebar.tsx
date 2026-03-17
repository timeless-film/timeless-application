"use client";

import {
  BookOpenIcon,
  BuildingIcon,
  ClipboardListIcon,
  FilmIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  ScaleIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TicketIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { AccountSwitcherSidebar } from "@/components/account-switcher";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import type { LucideIcon } from "lucide-react";
import type * as React from "react";

export type IconName =
  | "book-open"
  | "building"
  | "clipboard-list"
  | "film"
  | "gauge"
  | "layout-dashboard"
  | "scale"
  | "scroll-text"
  | "settings"
  | "shield-check"
  | "shopping-cart"
  | "ticket"
  | "truck"
  | "users"
  | "wallet";

const ICON_MAP: Record<IconName, LucideIcon> = {
  "book-open": BookOpenIcon,
  building: BuildingIcon,
  "clipboard-list": ClipboardListIcon,
  film: FilmIcon,
  gauge: GaugeIcon,
  "layout-dashboard": LayoutDashboardIcon,
  scale: ScaleIcon,
  "scroll-text": ScrollTextIcon,
  settings: SettingsIcon,
  "shield-check": ShieldCheckIcon,
  "shopping-cart": ShoppingCartIcon,
  ticket: TicketIcon,
  truck: TruckIcon,
  users: UsersIcon,
  wallet: WalletIcon,
};

export interface NavSection {
  label?: string;
  items: {
    title: string;
    href: string;
    icon?: IconName;
    badge?: number;
    badgeVariant?: "default" | "destructive";
  }[];
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string;
    email: string;
  };
  sections: NavSection[];
  profileHref: string;
  accountHref?: string;
  canManageAccount?: boolean;
  showLanguageSwitcher?: boolean;
}

export function AppSidebar({
  user,
  sections,
  profileHref,
  accountHref,
  canManageAccount,
  showLanguageSwitcher,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountSwitcherSidebar />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section, i) => (
          <NavMain
            key={i}
            label={section.label}
            items={section.items.map((item) => ({
              ...item,
              icon: item.icon ? ICON_MAP[item.icon] : undefined,
              badge: item.badge,
              badgeVariant: item.badgeVariant,
            }))}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={user}
          profileHref={profileHref}
          accountHref={accountHref}
          canManageAccount={canManageAccount}
          showLanguageSwitcher={showLanguageSwitcher}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
