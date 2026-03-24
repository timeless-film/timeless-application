import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getOrder } from "@/components/booking/actions";
import { InvoiceDownloadButton } from "@/components/booking/invoice-download-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { formatAmount } from "@/lib/pricing/format";
import { formatOrderNumber } from "@/lib/utils";

import type { Metadata } from "next";

interface OrderDetailPageProps {
  params: Promise<{ orderId: string; locale: string }>;
}

export async function generateMetadata({ params }: OrderDetailPageProps): Promise<Metadata> {
  const { orderId } = await params;
  const t = await getTranslations("orders");
  const result = await getOrder(orderId);

  if (!("data" in result) || !result.data) {
    return { title: t("title") };
  }

  const orderRef = formatOrderNumber(result.data.orderNumber);
  return { title: t("detail.title", { orderNumber: orderRef }) };
}

function orderStatusBadgeClassName(status: string): string {
  switch (status) {
    case "paid":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100/80";
    case "processing":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100/80";
    case "delivered":
      return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80";
    case "refunded":
      return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80";
    default:
      return "";
  }
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId, locale } = await params;
  const t = await getTranslations("orders");
  const result = await getOrder(orderId);

  if (!("data" in result) || !result.data) {
    notFound();
  }

  const order = result.data;
  const orderRef = formatOrderNumber(order.orderNumber);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6 2xl:max-w-[1440px]">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="font-heading text-3xl">{t("detail.title", { orderNumber: orderRef })}</h1>
          <p className="text-sm text-muted-foreground">
            {dateFormatter.format(new Date(order.paidAt))}
          </p>
        </div>
        <Badge variant="outline" className={orderStatusBadgeClassName(order.status)}>
          {t(`deliveryStatus.${order.status}` as Parameters<typeof t>[0])}
        </Badge>
        {order.stripeInvoiceId ? <InvoiceDownloadButton orderId={order.id} /> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("columns.films")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">{t("columns.film")}</TableHead>
                <TableHead className="w-[20%]">{t("columns.cinema")}</TableHead>
                <TableHead className="w-[15%]">{t("columns.date")}</TableHead>
                <TableHead className="w-[15%] text-right">{t("columns.quantity")}</TableHead>
                <TableHead className="w-[15%] text-right">{t("columns.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <Link href={`/catalog/${item.film.id}`} className="hover:underline">
                      {item.film.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.cinema.name} — {item.room.name}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.startDate && item.endDate
                      ? t("detail.dates", {
                          start: dateFormatter.format(new Date(item.startDate)),
                          end: dateFormatter.format(new Date(item.endDate)),
                        })
                      : item.startDate
                        ? dateFormatter.format(new Date(item.startDate))
                        : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">{item.screeningCount}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatAmount(item.displayedPrice * item.screeningCount, item.currency, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-2">
          {(() => {
            const computedSubtotal = order.items.reduce(
              (sum, item) => sum + item.displayedPrice * item.screeningCount,
              0
            );
            const deliveryFeesTotal = order.deliveryFeesTotal ?? 0;
            const computedTotal = computedSubtotal + deliveryFeesTotal + order.taxAmount;
            return (
              <>
                <div className="flex justify-between text-sm">
                  <span>{t("detail.subtotal")}</span>
                  <span>{formatAmount(computedSubtotal, order.currency, locale)}</span>
                </div>
                {deliveryFeesTotal > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span>{t("detail.deliveryFees")}</span>
                    <span>{formatAmount(deliveryFeesTotal, order.currency, locale)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm">
                  <span>{t("detail.tax")}</span>
                  <span>{formatAmount(order.taxAmount, order.currency, locale)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t">
                  <span>{t("detail.total")}</span>
                  <span>{formatAmount(computedTotal, order.currency, locale)}</span>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
