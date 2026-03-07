"use client";

import {
  BookOpenIcon,
  BuildingIcon,
  ClipboardListIcon,
  FilmIcon,
  GaugeIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TicketIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link } from "@/i18n/navigation";

import type { LucideIcon } from "lucide-react";
import type * as React from "react";

export type IconName =
  | "book-open"
  | "building"
  | "clipboard-list"
  | "film"
  | "gauge"
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
  }[];
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string;
    email: string;
  };
  sections: NavSection[];
  profileHref: string;
}

export function AppSidebar({ user, sections, profileHref, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href="/">
                <FilmIcon className="h-5 w-5" />
                <span className="text-base font-semibold">TIMELESS</span>
              </Link>
            </SidebarMenuButton>
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
            }))}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} profileHref={profileHref} />
      </SidebarFooter>
    </Sidebar>
  );
}
