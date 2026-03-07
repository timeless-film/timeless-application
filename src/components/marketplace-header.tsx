"use client";

import {
  BookOpenIcon,
  BuildingIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  ClipboardListIcon,
  FilmIcon,
  LayersIcon,
  LogOutIcon,
  MenuIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TicketIcon,
  UserCircleIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { signOut } from "@/lib/auth/client";
import { switchAccount } from "@/lib/auth/membership-actions";
import { cn } from "@/lib/utils";

import type { AccountType } from "@/lib/auth/active-account-cookie";
import type { LucideIcon } from "lucide-react";

interface NavLink {
  title: string;
  href: string;
  icon: LucideIcon;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface MembershipInfo {
  id: string;
  accountId: string;
  role: string;
  account: {
    id: string;
    companyName: string;
    type: AccountType;
  };
}

interface MarketplaceHeaderProps {
  user: {
    name: string;
    email: string;
  };
  memberships: MembershipInfo[];
  activeAccountId: string;
}

const TYPE_ICONS: Record<AccountType, LucideIcon> = {
  exhibitor: BuildingIcon,
  rights_holder: FilmIcon,
  admin: ShieldCheckIcon,
};

export function MarketplaceHeader({ user, memberships, activeAccountId }: MarketplaceHeaderProps) {
  const t = useTranslations("navigation");
  const tSwitcher = useTranslations("accountSwitcher");
  const pathname = usePathname();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  const activeAccount = memberships.find((m) => m.accountId === activeAccountId);
  const hasMultipleAccounts = memberships.length > 1;
  const canManageAccount = activeAccount?.role === "owner" || activeAccount?.role === "admin";

  const mainNav: NavLink[] = [
    { title: t("catalog"), href: "/catalog", icon: BookOpenIcon },
    { title: t("orders"), href: "/orders", icon: TicketIcon },
    { title: t("requests"), href: "/requests", icon: ClipboardListIcon },
  ];

  const accountNav: NavLink[] = [
    { title: t("profile"), href: "/account/profile", icon: UserCircleIcon },
    ...(canManageAccount
      ? [{ title: t("manageAccount"), href: "/account/information", icon: SettingsIcon }]
      : []),
    { title: t("myAccounts"), href: "/accounts", icon: LayersIcon },
  ];

  function handleSignOut() {
    signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  }

  async function handleSwitch(accountId: string) {
    if (accountId === activeAccountId || switching) return;
    setSwitching(true);

    const result = await switchAccount(accountId);
    if ("error" in result) {
      toast.error(tSwitcher("error"));
      setSwitching(false);
      return;
    }

    toast.success(tSwitcher("switched", { name: result.accountName }));
    router.push(result.redirectUrl);
    router.refresh();
    setSwitching(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 lg:px-6">
        {/* Logo */}
        <Link href="/" className="mr-8 flex items-center gap-2">
          <span className="font-heading text-xl tracking-tight">Timeless</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {mainNav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname.includes(link.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.title}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Active account indicator / switcher */}
          {activeAccount &&
            (hasMultipleAccounts ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden gap-1.5 md:flex">
                    {(() => {
                      const Icon = TYPE_ICONS[activeAccount.account.type];
                      return <Icon className="h-4 w-4" />;
                    })()}
                    <span className="max-w-[120px] truncate text-sm">
                      {activeAccount.account.companyName}
                    </span>
                    <ChevronsUpDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {tSwitcher("label")}
                  </DropdownMenuLabel>
                  {memberships.map((membership) => {
                    const Icon = TYPE_ICONS[membership.account.type];
                    const isActive = membership.accountId === activeAccountId;
                    return (
                      <DropdownMenuItem
                        key={membership.id}
                        onClick={() => handleSwitch(membership.accountId)}
                        className="gap-2"
                        disabled={switching}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1 truncate">{membership.account.companyName}</span>
                        {isActive && <CheckIcon className="h-4 w-4 text-muted-foreground" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground md:flex">
                {(() => {
                  const Icon = TYPE_ICONS[activeAccount.account.type];
                  return <Icon className="h-4 w-4" />;
                })()}
                <span className="max-w-[120px] truncate">{activeAccount.account.companyName}</span>
              </div>
            ))}

          {/* Cart */}
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link href="/cart">
              <ShoppingCartIcon className="h-5 w-5" />
              <span className="sr-only">{t("cart")}</span>
            </Link>
          </Button>

          <LanguageSwitcher />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {accountNav.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href}>
                    <link.icon className="mr-2 h-4 w-4" />
                    {link.title}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOutIcon className="mr-2 h-4 w-4" />
                {t("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <MenuIcon className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="font-heading">TIMELESS</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {mainNav.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                      pathname.includes(link.href)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.title}
                  </Link>
                ))}
                <div className="my-2 border-t" />
                <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t("account")}
                </p>
                {accountNav.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                      pathname.includes(link.href)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.title}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
