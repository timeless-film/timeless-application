import { getTranslations } from "next-intl/server";

import { ProfileTabs } from "@/components/profile/profile-tabs";

import type { ReactNode } from "react";

export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("profile");

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 lg:px-6">
      <div>
        <h1 className="font-heading text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("titleDescription")}</p>
      </div>
      <ProfileTabs />
      {children}
    </div>
  );
}
