"use client";

import {
  GlobeIcon,
  LayersIcon,
  LogOutIcon,
  MoreVerticalIcon,
  SettingsIcon,
  UserCircleIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { signOutAndCleanup } from "@/lib/auth/client";

import type { Locale } from "@/i18n/routing";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const LOCALE_TARGETS: Record<Locale, Locale> = {
  en: "fr",
  fr: "en",
};

interface NavUserProps {
  user: {
    name: string;
    email: string;
  };
  profileHref: string;
  accountHref?: string;
  canManageAccount?: boolean;
  showLanguageSwitcher?: boolean;
}

export function NavUser({
  user,
  profileHref,
  accountHref,
  canManageAccount,
  showLanguageSwitcher,
}: NavUserProps) {
  const { isMobile } = useSidebar();
  const t = useTranslations("navigation");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  function handleSignOut() {
    signOutAndCleanup();
  }

  function handleSwitchLanguage() {
    const target = LOCALE_TARGETS[locale];
    router.replace(pathname, { locale: target });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {getInitials(user.name || user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <MoreVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {getInitials(user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={profileHref}>
                <UserCircleIcon />
                {t("profile")}
              </Link>
            </DropdownMenuItem>
            {canManageAccount && accountHref && (
              <DropdownMenuItem asChild>
                <Link href={accountHref}>
                  <SettingsIcon />
                  {t("manageAccount")}
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/accounts">
                <LayersIcon />
                {t("myAccounts")}
              </Link>
            </DropdownMenuItem>
            {showLanguageSwitcher && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSwitchLanguage}>
                  <GlobeIcon />
                  {t("switchLanguage")}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOutIcon />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
