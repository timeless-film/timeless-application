"use client";

import {
  BuildingIcon,
  CheckIcon,
  FilmIcon,
  Loader2,
  MailIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { acceptInvitationById } from "@/components/account/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { AccountType } from "@/lib/auth/active-account-cookie";
import type { LucideIcon } from "lucide-react";

export interface PendingInvitationInfo {
  id: string;
  role: string;
  accountName: string;
  accountType: AccountType;
  expiresAt: Date;
}

interface PendingInvitationsProps {
  invitations: PendingInvitationInfo[];
  redirectAfterAccept?: string;
}

const TYPE_ICONS: Record<AccountType, LucideIcon> = {
  exhibitor: BuildingIcon,
  rights_holder: FilmIcon,
  admin: ShieldCheckIcon,
};

export function PendingInvitations({
  invitations: initialInvitations,
  redirectAfterAccept,
}: PendingInvitationsProps) {
  const t = useTranslations("pendingInvitations");
  const tMembers = useTranslations("members");
  const router = useRouter();
  const [invitations, setInvitations] = useState(initialInvitations);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  async function handleAccept(invitationId: string) {
    setAcceptingId(invitationId);

    const result = await acceptInvitationById(invitationId);

    if ("error" in result) {
      toast.error(t(`error.${result.error}`));
      setAcceptingId(null);
      return;
    }

    toast.success(t("accepted", { name: result.accountName }));
    setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));

    if (redirectAfterAccept) {
      router.push(redirectAfterAccept);
    } else {
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <MailIcon className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="font-heading text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((invitation) => {
          const Icon = TYPE_ICONS[invitation.accountType];
          const isAccepting = acceptingId === invitation.id;

          return (
            <div
              key={invitation.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{invitation.accountName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`type.${invitation.accountType}`)} &middot;{" "}
                    {tMembers(`role.${invitation.role}` as Parameters<typeof tMembers>[0])}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                disabled={acceptingId !== null}
                onClick={() => handleAccept(invitation.id)}
              >
                {isAccepting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckIcon className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("accept")}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
