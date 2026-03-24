"use client";

import {
  BookOpenIcon,
  BuildingIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  ClipboardListIcon,
  FilmIcon,
  HomeIcon,
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

import { HeaderSearch } from "@/components/header-search";
import { useAccountContext } from "@/components/providers/account-provider";
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
import { useCartItemsCount } from "@/hooks/use-cart-items-count";
import { Link } from "@/i18n/navigation";
import { signOutAndCleanup } from "@/lib/auth/client";
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

interface MarketplaceHeaderProps {
  user: {
    name: string;
    email: string;
  };
}

const TYPE_ICONS: Record<AccountType, LucideIcon> = {
  exhibitor: BuildingIcon,
  rights_holder: FilmIcon,
  admin: ShieldCheckIcon,
};

export function MarketplaceHeader({ user }: MarketplaceHeaderProps) {
  const t = useTranslations("navigation");
  const tSwitcher = useTranslations("accountSwitcher");
  const pathname = usePathname();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  const {
    memberships,
    activeAccountId,
    activeMembership,
    hasMultipleAccounts,
    setActiveAccountId,
  } = useAccountContext();
  const { data: cartCount = 0 } = useCartItemsCount();
  const canManageAccount = activeMembership?.role === "owner" || activeMembership?.role === "admin";

  const mainNav: NavLink[] = [
    { title: t("home"), href: "/home", icon: HomeIcon },
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
    signOutAndCleanup();
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

    setActiveAccountId(accountId);
    toast.success(tSwitcher("switched", { name: result.accountName }));
    router.push(result.redirectUrl);
    router.refresh();
    setSwitching(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[oklch(0.10_0_0)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 lg:px-6 2xl:max-w-[1440px]">
        {/* Logo */}
        <Link href="/" className="mr-8 flex items-center gap-2">
          <span className="font-heading text-xl tracking-tight text-white">Timeless</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {mainNav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-white",
                pathname.includes(link.href) ? "text-white" : "text-white/60"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.title}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Search */}
        <HeaderSearch />

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Active account indicator / switcher */}
          {activeMembership &&
            (hasMultipleAccounts ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden gap-1.5 text-white/70 hover:bg-white/10 hover:text-white md:flex"
                  >
                    {(() => {
                      const Icon = TYPE_ICONS[activeMembership.account.type];
                      return <Icon className="h-4 w-4" />;
                    })()}
                    <span className="max-w-[120px] truncate text-sm">
                      {activeMembership.account.companyName}
                    </span>
                    <ChevronsUpDownIcon className="h-3.5 w-3.5 text-white/40" />
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
              <div className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white/50 md:flex">
                {(() => {
                  const Icon = TYPE_ICONS[activeMembership.account.type];
                  return <Icon className="h-4 w-4" />;
                })()}
                <span className="max-w-[120px] truncate">
                  {activeMembership.account.companyName}
                </span>
              </div>
            ))}

          {/* Cart */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="relative text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Link href="/cart">
              <ShoppingCartIcon className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
              <span className="sr-only">{t("cart")}</span>
            </Link>
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-white/20 text-xs font-semibold tracking-wide text-white ring-1 ring-white/25">
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
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:bg-white/10 hover:text-white md:hidden"
              >
                <MenuIcon className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 bg-[oklch(0.10_0_0)] border-white/10 text-white"
            >
              <SheetHeader>
                <SheetTitle className="font-heading text-white">TIMELESS</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {mainNav.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/10",
                      pathname.includes(link.href) ? "text-white" : "text-white/60"
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.title}
                  </Link>
                ))}
                <div className="my-2 border-t border-white/10" />
                <p className="px-3 text-xs font-medium uppercase tracking-wider text-white/40">
                  {t("account")}
                </p>
                {accountNav.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/10",
                      pathname.includes(link.href) ? "text-white" : "text-white/60"
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
