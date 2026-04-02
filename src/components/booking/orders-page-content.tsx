"use client";

import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { getOrders } from "@/components/booking/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { formatAmount } from "@/lib/pricing/format";
import { formatOrderNumber } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  orderNumber: number;
  total: number;
  taxAmount: number;
  currency: string;
  status: string;
  paidAt: string | Date;
  stripeInvoiceId: string | null;
  items: Array<{
    id: string;
    displayedPrice: number;
    screeningCount: number;
    film: { title: string };
    cinema: { name: string };
  }>;
}

type StatusTab = "all" | "paid" | "processing" | "delivered";

interface OrdersPageContentProps {
  initialOrders: OrderItem[];
  initialPagination: { page: number; limit: number; total: number };
  checkoutSessionId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export function OrdersPageContent({
  initialOrders,
  initialPagination,
  checkoutSessionId,
}: OrdersPageContentProps) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const toastShownRef = useRef(false);

  const [orders, setOrders] = useState(initialOrders);
  const [pagination, setPagination] = useState(initialPagination);
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [isPending, startTransition] = useTransition();
  const [loadingSource, setLoadingSource] = useState<"tab" | "page" | null>(null);

  useEffect(() => {
    if (checkoutSessionId && !toastShownRef.current) {
      toastShownRef.current = true;
      toast.success(t("paymentSuccess"));
    }
  }, [checkoutSessionId, t]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    [locale]
  );

  const fetchOrders = useCallback((page: number, status: StatusTab, source: "tab" | "page") => {
    setLoadingSource(source);
    startTransition(async () => {
      const result = await getOrders({
        page,
        limit: 20,
        status: status === "all" ? undefined : status,
      });

      if ("success" in result) {
        setOrders(result.data as OrderItem[]);
        setPagination(result.pagination);
      }
      setLoadingSource(null);
    });
  }, []);

  const handleTabChange = (tab: string) => {
    const newTab = tab as StatusTab;
    setActiveTab(newTab);
    fetchOrders(1, newTab, "tab");
  };

  const handlePageChange = (page: number) => {
    fetchOrders(page, activeTab, "page");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const isLoading = isPending && loadingSource !== null;

  if (initialOrders.length === 0 && orders.length === 0 && !isLoading && activeTab === "all") {
    return <p className="text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
          <TabsTrigger value="paid">{t("tabs.paid")}</TabsTrigger>
          <TabsTrigger value="processing">{t("tabs.processing")}</TabsTrigger>
          <TabsTrigger value="delivered">{t("tabs.delivered")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-md">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[15%]">{t("columns.date")}</TableHead>
              <TableHead className="w-[18%]">{t("columns.orderNumber")}</TableHead>
              <TableHead className="w-[27%]">{t("columns.films")}</TableHead>
              <TableHead className="w-[15%]">{t("columns.amount")}</TableHead>
              <TableHead className="w-[15%]">{t("columns.status")}</TableHead>
              <TableHead className="w-[10%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const filmNames = order.items.map((i) => i.film.title).join(", ");
                return (
                  <TableRow key={order.id}>
                    <TableCell className="text-sm">
                      {dateFormatter.format(new Date(order.paidAt))}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatOrderNumber(order.orderNumber)}
                    </TableCell>
                    <TableCell className="truncate text-sm" title={filmNames}>
                      {order.items.length} — {filmNames}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatAmount(order.total, order.currency, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={orderStatusBadgeClassName(order.status)}>
                        {t(`deliveryStatus.${order.status}` as Parameters<typeof t>[0])}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/orders/${order.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("pagination.showing", {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages || isPending}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
