"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getFilmDetailAction } from "@/app/[locale]/admin/films/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import type { AdminFilmDetail } from "@/lib/services/admin-films-service";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  inactive: "secondary",
  retired: "destructive",
};

const DELIVERY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  pending: "outline",
  in_progress: "secondary",
  delivered: "default",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FilmDetailPage() {
  const t = useTranslations("admin.films");
  const tDetail = useTranslations("admin.films.detail");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ filmId: string }>();
  const [detail, setDetail] = useState<AdminFilmDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getFilmDetailAction(params.filmId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        toast.error(t("error.unexpected"));
      } else {
        setDetail(result.data as AdminFilmDetail);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.filmId, t]);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push(`/${locale}/admin/films`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("title")}
        </Button>
        <p className="text-muted-foreground">{t("noResults")}</p>
      </div>
    );
  }

  const { film, orders, totalVolume, totalMargin } = detail;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/admin/films`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-heading text-2xl">{film.title}</h1>
          {film.originalTitle && film.originalTitle !== film.title && (
            <p className="text-muted-foreground text-sm">{film.originalTitle}</p>
          )}
        </div>
        <Badge variant={STATUS_VARIANTS[film.status] ?? "secondary"}>
          {t(`status.${film.status}`)}
        </Badge>
      </div>

      {/* Info + Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{tDetail("info")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("rightsHolder")}</dt>
                <dd>
                  <Link
                    href={`/${locale}/admin/rights-holders/${film.rightsHolderAccountId}`}
                    className="text-primary hover:underline"
                  >
                    {film.rightsHolderName}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("year")}</dt>
                <dd>{film.releaseYear ?? "—"}</dd>
              </div>
              {film.directors && film.directors.length > 0 && (
                <div>
                  <dt className="text-muted-foreground text-sm">{tDetail("directors")}</dt>
                  <dd>{film.directors.join(", ")}</dd>
                </div>
              )}
              {film.duration && (
                <div>
                  <dt className="text-muted-foreground text-sm">{tDetail("duration")}</dt>
                  <dd>{film.duration} min</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("created")}</dt>
                <dd>{formatDate(film.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tDetail("stats")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("orderCount")}</dt>
                <dd className="text-lg font-bold">{orders.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("volume")}</dt>
                <dd className="text-lg font-bold">{formatAmount(totalVolume, "EUR", locale)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("margin")}</dt>
                <dd className="text-lg font-bold">{formatAmount(totalMargin, "EUR", locale)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Orders table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {tDetail("orders")} ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">{tDetail("noOrders")}</p>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[15%]">{tDetail("orderNumber")}</TableHead>
                  <TableHead className="w-[22%]">{tDetail("exhibitor")}</TableHead>
                  <TableHead className="w-[18%]">{tDetail("cinema")}</TableHead>
                  <TableHead className="w-[13%]">{tDetail("date")}</TableHead>
                  <TableHead className="w-[12%] text-right">{tDetail("price")}</TableHead>
                  <TableHead className="w-[10%] text-right">{tDetail("timeless")}</TableHead>
                  <TableHead className="w-[10%]">{tDetail("delivery")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order, index) => (
                  <TableRow key={`${order.orderId}-${index}`}>
                    <TableCell>
                      <Link
                        href={`/${locale}/admin/orders/${order.orderId}`}
                        className="text-primary font-mono text-sm hover:underline"
                      >
                        {formatOrderNumber(order.orderNumber)}
                      </Link>
                    </TableCell>
                    <TableCell className="truncate text-sm">
                      <Link
                        href={`/${locale}/admin/exhibitors/${order.exhibitorAccountId}`}
                        className="text-primary hover:underline"
                      >
                        {order.exhibitorName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate text-sm">
                      {order.cinemaName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(order.paidAt)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatAmount(order.displayedPrice, order.currency, locale)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatAmount(order.timelessAmount, order.currency, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={DELIVERY_VARIANTS[order.deliveryStatus] ?? "outline"}>
                        {t(`detail.deliveryStatus.${order.deliveryStatus}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
