"use client";

import { CheckIcon, ChevronsUpDownIcon, GlobeIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updatePreferredCurrency } from "@/components/account/actions";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { getCurrencyOptions } from "@/lib/currencies";
import { cn } from "@/lib/utils";

import type { Locale } from "@/i18n/routing";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

const LOCALE_TARGETS: Record<Locale, Locale> = {
  en: "fr",
  fr: "en",
};

function getCurrencySymbol(code: string, locale: string): string {
  try {
    return (
      new Intl.NumberFormat(locale, { style: "currency", currency: code })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? code
    );
  } catch {
    return code;
  }
}

interface MarketplaceFooterProps {
  initialCurrency: string;
}

export function MarketplaceFooter({ initialCurrency }: MarketplaceFooterProps) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("footer");

  const [currency, setCurrency] = useState(initialCurrency);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currencyOptions = getCurrencyOptions(locale);
  const currencySymbol = getCurrencySymbol(currency, locale);

  function handleSwitchLanguage() {
    const target = LOCALE_TARGETS[locale];
    router.replace(pathname, { locale: target });
  }

  function handleCurrencyChange(value: string) {
    setCurrency(value);
    setCurrencyOpen(false);
    startTransition(async () => {
      const result = await updatePreferredCurrency(value);
      if (result.error) {
        console.error("[Footer] Failed to update currency:", result.error);
        setCurrency(initialCurrency);
        return;
      }
      toast.success(t("currencyUpdated"));
    });
  }

  return (
    <footer className="border-t border-white/10 bg-[oklch(0.10_0_0)]">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between text-sm text-white/50">
          <p>{t("copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-1">
            {/* Language */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwitchLanguage}
              className="gap-2 text-white/50 hover:bg-white/10 hover:text-white"
            >
              <GlobeIcon className="h-4 w-4" />
              {LOCALE_LABELS[locale]}
            </Button>

            {/* Currency */}
            <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  role="combobox"
                  aria-expanded={currencyOpen}
                  disabled={isPending}
                  className="gap-1 text-white/50 hover:bg-white/10 hover:text-white"
                >
                  {currencySymbol} {currency}
                  <ChevronsUpDownIcon className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <Command>
                  <CommandInput placeholder={t("searchCurrency")} />
                  <CommandList>
                    <CommandEmpty>{t("noCurrencyFound")}</CommandEmpty>
                    <CommandGroup>
                      {currencyOptions.map((opt) => (
                        <CommandItem
                          key={opt.value}
                          value={opt.label}
                          onSelect={() => handleCurrencyChange(opt.value)}
                        >
                          {opt.label}
                          <CheckIcon
                            className={cn(
                              "ml-auto h-4 w-4",
                              currency === opt.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 border-t border-white/5 pt-3 text-xs text-white/40">
          <Link href="/terms" className="hover:text-white/70">
            {t("termsOfService")}
          </Link>
          <Link href="/terms/sale" className="hover:text-white/70">
            {t("termsOfSale")}
          </Link>
          <Link href="/privacy" className="hover:text-white/70">
            {t("privacyPolicy")}
          </Link>
          <Link href="/legal" className="hover:text-white/70">
            {t("legalNotices")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
