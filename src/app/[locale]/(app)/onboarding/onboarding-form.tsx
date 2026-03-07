"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
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

import { createExhibitorAccountAction } from "./actions";

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

  // React 19 useActionState: the server action handles redirect() on success.
  // On error, it returns { error: "CODE" } which we render inline.
  // No try/catch, no client-side navigation — no race conditions.
  const [state, formAction, isPending] = useActionState(createExhibitorAccountAction, null);

  useEffect(() => {
    if (state?.error) {
      toast.error(t(`error.${state.error}`));
    }
  }, [state, t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <form action={formAction}>
            <input type="hidden" name="locale" value={locale} />
            <CardContent className="space-y-4">
              {state?.error && (
                <p className="text-sm text-destructive">{t(`error.${state.error}`)}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  {t("companyName")} <span className="text-destructive">*</span>
                </Label>
                <Input id="companyName" name="companyName" type="text" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">
                  {t("country")} <span className="text-destructive">*</span>
                </Label>
                <select
                  id="country"
                  name="country"
                  defaultValue="FR"
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
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="animate-spin" />}
                {t("submit")}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
