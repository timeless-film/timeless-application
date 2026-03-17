"use client";

import { Building2, Check, Loader2, Plus, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { InviteSection } from "@/components/account/invite-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Link, useRouter } from "@/i18n/navigation";
import { getCountryOptions } from "@/lib/countries";
import { getCurrencyOptions } from "@/lib/currencies";

import { addOnboardingCinema, completeOnboarding, submitOnboardingStep1 } from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface OnboardingAccount {
  id: string;
  companyName: string;
  country: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  vatNumber: string | null;
  preferredCurrency: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  cinemaType: string | null;
}

interface OnboardingCinema {
  id: string;
  name: string;
  city: string;
  country: string;
  rooms: { id: string }[];
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
}

interface OnboardingStepperProps {
  initialStep: 1 | 2 | 3;
  account: OnboardingAccount | null;
  cinemas: OnboardingCinema[];
  invitations: PendingInvitation[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OnboardingStepper({
  initialStep,
  account,
  cinemas: initialCinemas,
  invitations,
}: OnboardingStepperProps) {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [addedCinemas, setAddedCinemas] = useState<OnboardingCinema[]>(initialCinemas);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        {/* Step indicator */}
        <StepIndicator currentStep={step} />

        {step === 1 && (
          <Step1Form
            account={account}
            locale={locale}
            loading={loading}
            onSubmit={async (data) => {
              setLoading(true);
              const result = await submitOnboardingStep1(data);
              if ("error" in result) {
                toast.error(t(`error.${result.error}`));
              } else {
                setStep(2);
              }
              setLoading(false);
            }}
          />
        )}

        {step === 2 && (
          <Step2Cinemas
            account={account}
            cinemas={addedCinemas}
            locale={locale}
            loading={loading}
            onAddCinema={async (data) => {
              setLoading(true);
              const result = await addOnboardingCinema(data);
              if ("error" in result) {
                toast.error(t(`error.${result.error}`));
              } else if ("cinema" in result && result.cinema) {
                setAddedCinemas((prev) => [
                  ...prev,
                  {
                    id: result.cinema!.id,
                    name: result.cinema!.name,
                    city: result.cinema!.city ?? "",
                    country: result.cinema!.country,
                    rooms: [{ id: "default" }],
                  },
                ]);
                toast.success(t("step2.cinemaAdded"));
              }
              setLoading(false);
            }}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <Step3Invite
            invitations={invitations}
            loading={loading}
            onFinish={async () => {
              setLoading(true);
              const result = await completeOnboarding();
              if ("error" in result) {
                toast.error(t(`error.${result.error}`));
              } else {
                router.replace("/home");
              }
              setLoading(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  const t = useTranslations("onboarding");

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("step", { current: currentStep, total: 3 })}
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              s < currentStep
                ? "bg-primary text-primary-foreground"
                : s === currentStep
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {s < currentStep ? <Check className="h-4 w-4" /> : s}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1 — Company information ─────────────────────────────────────────────

interface Step1FormProps {
  account: OnboardingAccount | null;
  locale: string;
  loading: boolean;
  onSubmit: (data: {
    companyName: string;
    country: string;
    address?: string;
    city?: string;
    postalCode?: string;
    vatNumber?: string;
    preferredCurrency?: string;
    contactEmail?: string;
    contactPhone?: string;
    cinemaType?: string;
    acceptTermsOfSale?: boolean;
  }) => void;
}

function Step1Form({ account, locale, loading, onSubmit }: Step1FormProps) {
  const t = useTranslations("onboarding.step1");
  const tCommon = useTranslations("common");

  const countryOptions = useMemo(() => getCountryOptions(locale), [locale]);
  const currencyOptions = useMemo(() => getCurrencyOptions(locale), [locale]);

  const [companyName, setCompanyName] = useState(account?.companyName ?? "");
  const [country, setCountry] = useState(account?.country ?? "FR");
  const [address, setAddress] = useState(account?.address ?? "");
  const [city, setCity] = useState(account?.city ?? "");
  const [postalCode, setPostalCode] = useState(account?.postalCode ?? "");
  const [vatNumber, setVatNumber] = useState(account?.vatNumber ?? "");
  const [preferredCurrency, setPreferredCurrency] = useState(account?.preferredCurrency ?? "EUR");
  const [contactEmail, setContactEmail] = useState(account?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(account?.contactPhone ?? "");
  const [cinemaType, setCinemaType] = useState(account?.cinemaType ?? "");
  const [acceptTermsOfSale, setAcceptTermsOfSale] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      companyName,
      country,
      address: address || undefined,
      city: city || undefined,
      postalCode: postalCode || undefined,
      vatNumber: vatNumber || undefined,
      preferredCurrency,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      cinemaType: cinemaType || undefined,
      acceptTermsOfSale,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Company name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">
              {t("companyName")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Country + Cinema type */}
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
                disabled={loading}
                searchPlaceholder={tCommon("search")}
                emptyMessage={tCommon("noResults")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cinemaType">{t("cinemaType")}</Label>
              <Select value={cinemaType} onValueChange={setCinemaType} disabled={loading}>
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
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">
              {t("address")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("addressPlaceholder")}
              disabled={loading}
              required
            />
          </div>

          {/* City + Postal code */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">
                {t("city")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">
                {t("postalCode")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* VAT */}
          <div className="space-y-2">
            <Label htmlFor="vatNumber">{t("vatNumber")}</Label>
            <Input
              id="vatNumber"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder={t("vatPlaceholder")}
              disabled={loading}
            />
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <Label htmlFor="preferredCurrency">{t("preferredCurrency")}</Label>
            <SearchableSelect
              id="preferredCurrency"
              options={currencyOptions}
              value={preferredCurrency}
              onValueChange={setPreferredCurrency}
              disabled={loading}
              searchPlaceholder={tCommon("search")}
              emptyMessage={tCommon("noResults")}
            />
          </div>

          {/* Contact email + phone */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">{t("contactEmail")}</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={t("contactEmailPlaceholder")}
                disabled={loading}
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
                disabled={loading}
              />
            </div>
          </div>

          {/* Terms of Sale */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="accept-terms-of-sale"
              checked={acceptTermsOfSale}
              onCheckedChange={(checked) => setAcceptTermsOfSale(checked === true)}
              disabled={loading}
              required
            />
            <Label htmlFor="accept-terms-of-sale" className="text-sm font-normal leading-snug">
              {t.rich("termsOfSale", {
                link: (chunks) => (
                  <Link
                    href="/terms/sale"
                    target="_blank"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              loading ||
              !companyName.trim() ||
              !address.trim() ||
              !city.trim() ||
              !postalCode.trim() ||
              !acceptTermsOfSale
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("continue")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Step 2 — Cinemas and screens ─────────────────────────────────────────────

interface Step2CinemasProps {
  account: OnboardingAccount | null;
  cinemas: OnboardingCinema[];
  locale: string;
  loading: boolean;
  onAddCinema: (data: {
    name: string;
    country: string;
    city: string;
    address?: string;
    postalCode?: string;
  }) => void;
  onContinue: () => void;
}

function Step2Cinemas({
  account,
  cinemas,
  locale,
  loading,
  onAddCinema,
  onContinue,
}: Step2CinemasProps) {
  const t = useTranslations("onboarding.step2");
  const tCommon = useTranslations("common");
  const countryOptions = useMemo(() => getCountryOptions(locale), [locale]);

  const [showForm, setShowForm] = useState(cinemas.length === 0);
  const [cinemaName, setCinemaName] = useState("");
  const [cinemaCountry, setCinemaCountry] = useState(account?.country ?? "FR");
  const [cinemaCity, setCinemaCity] = useState(account?.city ?? "");
  const [cinemaAddress, setCinemaAddress] = useState(account?.address ?? "");
  const [cinemaPostalCode, setCinemaPostalCode] = useState(account?.postalCode ?? "");

  function handleAddCinema(e: React.FormEvent) {
    e.preventDefault();
    onAddCinema({
      name: cinemaName,
      country: cinemaCountry,
      city: cinemaCity,
      address: cinemaAddress || undefined,
      postalCode: cinemaPostalCode || undefined,
    });
    // Reset form
    setCinemaName("");
    setCinemaCity(account?.city ?? "");
    setCinemaAddress(account?.address ?? "");
    setCinemaPostalCode(account?.postalCode ?? "");
    setShowForm(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cinema list */}
        {cinemas.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t("cinemaList")}</h3>
            {cinemas.map((cinema) => (
              <div key={cinema.id} className="flex items-center gap-3 rounded-md border p-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{cinema.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cinema.city}, {cinema.country} &middot;{" "}
                    {t("rooms", { count: cinema.rooms.length })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add cinema form */}
        {showForm ? (
          <form onSubmit={handleAddCinema} className="space-y-4 rounded-md border p-4">
            <h3 className="text-sm font-medium">{t("addCinema")}</h3>

            <div className="space-y-2">
              <Label htmlFor="cinemaName">
                {t("cinemaName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cinemaName"
                value={cinemaName}
                onChange={(e) => setCinemaName(e.target.value)}
                placeholder={t("cinemaNamePlaceholder")}
                disabled={loading}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cinemaCountry">
                  {t("country")} <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  id="cinemaCountry"
                  options={countryOptions}
                  value={cinemaCountry}
                  onValueChange={setCinemaCountry}
                  disabled={loading}
                  searchPlaceholder={tCommon("search")}
                  emptyMessage={tCommon("noResults")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cinemaCity">
                  {t("city")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cinemaCity"
                  value={cinemaCity}
                  onChange={(e) => setCinemaCity(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cinemaAddress">{t("address")}</Label>
              <Input
                id="cinemaAddress"
                value={cinemaAddress}
                onChange={(e) => setCinemaAddress(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cinemaPostalCode">{t("postalCode")}</Label>
              <Input
                id="cinemaPostalCode"
                value={cinemaPostalCode}
                onChange={(e) => setCinemaPostalCode(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={loading || !cinemaName.trim() || !cinemaCity.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("addCinemaButton")}
            </Button>
          </form>
        ) : (
          <Button variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addCinema")}
          </Button>
        )}

        {/* Continue or warning */}
        {cinemas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCinemas")}</p>
        ) : (
          <Button className="w-full" onClick={onContinue} disabled={loading}>
            {t("continue")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Step 3 — Invite team ─────────────────────────────────────────────────────

interface Step3InviteProps {
  invitations: PendingInvitation[];
  loading: boolean;
  onFinish: () => void;
}

function Step3Invite({ invitations, loading, onFinish }: Step3InviteProps) {
  const t = useTranslations("onboarding.step3");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
      </Card>

      <InviteSection initialInvitations={invitations} />

      <div className="flex gap-3">
        <Button variant="outline" onClick={onFinish} disabled={loading} className="flex-1">
          {t("skip")}
        </Button>
        <Button onClick={onFinish} disabled={loading} className="flex-1">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("finish")}
        </Button>
      </div>
    </div>
  );
}
