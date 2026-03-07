import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.rightsHolders");
  return {
    title: t("title"),
  };
}

export default async function RightsHoldersPage() {
  const t = await getTranslations("admin.rightsHolders");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
    </div>
  );
}
