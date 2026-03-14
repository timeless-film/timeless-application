"use client";

import { useTranslations } from "next-intl";
import { useTransition, useState, useMemo } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calculatePricing } from "@/lib/pricing/calculations";
import { formatAmount } from "@/lib/pricing/format";

import { getSettingsHistory, updatePlatformSettings } from "./actions";

interface PlatformSettingsData {
  platformMarginRate: number; // e.g. 0.20
  deliveryFees: number; // cents
  defaultCommissionRate: number; // e.g. 0.10
  opsEmail: string;
  requestExpirationDays: number;
  requestUrgencyDaysBeforeStart: number;
  deliveryUrgencyDaysBeforeStart: number;
}

interface HistoryEntry {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  changedById: string;
  changedAt: Date;
}

interface PlatformSettingsFormProps {
  initialSettings: PlatformSettingsData;
  initialHistory: HistoryEntry[];
}

const PREVIEW_CATALOG_PRICE = 15000; // 150 EUR in cents

export function PlatformSettingsForm({
  initialSettings,
  initialHistory,
}: PlatformSettingsFormProps) {
  const t = useTranslations("admin.settings");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);

  // Form state — percentages and euros for user display
  const [platformMarginRate, setPlatformMarginRate] = useState(
    String(initialSettings.platformMarginRate * 100)
  );
  const [deliveryFees, setDeliveryFees] = useState(String(initialSettings.deliveryFees / 100));
  const [defaultCommissionRate, setDefaultCommissionRate] = useState(
    String(initialSettings.defaultCommissionRate * 100)
  );
  const [opsEmail, setOpsEmail] = useState(initialSettings.opsEmail);
  const [requestExpirationDays, setRequestExpirationDays] = useState(
    String(initialSettings.requestExpirationDays)
  );
  const [requestUrgencyDaysBeforeStart, setRequestUrgencyDaysBeforeStart] = useState(
    String(initialSettings.requestUrgencyDaysBeforeStart)
  );
  const [deliveryUrgencyDaysBeforeStart, setDeliveryUrgencyDaysBeforeStart] = useState(
    String(initialSettings.deliveryUrgencyDaysBeforeStart)
  );

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Live pricing preview
  const preview = useMemo(() => {
    const marginRate = parseFloat(platformMarginRate) / 100;
    const commissionRate = parseFloat(defaultCommissionRate) / 100;
    const fees = parseFloat(deliveryFees) * 100;

    if (isNaN(marginRate) || isNaN(commissionRate) || isNaN(fees)) return null;

    return calculatePricing({
      catalogPrice: PREVIEW_CATALOG_PRICE,
      currency: "EUR",
      platformMarginRate: marginRate,
      deliveryFees: fees,
      commissionRate: commissionRate,
    });
  }, [platformMarginRate, defaultCommissionRate, deliveryFees]);

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleSave() {
    setShowConfirmDialog(true);
  }

  function handleConfirm() {
    setShowConfirmDialog(false);
    startTransition(async () => {
      const result = await updatePlatformSettings({
        platformMarginRate: parseFloat(platformMarginRate),
        deliveryFees: parseFloat(deliveryFees),
        defaultCommissionRate: parseFloat(defaultCommissionRate),
        opsEmail,
        requestExpirationDays: parseInt(requestExpirationDays, 10),
        requestUrgencyDaysBeforeStart: parseInt(requestUrgencyDaysBeforeStart, 10),
        deliveryUrgencyDaysBeforeStart: parseInt(deliveryUrgencyDaysBeforeStart, 10),
      });

      if ("error" in result) {
        if ("field" in result && result.field) {
          setFieldErrors({ [result.field]: t(`error.${result.error}`) });
        } else {
          toast.error(t(`error.${result.error}`));
        }
        return;
      }

      toast.success(t("saved"));
      setFieldErrors({});

      // Refresh history
      const historyResult = await getSettingsHistory();
      if ("data" in historyResult && historyResult.data) {
        setHistory(historyResult.data);
      }
    });
  }

  function formatHistoryValue(field: string, value: string | null): string {
    if (value === null) return "—";
    if (field === "platformMarginRate" || field === "defaultCommissionRate") {
      return `${(parseFloat(value) * 100).toFixed(1)}%`;
    }
    if (field === "deliveryFees") {
      return formatAmount(parseInt(value, 10), "EUR");
    }
    return value;
  }

  return (
    <div className="space-y-6">
      {/* Pricing Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pricing.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="platformMarginRate">{t("pricing.platformMargin")}</Label>
              <Input
                id="platformMarginRate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={platformMarginRate}
                onChange={(e) => {
                  setPlatformMarginRate(e.target.value);
                  clearFieldError("platformMarginRate");
                }}
                aria-invalid={!!fieldErrors.platformMarginRate}
                className={fieldErrors.platformMarginRate ? "border-destructive" : ""}
                disabled={isPending}
              />
              {fieldErrors.platformMarginRate && (
                <p className="text-sm text-destructive">{fieldErrors.platformMarginRate}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryFees">{t("pricing.deliveryFees")}</Label>
              <Input
                id="deliveryFees"
                type="number"
                min="0"
                step="0.01"
                value={deliveryFees}
                onChange={(e) => {
                  setDeliveryFees(e.target.value);
                  clearFieldError("deliveryFees");
                }}
                aria-invalid={!!fieldErrors.deliveryFees}
                className={fieldErrors.deliveryFees ? "border-destructive" : ""}
                disabled={isPending}
              />
              {fieldErrors.deliveryFees && (
                <p className="text-sm text-destructive">{fieldErrors.deliveryFees}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultCommissionRate">{t("pricing.defaultCommission")}</Label>
              <Input
                id="defaultCommissionRate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={defaultCommissionRate}
                onChange={(e) => {
                  setDefaultCommissionRate(e.target.value);
                  clearFieldError("defaultCommissionRate");
                }}
                aria-invalid={!!fieldErrors.defaultCommissionRate}
                className={fieldErrors.defaultCommissionRate ? "border-destructive" : ""}
                disabled={isPending}
              />
              {fieldErrors.defaultCommissionRate && (
                <p className="text-sm text-destructive">{fieldErrors.defaultCommissionRate}</p>
              )}
            </div>
          </div>

          {/* Live Preview */}
          {preview && (
            <div className="rounded-md border bg-muted/50 p-4 text-sm">
              {t("pricing.preview", {
                catalogPrice: formatAmount(PREVIEW_CATALOG_PRICE, "EUR"),
                displayed: formatAmount(preview.displayedPrice, "EUR"),
                rightsHolder: formatAmount(preview.rightsHolderAmount, "EUR"),
                timeless: formatAmount(preview.timelessAmount, "EUR"),
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operations Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("operations.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="opsEmail">{t("operations.opsEmail")}</Label>
              <Input
                id="opsEmail"
                type="email"
                value={opsEmail}
                onChange={(e) => {
                  setOpsEmail(e.target.value);
                  clearFieldError("opsEmail");
                }}
                aria-invalid={!!fieldErrors.opsEmail}
                className={fieldErrors.opsEmail ? "border-destructive" : ""}
                disabled={isPending}
              />
              {fieldErrors.opsEmail && (
                <p className="text-sm text-destructive">{fieldErrors.opsEmail}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestExpirationDays">{t("operations.requestExpiration")}</Label>
              <Input
                id="requestExpirationDays"
                type="number"
                min="1"
                max="365"
                value={requestExpirationDays}
                onChange={(e) => {
                  setRequestExpirationDays(e.target.value);
                  clearFieldError("requestExpirationDays");
                }}
                aria-invalid={!!fieldErrors.requestExpirationDays}
                className={fieldErrors.requestExpirationDays ? "border-destructive" : ""}
                disabled={isPending}
              />
              {fieldErrors.requestExpirationDays && (
                <p className="text-sm text-destructive">{fieldErrors.requestExpirationDays}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestUrgencyDaysBeforeStart">{t("operations.urgencyDays")}</Label>
              <Input
                id="requestUrgencyDaysBeforeStart"
                type="number"
                min="1"
                max="90"
                value={requestUrgencyDaysBeforeStart}
                onChange={(e) => {
                  setRequestUrgencyDaysBeforeStart(e.target.value);
                  clearFieldError("requestUrgencyDaysBeforeStart");
                }}
                aria-invalid={!!fieldErrors.requestUrgencyDaysBeforeStart}
                className={fieldErrors.requestUrgencyDaysBeforeStart ? "border-destructive" : ""}
                disabled={isPending}
              />
              {fieldErrors.requestUrgencyDaysBeforeStart && (
                <p className="text-sm text-destructive">
                  {fieldErrors.requestUrgencyDaysBeforeStart}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryUrgencyDaysBeforeStart">
                {t("operations.deliveryUrgencyDays")}
              </Label>
              <Input
                id="deliveryUrgencyDaysBeforeStart"
                type="number"
                min="1"
                max="90"
                value={deliveryUrgencyDaysBeforeStart}
                onChange={(e) => {
                  setDeliveryUrgencyDaysBeforeStart(e.target.value);
                  clearFieldError("deliveryUrgencyDaysBeforeStart");
                }}
                aria-invalid={!!fieldErrors.deliveryUrgencyDaysBeforeStart}
                className={fieldErrors.deliveryUrgencyDaysBeforeStart ? "border-destructive" : ""}
                disabled={isPending}
              />
              {fieldErrors.deliveryUrgencyDaysBeforeStart && (
                <p className="text-sm text-destructive">
                  {fieldErrors.deliveryUrgencyDaysBeforeStart}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {t("pricing.save")}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              {t("confirmButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Separator />

      {/* Settings History */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pricing.history")}</CardTitle>
          <CardDescription>{history.length === 0 ? t("historyEmpty") : undefined}</CardDescription>
        </CardHeader>
        {history.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">Date</TableHead>
                  <TableHead className="w-[25%]">Field</TableHead>
                  <TableHead className="w-[20%]">Old value</TableHead>
                  <TableHead className="w-[20%]">New value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {new Date(entry.changedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>{t(`historyField.${entry.field}`)}</TableCell>
                    <TableCell>{formatHistoryValue(entry.field, entry.oldValue)}</TableCell>
                    <TableCell>{formatHistoryValue(entry.field, entry.newValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
