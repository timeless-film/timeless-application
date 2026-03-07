import { MailIcon, PlusCircleIcon } from "lucide-react";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { getMyPendingInvitations } from "@/components/account/actions";
import { PendingInvitations } from "@/components/account/pending-invitations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";

import type { PendingInvitationInfo } from "@/components/account/pending-invitations";

export default async function NoAccountPage() {
  const t = await getTranslations("noAccount");

  const session = await auth.api.getSession({ headers: await headers() });
  let pendingInvitations: PendingInvitationInfo[] = [];

  if (session) {
    const result = await getMyPendingInvitations();
    if (result.invitations) {
      pendingInvitations = result.invitations.map((inv) => ({
        ...inv,
        expiresAt: new Date(inv.expiresAt),
      }));
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {pendingInvitations.length > 0 && (
        <PendingInvitations invitations={pendingInvitations} redirectAfterAccept="/accounts" />
      )}
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-2xl">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/onboarding">
              <PlusCircleIcon className="mr-2 h-4 w-4" />
              {t("createAccount")}
            </Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <a href="mailto:support@timeless.film">
              <MailIcon className="mr-2 h-4 w-4" />
              {t("contactSupport")}
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
