import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog");
  return {
    title: t("title"),
  };
}

export default async function CatalogPage() {
  const t = await getTranslations("catalog");

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6">
      <h1 className="font-heading text-3xl">{t("title")}</h1>
      <p className="text-muted-foreground">{t("searchPlaceholder")}</p>
    </div>
  );
}
