"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCountryOptions } from "@/lib/countries";
import { getCurrencyOptions } from "@/lib/currencies";

import { checkVatNumber, updateAccountInfo } from "./actions";

const CINEMA_TYPES = [
  "art_house",
  "circuit",
  "municipal",
  "independent",
  "festival",
  "cine_club",
  "cultural_center",
  "other",
] as const;

interface AccountInfoFormProps {
  account: {
    id: string;
    type: string;
    companyName: string;
    country: string;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    vatNumber: string | null;
    vatValidated: boolean | null;
    preferredCurrency: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    cinemaType: string | null;
  };
  canEdit: boolean;
}

export function AccountInfoForm({ account, canEdit }: AccountInfoFormProps) {
  const t = useTranslations("accountSettings");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const countryOptions = useMemo(() => getCountryOptions(locale), [locale]);
  const currencyOptions = useMemo(() => getCurrencyOptions(locale), [locale]);

  const [companyName, setCompanyName] = useState(account.companyName);
  const [country, setCountry] = useState(account.country);
  const [address, setAddress] = useState(account.address ?? "");
  const [city, setCity] = useState(account.city ?? "");
  const [postalCode, setPostalCode] = useState(account.postalCode ?? "");
  const [vatNumber, setVatNumber] = useState(account.vatNumber ?? "");
  const [vatStatus, setVatStatus] = useState<"idle" | "checking" | "valid" | "invalid_format">(
    account.vatValidated ? "valid" : "idle"
  );
  const [vatError, setVatError] = useState<string | null>(null);
  const vatCheckAbort = useRef<AbortController | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState(account.preferredCurrency ?? "EUR");
  const [contactEmail, setContactEmail] = useState(account.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(account.contactPhone ?? "");
  const [cinemaType, setCinemaType] = useState(account.cinemaType ?? "");
  const [saving, setSaving] = useState(false);

  const handleVatChange = useCallback((value: string) => {
    setVatNumber(value);
    setVatError(null);
    if (!value.trim()) {
      setVatStatus("idle");
    }
  }, []);

  const handleVatBlur = useCallback(async () => {
    const trimmed = vatNumber.trim();
    if (!trimmed) {
      setVatStatus("idle");
      return;
    }

    // Cancel any in-flight check
    vatCheckAbort.current?.abort();
    const abort = new AbortController();
    vatCheckAbort.current = abort;

    setVatStatus("checking");
    setVatError(null);

    const result = await checkVatNumber(trimmed);

    // Ignore if this check was superseded
    if (abort.signal.aborted) return;

    switch (result.status) {
      case "valid":
        setVatStatus("valid");
        break;
      case "invalid_format":
        setVatStatus("invalid_format");
        setVatError(t("vatInvalidFormat"));
        break;
      default:
        setVatStatus("idle");
    }
  }, [vatNumber, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!companyName.trim()) return;

    setSaving(true);
    const result = await updateAccountInfo({
      companyName: companyName.trim(),
      country,
      address: address || undefined,
      city: city || undefined,
      postalCode: postalCode || undefined,
      vatNumber: vatNumber || undefined,
      preferredCurrency,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      cinemaType: cinemaType || undefined,
    });

    if ("error" in result) {
      if ("field" in result && result.field === "vatNumber") {
        setVatError(t(`error.${result.error}`));
        setVatStatus("invalid_format");
      } else {
        toast.error(t(`error.${result.error}`));
      }
    } else {
      toast.success(t("saved"));
      // Update VAT validated status after successful save
      if (vatNumber.trim()) {
        setVatStatus((prev) => (prev === "valid" ? "valid" : prev));
      }
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">
              {t("companyName")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={!canEdit || saving}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="country">
                {t("country")} <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="country"
                options={countryOptions}
                value={country}
                onValueChange={setCountry}
                disabled={!canEdit || saving}
                searchPlaceholder={tCommon("search")}
                emptyMessage={tCommon("noResults")}
              />
            </div>

            {account.type === "exhibitor" && (
              <div className="space-y-2">
                <Label htmlFor="cinemaType">{t("cinemaType")}</Label>
                <Select
                  value={cinemaType}
                  onValueChange={setCinemaType}
                  disabled={!canEdit || saving}
                >
                  <SelectTrigger id="cinemaType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CINEMA_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`cinemaTypeOptions.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vatNumber">{t("vatNumber")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="vatNumber"
                  value={vatNumber}
                  onChange={(e) => handleVatChange(e.target.value)}
                  onBlur={handleVatBlur}
                  placeholder={t("vatPlaceholder")}
                  disabled={!canEdit || saving}
                  aria-invalid={vatStatus === "invalid_format"}
                  className={
                    vatStatus === "invalid_format"
                      ? "border-destructive"
                      : vatStatus === "valid"
                        ? "border-green-500"
                        : undefined
                  }
                />
                {vatStatus === "checking" && (
                  <span className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("vatChecking")}
                  </span>
                )}
                {vatStatus === "valid" && (
                  <span className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {t("vatValidated")}
                  </span>
                )}
              </div>
              {vatError && vatStatus === "invalid_format" && (
                <p className="text-sm text-destructive">{vatError}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t("address")}</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("addressPlaceholder")}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">{t("city")}</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postalCode">{t("postalCode")}</Label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                disabled={!canEdit || saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferredCurrency">{t("preferredCurrency")}</Label>
            <SearchableSelect
              id="preferredCurrency"
              options={currencyOptions}
              value={preferredCurrency}
              onValueChange={setPreferredCurrency}
              disabled={!canEdit || saving}
              searchPlaceholder={tCommon("search")}
              emptyMessage={tCommon("noResults")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">{t("contactEmail")}</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={t("contactEmailPlaceholder")}
                disabled={!canEdit || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">{t("contactPhone")}</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder={t("contactPhonePlaceholder")}
                disabled={!canEdit || saving}
              />
            </div>
          </div>

          {canEdit && (
            <Button type="submit" disabled={saving || !companyName.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
