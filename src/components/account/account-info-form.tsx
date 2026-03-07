"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { updateAccountInfo } from "./actions";

const COUNTRIES = [
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "LU", label: "Luxembourg" },
  { code: "CA", label: "Canada" },
  { code: "DE", label: "Deutschland" },
  { code: "GB", label: "United Kingdom" },
  { code: "IT", label: "Italia" },
  { code: "ES", label: "España" },
  { code: "US", label: "United States" },
];

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
  };
  canEdit: boolean;
}

export function AccountInfoForm({ account, canEdit }: AccountInfoFormProps) {
  const t = useTranslations("accountSettings");

  const [companyName, setCompanyName] = useState(account.companyName);
  const [country, setCountry] = useState(account.country);
  const [address, setAddress] = useState(account.address ?? "");
  const [city, setCity] = useState(account.city ?? "");
  const [postalCode, setPostalCode] = useState(account.postalCode ?? "");
  const [vatNumber, setVatNumber] = useState(account.vatNumber ?? "");
  const [saving, setSaving] = useState(false);

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
    });

    if ("error" in result) {
      toast.error(t(`error.${result.error}`));
    } else {
      toast.success(t("saved"));
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
              <Select value={country} onValueChange={setCountry} disabled={!canEdit || saving}>
                <SelectTrigger id="country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vatNumber">{t("vatNumber")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="vatNumber"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder={t("vatPlaceholder")}
                  disabled={!canEdit || saving}
                />
                {account.vatValidated && (
                  <span className="whitespace-nowrap text-xs font-medium text-green-600">
                    {t("vatValidated")}
                  </span>
                )}
              </div>
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
