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
import { usePathname, useRouter } from "@/i18n/navigation";
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
    <footer className="border-t border-border/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 text-sm text-muted-foreground lg:px-6">
        <p>{t("copyright", { year: new Date().getFullYear() })}</p>
        <div className="flex items-center gap-1">
          {/* Language */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSwitchLanguage}
            className="gap-2 text-muted-foreground hover:text-foreground"
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
                className="gap-1 text-muted-foreground hover:text-foreground"
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
    </footer>
  );
}
