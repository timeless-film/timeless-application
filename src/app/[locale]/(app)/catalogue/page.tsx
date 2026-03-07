import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalogue");
  return {
    title: t("title"),
  };
}

export default async function CataloguePage() {
  const t = await getTranslations("catalogue");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("searchPlaceholder")}</p>
    </div>
  );
}
