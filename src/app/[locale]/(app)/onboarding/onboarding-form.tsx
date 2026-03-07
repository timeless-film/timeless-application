"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createExhibitorAccount } from "./actions";

const COUNTRIES = [
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgium" },
  { code: "CH", label: "Switzerland" },
  { code: "LU", label: "Luxembourg" },
  { code: "DE", label: "Germany" },
  { code: "GB", label: "United Kingdom" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "PT", label: "Portugal" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
];

export function OnboardingForm() {
  const t = useTranslations("onboarding");
  const locale = useLocale();

  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("FR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await createExhibitorAccount({
        companyName,
        country,
      });

      if (result.error) {
        const msg = t(`error.${result.error}`);
        setError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      toast.success(t("success"));
      // Hard navigation to avoid race condition with Next.js auto-refresh
      // triggered by cookie changes in the server action
      window.location.href = `/${locale}/catalog`;
    } catch {
      // The server action sets a cookie via cookies().set(), which can trigger
      // a Next.js auto-refresh that aborts the in-flight fetch before the
      // result is delivered to the client. If this happens, the account was
      // most likely created and the cookie was set. Navigate to catalog —
      // if the account wasn't created, proxy.ts will redirect to root
      // for account resolution.
      window.location.href = `/${locale}/catalog`;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  {t("companyName")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">
                  {t("country")} <span className="text-destructive">*</span>
                </Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
                  required
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                {t("submit")}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
