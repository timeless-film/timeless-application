import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { LanguageSelector } from "@/components/profile/language-selector";
import { ProfileInfoForm } from "@/components/profile/profile-info-form";
import { auth } from "@/lib/auth";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return {
    title: t("title"),
  };
}

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="space-y-6">
      <ProfileInfoForm
        initialName={session?.user.name ?? ""}
        initialEmail={session?.user.email ?? ""}
      />
      <ChangePasswordForm />
      <LanguageSelector />
    </div>
  );
}
