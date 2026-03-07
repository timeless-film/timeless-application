"use client";

import { BuildingIcon, FilmIcon, Loader2, ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { switchAccount } from "@/lib/auth/membership-actions";

import type { AccountType } from "@/lib/auth/active-account-cookie";

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

interface AccountSelectorProps {
  memberships: MembershipInfo[];
}

const ACCOUNT_TYPE_ICONS: Record<AccountType, typeof BuildingIcon> = {
  exhibitor: BuildingIcon,
  rights_holder: FilmIcon,
  admin: ShieldCheckIcon,
};

export function AccountSelector({ memberships }: AccountSelectorProps) {
  const t = useTranslations("selectAccount");
  const tMembers = useTranslations("members");
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);

  // Auto-select if only one account
  useEffect(() => {
    if (memberships.length === 1 && memberships[0]) {
      handleSwitch(memberships[0].accountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSwitch(accountId: string) {
    setSwitching(accountId);
    const result = await switchAccount(accountId);

    if ("error" in result) {
      toast.error(t("error"));
      setSwitching(null);
      return;
    }

    toast.success(t("switched", { name: result.accountName }));
    router.push(result.redirectUrl);
  }

  function getTypeLabel(type: AccountType): string {
    switch (type) {
      case "exhibitor":
        return t("typeExhibitor");
      case "rights_holder":
        return t("typeRightsHolder");
      case "admin":
        return t("typeAdmin");
    }
  }

  function getRoleLabel(role: string): string {
    return tMembers(`role.${role}` as Parameters<typeof tMembers>[0]);
  }

  // Show loading while auto-selecting
  if (memberships.length === 1) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="font-heading text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {memberships.map((membership) => {
          const Icon = ACCOUNT_TYPE_ICONS[membership.account.type];
          const isLoading = switching === membership.accountId;

          return (
            <Button
              key={membership.id}
              variant="outline"
              className="flex h-auto w-full items-center justify-start gap-3 p-4"
              disabled={switching !== null}
              onClick={() => handleSwitch(membership.accountId)}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              ) : (
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex flex-1 flex-col items-start gap-0.5">
                <span className="text-sm font-medium">{membership.account.companyName}</span>
                <span className="text-xs text-muted-foreground">
                  {getTypeLabel(membership.account.type)} · {getRoleLabel(membership.role)}
                </span>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {getTypeLabel(membership.account.type)}
              </Badge>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
