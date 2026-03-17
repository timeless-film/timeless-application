"use client";

import { LogOut, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { signOutAndCleanup } from "@/lib/auth/client";

export function LegalHeader() {
  const t = useTranslations("navigation");

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <span className="font-heading text-lg tracking-tight">Timeless</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts">
            <Users className="mr-2 h-4 w-4" />
            {t("myAccounts")}
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={signOutAndCleanup}>
          <LogOut className="mr-2 h-4 w-4" />
          {t("signOut")}
        </Button>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
