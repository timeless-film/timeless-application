import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AccountTabs } from "@/components/account/account-tabs";
import { getCurrentMembership } from "@/lib/auth/membership";

import type { ReactNode } from "react";

export default async function ManagementLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("accountSettings");
  const ctx = await getCurrentMembership();

  // RBAC: only owner and admin can access account management
  if (!ctx || (ctx.role !== "owner" && ctx.role !== "admin")) {
    const isRightsHolder = ctx?.account.type === "rights_holder";
    const isAdmin = ctx?.account.type === "admin";
    redirect(isAdmin ? "/dashboard" : isRightsHolder ? "/films" : "/catalog");
  }

  const isExhibitor = ctx.account.type === "exhibitor";

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 lg:px-6">
      <div>
        <h1 className="font-heading text-2xl">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("headingDescription")}</p>
      </div>
      <AccountTabs showCinemas={isExhibitor} showApi />
      {children}
    </div>
  );
}
