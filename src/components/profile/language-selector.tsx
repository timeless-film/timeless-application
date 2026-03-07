"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";

import type { Locale } from "@/i18n/routing";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

export function LanguageSelector() {
  const t = useTranslations("profile");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  function handleChange(value: string) {
    router.replace(pathname, { locale: value as Locale });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t("language")}
        </CardTitle>
        <CardDescription>{t("languageDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="language">{t("preferredLanguage")}</Label>
          <Select value={locale} onValueChange={handleChange}>
            <SelectTrigger id="language" className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{LOCALE_LABELS.en}</SelectItem>
              <SelectItem value="fr">{LOCALE_LABELS.fr}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
