import { getTranslations } from "next-intl/server";

import { ExhibitorList } from "@/components/admin/exhibitor-list";
import { listAccountsForAdmin } from "@/lib/services/admin-accounts-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.exhibitors");
  return {
    title: t("title"),
  };
}

export default async function ExhibitorsPage() {
  const t = await getTranslations("admin.exhibitors");

  const { accounts, total } = await listAccountsForAdmin({
    type: "exhibitor",
    page: 1,
    limit: 20,
  });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <ExhibitorList initialAccounts={accounts} initialTotal={total} />
    </div>
  );
}
