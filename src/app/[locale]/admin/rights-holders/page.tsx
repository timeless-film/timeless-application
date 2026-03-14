import { getTranslations } from "next-intl/server";

import { RightsHolderList } from "@/components/admin/rights-holder-list";
import { getPlatformPricingSettings } from "@/lib/pricing";
import { listAccountsForAdmin } from "@/lib/services/admin-accounts-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.rightsHolders");
  return {
    title: t("title"),
  };
}

export default async function RightsHoldersPage() {
  const t = await getTranslations("admin.rightsHolders");

  const [{ accounts, total }, settings] = await Promise.all([
    listAccountsForAdmin({
      type: "rights_holder",
      page: 1,
      limit: 20,
    }),
    getPlatformPricingSettings(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <RightsHolderList
        initialAccounts={accounts}
        initialTotal={total}
        defaultCommissionRate={settings.defaultCommissionRate}
      />
    </div>
  );
}
