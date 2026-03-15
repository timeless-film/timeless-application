"use client";

import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";

import type { Locale } from "@/i18n/routing";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "FR",
  fr: "EN",
};

const LOCALE_TARGETS: Record<Locale, Locale> = {
  en: "fr",
  fr: "en",
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  function handleSwitch() {
    const target = LOCALE_TARGETS[locale];
    router.replace(pathname, { locale: target });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSwitch}
      className={className ?? "text-muted-foreground hover:text-foreground"}
    >
      {LOCALE_LABELS[locale]}
    </Button>
  );
}
