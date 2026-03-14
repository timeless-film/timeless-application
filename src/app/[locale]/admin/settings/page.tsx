import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { getPlatformPricingSettings } from "@/lib/pricing";

import { PlatformSettingsForm } from "./platform-settings-form";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings");
  return {
    title: t("title"),
  };
}

export default async function SettingsPage() {
  const t = await getTranslations("admin.settings");

  const [settings, history] = await Promise.all([
    getPlatformPricingSettings(),
    db.query.platformSettingsHistory.findMany({
      orderBy: (h, { desc }) => desc(h.changedAt),
      limit: 50,
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <PlatformSettingsForm initialSettings={settings} initialHistory={history} />
    </div>
  );
}
