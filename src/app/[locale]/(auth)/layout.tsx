import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";

import { AuthHeader } from "./auth-header";

import type { ReactNode } from "react";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const [t, session] = await Promise.all([
    getTranslations("footer"),
    auth.api.getSession({ headers: await headers() }),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[oklch(0.10_0_0)]">
      <AuthHeader hasSession={!!session} />
      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <div className="flex items-center justify-center gap-4 px-6 pb-6 text-xs text-white/40">
        <Link href="/terms" className="hover:text-white/70">
          {t("termsOfService")}
        </Link>
        <Link href="/privacy" className="hover:text-white/70">
          {t("privacyPolicy")}
        </Link>
        <Link href="/legal" className="hover:text-white/70">
          {t("legalNotices")}
        </Link>
      </div>
    </div>
  );
}
