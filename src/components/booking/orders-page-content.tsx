"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OrderItem {
  id: string;
  total: number;
  currency: string;
  createdAt: string | Date;
  status: string;
  stripeInvoiceId: string | null;
  items: Array<{
    id: string;
    film: { title: string };
    cinema: { name: string };
  }>;
}

interface OrdersPageContentProps {
  orders: OrderItem[];
}

export function OrdersPageContent({ orders }: OrdersPageContentProps) {
  const t = useTranslations("orders");
  const locale = useLocale();

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    [locale]
  );

  if (orders.length === 0) {
    return <p className="text-muted-foreground">{t("title")}: 0</p>;
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const filmTitle = order.items[0]?.film.title ?? "-";
        const cinemaName = order.items[0]?.cinema.name ?? "-";

        return (
          <Card key={order.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{filmTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium">{t("columns.cinema")}: </span>
                {cinemaName}
              </p>
              <p>
                <span className="font-medium">{t("columns.date")}: </span>
                {dateFormatter.format(new Date(order.createdAt))}
              </p>
              <p>
                <span className="font-medium">{t("columns.amount")}: </span>
                {new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: order.currency,
                }).format(order.total / 100)}
              </p>
              <p>
                <span className="font-medium">{t("columns.status")}: </span>
                {order.status}
              </p>
              {order.stripeInvoiceId ? (
                <p>
                  <span className="font-medium">{t("columns.invoice")}: </span>
                  {order.stripeInvoiceId}
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
