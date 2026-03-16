"use client";

import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getCountryOptions } from "@/lib/countries";
import { getCurrencyOptions } from "@/lib/currencies";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceZone {
  countries: string[];
  price: number;
  currency: string;
}

interface PriceZonesEditorProps {
  zones: PriceZone[];
  onChange: (zones: PriceZone[]) => void;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PriceZonesEditor({ zones, onChange, disabled }: PriceZonesEditorProps) {
  const t = useTranslations("films.form");
  const locale = useLocale();

  const countryOptions = useMemo(() => getCountryOptions(locale), [locale]);
  const currencyOptions = useMemo(() => getCurrencyOptions(locale), [locale]);

  function addZone() {
    onChange([...zones, { countries: [], price: 0, currency: "EUR" }]);
  }

  function removeZone(index: number) {
    onChange(zones.filter((_, i) => i !== index));
  }

  function updateZone(index: number, field: keyof PriceZone, value: PriceZone[keyof PriceZone]) {
    const updated = zones.map((zone, i) => (i === index ? { ...zone, [field]: value } : zone));
    onChange(updated);
  }

  function toggleCountry(zoneIndex: number, countryCode: string) {
    const zone = zones[zoneIndex];
    if (!zone) return;

    const hasCountry = zone.countries.includes(countryCode);
    const updatedCountries = hasCountry
      ? zone.countries.filter((c) => c !== countryCode)
      : [...zone.countries, countryCode];

    updateZone(zoneIndex, "countries", updatedCountries);
  }

  // Collect all countries already used in OTHER zones
  function getUsedCountries(excludeIndex: number) {
    const used = new Set<string>();
    for (let i = 0; i < zones.length; i++) {
      if (i !== excludeIndex) {
        const zone = zones[i];
        if (zone) {
          for (const c of zone.countries) {
            used.add(c);
          }
        }
      }
    }
    return used;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t("prices")}</Label>
        <Button type="button" variant="outline" size="sm" onClick={addZone} disabled={disabled}>
          <Plus className="mr-1 size-3" />
          {t("addZone")}
        </Button>
      </div>

      {zones.map((zone, index) => {
        const usedCountries = getUsedCountries(index);
        const availableCountries = countryOptions.filter((o) => !usedCountries.has(o.value));

        return (
          <div key={index} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Zone {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeZone(index)}
                disabled={disabled}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 size-3" />
                {t("removeZone")}
              </Button>
            </div>

            {/* Countries multi-select (via SearchableSelect per country + tags) */}
            <div className="space-y-2">
              <Label>{t("countries")}</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {zone.countries.map((countryCode) => {
                  const option = countryOptions.find((o) => o.value === countryCode);
                  return (
                    <button
                      key={countryCode}
                      type="button"
                      onClick={() => toggleCountry(index, countryCode)}
                      disabled={disabled}
                      className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    >
                      {option?.label ?? countryCode}
                      <span aria-hidden>&times;</span>
                    </button>
                  );
                })}
              </div>
              <SearchableSelect
                options={availableCountries}
                value=""
                onValueChange={(code) => toggleCountry(index, code)}
                placeholder={t("countries")}
                searchPlaceholder={t("countriesHint")}
                emptyMessage={t("countriesHint")}
                disabled={disabled}
              />
            </div>

            {/* Price + Currency side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`price-${index}`}>{t("price")}</Label>
                <PriceInput
                  id={`price-${index}`}
                  cents={zone.price}
                  onCentsChange={(cents) => updateZone(index, "price", cents)}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`currency-${index}`}>{t("currency")}</Label>
                <SearchableSelect
                  id={`currency-${index}`}
                  options={currencyOptions}
                  value={zone.currency}
                  onValueChange={(val) => updateZone(index, "currency", val)}
                  placeholder={t("currency")}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Price Input ──────────────────────────────────────────────────────────────

/** Text-based price input that stores cents internally but lets the user type freely in euros/dollars. */
function centsToDisplay(cents: number): string {
  return cents ? (cents / 100).toString() : "";
}

function PriceInput({
  id,
  cents,
  onCentsChange,
  disabled,
}: {
  id: string;
  cents: number;
  onCentsChange: (cents: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(centsToDisplay(cents));
  const [prevCents, setPrevCents] = useState(cents);

  // React-recommended pattern: adjust state during render when prop changes
  if (cents !== prevCents) {
    setPrevCents(cents);
    setText(centsToDisplay(cents));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow empty, digits, and one decimal separator (dot or comma)
    if (raw !== "" && !/^\d*[.,]?\d{0,2}$/.test(raw)) return;
    setText(raw);
  }

  function commitValue() {
    const normalized = text.replace(",", ".");
    const parsed = parseFloat(normalized);
    const newCents = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
    setPrevCents(newCents);
    onCentsChange(newCents);
    // Re-format on blur for clean display
    setText(newCents ? (newCents / 100).toFixed(2) : "");
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onBlur={commitValue}
      disabled={disabled}
    />
  );
}
