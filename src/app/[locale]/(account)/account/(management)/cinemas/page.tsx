import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accountSettings");
  return {
    title: t("tabs.cinemas"),
  };
}

export default async function CinemasPage() {
  const t = await getTranslations("accountSettings");

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("cinemasPlaceholder")}</p>
    </div>
  );
}
