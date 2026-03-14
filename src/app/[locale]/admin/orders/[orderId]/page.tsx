"use client";

import { ArrowLeft, ExternalLink, Film, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { getOrderDetailAction, refundOrderAction } from "@/app/[locale]/admin/orders/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/pricing/format";

import type { AdminOrderDetail } from "@/lib/services/admin-orders-service";

// ─── Constants ────────────────────────────────────────────────────────────────

const REFUND_WINDOW_MS = 48 * 60 * 60 * 1000;

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  processing: "outline",
  delivered: "default",
  refunded: "destructive",
};

const DELIVERY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  pending: "outline",
  in_progress: "secondary",
  delivered: "default",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const t = useTranslations("admin.orders");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    const result = await getOrderDetailAction(params.orderId);
    if ("error" in result) {
      toast.error(t("error.unexpected"));
      setLoading(false);
      return;
    }
    setOrder(result.data);
    setLoading(false);
  }, [params.orderId, t]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatOrderNumber(num: number) {
    return `ORD-${String(num).padStart(6, "0")}`;
  }

  function canRefund(): boolean {
    if (!order) return false;
    if (order.status !== "paid" && order.status !== "processing") return false;
    const elapsed = Date.now() - new Date(order.paidAt).getTime();
    return elapsed <= REFUND_WINDOW_MS;
  }

  async function handleRefund() {
    if (!order || !refundReason.trim()) return;
    setRefunding(true);
    try {
      const result = await refundOrderAction(order.id, refundReason.trim());
      if ("error" in result) {
        toast.error(t("error.unexpected"));
        return;
      }
      toast.success(t("refundSuccess"));
      setRefundOpen(false);
      setRefundReason("");
      fetchOrder();
    } catch {
      toast.error(t("error.unexpected"));
    } finally {
      setRefunding(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push(`/${locale}/admin/orders`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("title")}
        </Button>
        <p className="text-muted-foreground">{t("noResults")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/admin/orders`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl">{formatOrderNumber(order.orderNumber)}</h1>
            <p className="text-muted-foreground text-sm">
              <Link
                href={`/${locale}/admin/exhibitors/${order.exhibitorAccountId}`}
                className="text-primary hover:underline"
              >
                {order.exhibitorName}
              </Link>
            </p>
          </div>
          <Badge variant={STATUS_VARIANTS[order.status] ?? "outline"}>
            {t(`status.${order.status}`)}
          </Badge>
        </div>
        {canRefund() && (
          <Button variant="destructive" onClick={() => setRefundOpen(true)}>
            {t("refund")}
          </Button>
        )}
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t("detail.summary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground text-sm">{t("columns.date")}</dt>
              <dd className="font-medium">{formatDate(order.paidAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">{t("detail.subtotal")}</dt>
              <dd className="font-medium">
                {formatAmount(order.subtotal, order.currency, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">{t("detail.deliveryFees")}</dt>
              <dd className="font-medium">
                {formatAmount(order.deliveryFeesTotal, order.currency, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">{t("detail.tax")}</dt>
              <dd className="font-medium">
                {formatAmount(order.taxAmount, order.currency, locale)}
                {order.taxRate && ` (${(parseFloat(order.taxRate) * 100).toFixed(0)}%)`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">{t("detail.total")}</dt>
              <dd className="text-lg font-bold">
                {formatAmount(order.total, order.currency, locale)}
              </dd>
            </div>
            {order.reverseCharge === "true" && (
              <div>
                <dt className="text-muted-foreground text-sm">{t("detail.reverseCharge")}</dt>
                <dd>
                  <Badge variant="outline">{t("detail.reverseCharge")}</Badge>
                </dd>
              </div>
            )}
            {order.stripeInvoiceId && (
              <div>
                <dt className="text-muted-foreground text-sm">{t("detail.stripeInvoice")}</dt>
                <dd>
                  <a
                    href={`https://dashboard.stripe.com/invoices/${order.stripeInvoiceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    {t("detail.stripeInvoice")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>{t("detail.items")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("detail.film")}</TableHead>
                <TableHead>{t("detail.rightsHolder")}</TableHead>
                <TableHead>{t("detail.cinema")}</TableHead>
                <TableHead className="text-center">{t("detail.screenings")}</TableHead>
                <TableHead className="text-right">{t("detail.price")}</TableHead>
                <TableHead className="text-right">{t("detail.rhAmount")}</TableHead>
                <TableHead className="text-right">{t("detail.timelessAmount")}</TableHead>
                <TableHead>{t("detail.delivery")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item.filmPosterUrl ? (
                        <Image
                          src={item.filmPosterUrl}
                          alt={item.filmTitle}
                          width={32}
                          height={48}
                          className="h-12 w-8 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="bg-muted flex h-12 w-8 shrink-0 items-center justify-center rounded">
                          <Film className="text-muted-foreground h-4 w-4" />
                        </div>
                      )}
                      <Link
                        href={`/${locale}/admin/films/${item.filmId}`}
                        className="text-primary font-medium hover:underline"
                      >
                        {item.filmTitle}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link
                      href={`/${locale}/admin/rights-holders/${item.rightsHolderAccountId}`}
                      className="text-primary hover:underline"
                    >
                      {item.rightsHolderName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.cinemaName}
                    {item.roomName && (
                      <span className="text-muted-foreground"> / {item.roomName}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{item.screeningCount}</TableCell>
                  <TableCell className="text-right">
                    {formatAmount(item.displayedPrice, item.currency, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(
                      item.rightsHolderAmount * item.screeningCount,
                      item.currency,
                      locale
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(item.timelessAmount * item.screeningCount, item.currency, locale)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={DELIVERY_VARIANTS[item.deliveryStatus] ?? "outline"}>
                      {t(`detail.deliveryStatus.${item.deliveryStatus}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("refund")}</DialogTitle>
            <DialogDescription>
              {t("refundConfirm", { orderNumber: formatOrderNumber(order.orderNumber) })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="refund-reason">
              {t("refundReason")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="refund-reason"
              value={refundReason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRefundReason(e.target.value)}
              placeholder={t("refundReasonPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={refunding}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={refunding || !refundReason.trim()}
            >
              {refunding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("refund")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
