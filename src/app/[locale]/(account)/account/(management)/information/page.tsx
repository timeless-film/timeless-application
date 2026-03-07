import { getTranslations } from "next-intl/server";

import { AccountInfoForm } from "@/components/account/account-info-form";
import { getAccountInfo } from "@/components/account/actions";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accountSettings");
  return {
    title: t("title"),
  };
}

export default async function InformationPage() {
  const result = await getAccountInfo();

  if ("error" in result) {
    return null;
  }

  const canEdit = result.currentUserRole === "owner" || result.currentUserRole === "admin";

  return <AccountInfoForm account={result.account} canEdit={canEdit} />;
}
