"use client";

import {
  BuildingIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  FilmIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useAccountContext } from "@/components/providers/account-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { switchAccount } from "@/lib/auth/membership-actions";

import type { AccountType } from "@/lib/auth/active-account-cookie";
import type { LucideIcon } from "lucide-react";

const TYPE_ICONS: Record<AccountType, LucideIcon> = {
  exhibitor: BuildingIcon,
  rights_holder: FilmIcon,
  admin: ShieldCheckIcon,
};

export function AccountSwitcherSidebar() {
  const t = useTranslations("accountSwitcher");
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  const {
    memberships,
    activeAccountId,
    activeMembership,
    hasMultipleAccounts,
    setActiveAccountId,
  } = useAccountContext();

  // Only one account — no need for a switcher
  if (!hasMultipleAccounts) {
    if (!activeMembership) return null;
    const Icon = TYPE_ICONS[activeMembership.account.type];
    return (
      <SidebarMenuButton size="lg" className="data-[slot=sidebar-menu-button]:!p-1.5">
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Icon className="size-4" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{activeMembership.account.companyName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {t(`type.${activeMembership.account.type}`)}
          </span>
        </div>
      </SidebarMenuButton>
    );
  }

  async function handleSwitch(accountId: string) {
    if (accountId === activeAccountId || switching) return;
    setSwitching(true);

    const result = await switchAccount(accountId);
    if ("error" in result) {
      toast.error(t("error"));
      setSwitching(false);
      return;
    }

    setActiveAccountId(accountId);
    toast.success(t("switched", { name: result.accountName }));
    router.push(result.redirectUrl);
  }

  if (!activeMembership) return null;
  const ActiveIcon = TYPE_ICONS[activeMembership.account.type];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[slot=sidebar-menu-button]:!p-1.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <ActiveIcon className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{activeMembership.account.companyName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {t(`type.${activeMembership.account.type}`)}
            </span>
          </div>
          <ChevronsUpDownIcon className="ml-auto" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("label")}
        </DropdownMenuLabel>
        {memberships.map((membership) => {
          const Icon = TYPE_ICONS[membership.account.type];
          const isActive = membership.accountId === activeAccountId;
          return (
            <DropdownMenuItem
              key={membership.id}
              onClick={() => handleSwitch(membership.accountId)}
              className="gap-2 p-2"
              disabled={switching}
            >
              <div className="flex size-6 items-center justify-center rounded-sm border">
                <Icon className="size-4 shrink-0" />
              </div>
              <span className="flex-1">{membership.account.companyName}</span>
              {isActive && <CheckIcon className="size-4 text-muted-foreground" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 p-2" onClick={() => router.push("/select-account")}>
          <div className="flex size-6 items-center justify-center rounded-sm border bg-background">
            <ChevronsUpDownIcon className="size-4" />
          </div>
          <span className="text-muted-foreground">{t("viewAll")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
