import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return {
    title: t("title"),
  };
}

export default async function OrdersPage() {
  const t = await getTranslations("orders");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("columns.film")}</p>
    </div>
  );
}
