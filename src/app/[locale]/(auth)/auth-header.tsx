"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Button } from "@/components/ui/button";
import { signOutAndCleanup } from "@/lib/auth/client";

export function AuthHeader({ hasSession }: { hasSession: boolean }) {
  const t = useTranslations("navigation");

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <span className="font-heading text-lg tracking-tight text-white">Timeless</span>
      <div className="flex items-center gap-2">
        {hasSession && (
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white"
            onClick={signOutAndCleanup}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("signOut")}
          </Button>
        )}
        <LanguageSwitcher />
      </div>
    </div>
  );
}
