"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withdrawFunds } from "@/components/wallet/wallet-actions";
import { formatAmount } from "@/lib/pricing/format";

import type { AmountByCurrency } from "@/lib/services/wallet-service";

interface WithdrawDialogProps {
  available: AmountByCurrency[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ERROR_KEYS: Record<string, string> = {
  INSUFFICIENT_BALANCE: "insufficientBalance",
  NO_BANK_ACCOUNT: "noBankAccount",
  BANK_ACCOUNT_CLOSED: "bankAccountClosed",
  PAYOUT_FAILED: "payoutFailed",
  ONBOARDING_INCOMPLETE: "onboardingIncomplete",
};

export function WithdrawDialog({ available, open, onOpenChange }: WithdrawDialogProps) {
  const t = useTranslations("wallet");
  const [isPending, startTransition] = useTransition();
  const [amountInput, setAmountInput] = useState("");
  const [currency, setCurrency] = useState(available[0]?.currency ?? "eur");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const selectedBalance = available.find(
    (b) => b.currency.toLowerCase() === currency.toLowerCase()
  );
  const availableAmount = selectedBalance?.amount ?? 0;

  const handleSubmit = useCallback(() => {
    setFieldError(null);

    const parsed = parseFloat(amountInput);
    if (isNaN(parsed) || parsed <= 0) {
      setFieldError(t("errors.payoutFailed"));
      return;
    }

    const amountInCents = Math.round(parsed * 100);

    if (amountInCents > availableAmount) {
      setFieldError(t("errors.insufficientBalance"));
      return;
    }

    startTransition(async () => {
      const result = await withdrawFunds(amountInCents, currency);

      if ("error" in result && result.error) {
        const errorKey = ERROR_KEYS[result.error] ?? "payoutFailed";
        if (result.error === "NO_BANK_ACCOUNT") {
          toast.error(t(`errors.${errorKey}`));
        } else {
          setFieldError(t(`errors.${errorKey}`));
        }
        return;
      }

      toast.success(
        t("withdrawModal.success", {
          amount: result.formattedAmount,
          date: new Date(result.arrivalDate).toLocaleDateString(),
        })
      );
      setAmountInput("");
      onOpenChange(false);
    });
  }, [amountInput, availableAmount, currency, onOpenChange, startTransition, t]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        setAmountInput("");
        setFieldError(null);
      }
      onOpenChange(value);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("withdrawModal.title")}</DialogTitle>
          <p className="text-muted-foreground text-sm">{t("withdrawModal.description")}</p>
        </DialogHeader>

        <div className="space-y-4">
          {available.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="withdraw-currency">{t("withdrawModal.currency")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="withdraw-currency">
                  <SelectValue placeholder={t("withdrawModal.currencySelect")} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((b) => (
                    <SelectItem key={b.currency} value={b.currency}>
                      {b.currency.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">{t("withdrawModal.amount")}</Label>
            <Input
              id="withdraw-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
              className={fieldError ? "border-destructive" : ""}
              placeholder="0.00"
            />
            <p className="text-muted-foreground text-xs">
              {t("withdrawModal.available", {
                amount: formatAmount(availableAmount, currency),
              })}
            </p>
            {fieldError && <p className="text-destructive text-sm">{fieldError}</p>}
          </div>

          <p className="text-muted-foreground text-xs">{t("withdrawModal.delay")}</p>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending || !amountInput}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("withdrawModal.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
