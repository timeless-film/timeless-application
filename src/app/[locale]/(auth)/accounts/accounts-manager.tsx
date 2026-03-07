"use client";

import {
  BuildingIcon,
  CheckIcon,
  FilmIcon,
  Loader2,
  PlusCircleIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { switchAccount } from "@/lib/auth/membership-actions";

import { createAccount } from "./actions";

import type { AccountType } from "@/lib/auth/active-account-cookie";
import type { MembershipInfo } from "@/types/account";

interface AccountsManagerProps {
  memberships: MembershipInfo[];
  activeAccountId: string | null;
}

const TYPE_ICONS: Record<AccountType, typeof BuildingIcon> = {
  exhibitor: BuildingIcon,
  rights_holder: FilmIcon,
  admin: ShieldCheckIcon,
};

const COUNTRIES = [
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "LU", label: "Luxembourg" },
  { code: "CA", label: "Canada" },
  { code: "DE", label: "Deutschland" },
  { code: "GB", label: "United Kingdom" },
  { code: "IT", label: "Italia" },
  { code: "ES", label: "España" },
  { code: "US", label: "United States" },
];

export function AccountsManager({ memberships, activeAccountId }: AccountsManagerProps) {
  const t = useTranslations("accounts");
  const tMembers = useTranslations("members");
  const router = useRouter();

  const [switching, setSwitching] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");

  async function handleSwitch(accountId: string) {
    if (accountId === activeAccountId || switching) return;
    setSwitching(accountId);

    const result = await switchAccount(accountId);
    if ("error" in result) {
      toast.error(t("switchError"));
      setSwitching(null);
      return;
    }

    toast.success(t("switched", { name: result.accountName }));
    router.push(result.redirectUrl);
  }

  async function handleCreate() {
    if (!companyName.trim() || !country) return;
    setCreating(true);

    const result = await createAccount({
      companyName: companyName.trim(),
      country,
      type: "exhibitor",
    });

    if ("error" in result) {
      toast.error(t(`createError.${result.error}`));
      setCreating(false);
      return;
    }

    toast.success(t("created", { name: result.accountName }));
    router.push(result.redirectUrl);
  }

  function getTypeLabel(type: AccountType): string {
    return t(`type.${type}`);
  }

  function getRoleLabel(role: string): string {
    return tMembers(`role.${role}` as Parameters<typeof tMembers>[0]);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      {/* Account list */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-2xl">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {memberships.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">{t("noAccounts")}</p>
          ) : (
            memberships.map((membership) => {
              const Icon = TYPE_ICONS[membership.account.type];
              const isActive = membership.accountId === activeAccountId;
              const isLoading = switching === membership.accountId;

              return (
                <Button
                  key={membership.id}
                  variant={isActive ? "default" : "outline"}
                  className="flex h-auto w-full items-center justify-start gap-3 p-4"
                  disabled={switching !== null || isActive}
                  onClick={() => handleSwitch(membership.accountId)}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5 shrink-0" />
                  )}
                  <div className="flex flex-1 flex-col items-start gap-0.5">
                    <span className="text-sm font-medium">{membership.account.companyName}</span>
                    <span className="text-xs opacity-70">
                      {getTypeLabel(membership.account.type)} · {getRoleLabel(membership.role)}
                    </span>
                  </div>
                  {isActive && <CheckIcon className="h-4 w-4 shrink-0" />}
                  {!isActive && (
                    <Badge variant="secondary" className="shrink-0">
                      {t("switch")}
                    </Badge>
                  )}
                </Button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Create new account */}
      {!showCreate ? (
        <Button variant="outline" className="w-full" onClick={() => setShowCreate(true)}>
          <PlusCircleIcon className="mr-2 h-4 w-4" />
          {t("createNew")}
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("createTitle")}</CardTitle>
            <CardDescription>{t("createDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">
                {t("companyName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t("companyNamePlaceholder")}
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">
                {t("country")} <span className="text-destructive">*</span>
              </Label>
              <Select value={country} onValueChange={setCountry} disabled={creating}>
                <SelectTrigger id="country">
                  <SelectValue placeholder={t("countryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCreate(false)}
                disabled={creating}
              >
                {t("cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={creating || !companyName.trim() || !country}
              >
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("create")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
