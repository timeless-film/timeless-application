"use client";

import { Calendar, Clock, TrendingUp, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/pricing/format";

import type { AmountByCurrency } from "@/lib/services/wallet-service";

interface WalletKpiCardsProps {
  available: AmountByCurrency[];
  pending: AmountByCurrency[];
  currentMonth: AmountByCurrency[];
  previousMonth: AmountByCurrency[];
}

function formatAmountsForCard(amounts: AmountByCurrency[], locale: string) {
  if (amounts.length === 0) {
    return { primary: formatAmount(0, "eur", locale), others: [] };
  }
  // Sort by amount descending so the largest currency is primary
  const sorted = [...amounts].sort((a, b) => b.amount - a.amount);
  const [first, ...rest] = sorted;
  return {
    primary: formatAmount(first!.amount, first!.currency, locale),
    others: rest.map((a) => formatAmount(a.amount, a.currency, locale)),
  };
}

export function WalletKpiCards({
  available,
  pending,
  currentMonth,
  previousMonth,
}: WalletKpiCardsProps) {
  const t = useTranslations("wallet");
  const locale = useLocale();

  const cards = [
    {
      title: t("available"),
      ...formatAmountsForCard(available, locale),
      icon: Wallet,
    },
    {
      title: t("pending"),
      ...formatAmountsForCard(pending, locale),
      icon: Clock,
    },
    {
      title: t("thisMonth"),
      ...formatAmountsForCard(currentMonth, locale),
      icon: TrendingUp,
    },
    {
      title: t("previousMonth"),
      ...formatAmountsForCard(previousMonth, locale),
      icon: Calendar,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{card.primary}</p>
            {card.others.length > 0 && (
              <div className="text-muted-foreground mt-1 space-y-0.5">
                {card.others.map((amount) => (
                  <p key={amount} className="text-sm">
                    {amount}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
