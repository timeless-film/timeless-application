"use client";

import { ChevronLeft, ChevronRight, Eye, Loader2, MoreHorizontal, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getOrdersPaginated, refundOrderAction } from "@/app/[locale]/admin/orders/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import type { AdminOrderRow } from "@/lib/services/admin-orders-service";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "paid" | "processing" | "delivered" | "refunded";

interface OrderListProps {
  initialOrders: AdminOrderRow[];
  initialTotal: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

const STATUS_VARIANTS: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  processing: "outline",
  delivered: "default",
  refunded: "destructive",
};

const FILTER_STATUSES: OrderStatus[] = ["paid", "processing", "delivered", "refunded"];

const REFUND_WINDOW_MS = 48 * 60 * 60 * 1000;

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderList({ initialOrders, initialTotal }: OrderListProps) {
  const t = useTranslations("admin.orders");
  const locale = useLocale();
  const router = useRouter();
  const [orderRows, setOrderRows] = useState<AdminOrderRow[]>(initialOrders);
  const [total, setTotal] = useState(initialTotal);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState<"search" | "page" | "tab" | null>(null);
  const isInitialMount = useRef(true);

  // Refund dialog
  const [refundTarget, setRefundTarget] = useState<AdminOrderRow | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [acting, setActing] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const fetchOrders = useCallback(
    async (search: string, page: number, status: OrderStatus | "all") => {
      setLoading(true);
      try {
        const result = await getOrdersPaginated({
          search: search || undefined,
          status: status === "all" ? undefined : status,
          page,
          limit: ITEMS_PER_PAGE,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        setOrderRows(result.orders ?? []);
        setTotal(result.total ?? 0);
      } catch {
        toast.error(t("error.unexpected"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  // Debounced search
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setLoadingSource("search");
      setCurrentPage(1);
      fetchOrders(searchInput, 1, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, fetchOrders, statusFilter]);

  function handleStatusFilterChange(value: string) {
    const newStatus = value as OrderStatus | "all";
    setStatusFilter(newStatus);
    setLoadingSource("tab");
    setCurrentPage(1);
    fetchOrders(searchInput, 1, newStatus);
  }

  function handlePageChange(page: number) {
    setLoadingSource("page");
    setCurrentPage(page);
    fetchOrders(searchInput, page, statusFilter);
  }

  function canRefund(order: AdminOrderRow): boolean {
    if (order.status !== "paid" && order.status !== "processing") return false;
    const elapsed = Date.now() - new Date(order.paidAt).getTime();
    return elapsed <= REFUND_WINDOW_MS;
  }

  async function handleRefund() {
    if (!refundTarget || !refundReason.trim()) return;
    setActing(true);
    try {
      const result = await refundOrderAction(refundTarget.id, refundReason.trim());
      if ("error" in result) {
        toast.error(t("error.unexpected"));
        return;
      }
      toast.success(t("refundSuccess"));
      setRefundTarget(null);
      setRefundReason("");
      fetchOrders(searchInput, currentPage, statusFilter);
    } catch {
      toast.error(t("error.unexpected"));
    } finally {
      setActing(false);
    }
  }

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

  const showSkeleton = loading && loadingSource !== "search";

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            {loading && loadingSource === "search" ? (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            ) : (
              <Search className="text-muted-foreground h-4 w-4" />
            )}
          </div>
          <Input
            value={searchInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("filter.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.allStatuses")}</SelectItem>
            {FILTER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[15%]">{t("columns.orderNumber")}</TableHead>
              <TableHead className="w-[22%]">{t("columns.exhibitor")}</TableHead>
              <TableHead className="w-[15%]">{t("columns.date")}</TableHead>
              <TableHead className="w-[10%] text-center">{t("columns.films")}</TableHead>
              <TableHead className="w-[15%] text-right">{t("columns.total")}</TableHead>
              <TableHead className="w-[13%]">{t("columns.status")}</TableHead>
              <TableHead className="w-[10%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="mx-auto h-4 w-6" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : orderRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  {initialTotal === 0 &&
                  total === 0 &&
                  !searchInput.trim() &&
                  statusFilter === "all"
                    ? t("empty")
                    : t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              orderRows.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">
                    <Link
                      href={`/${locale}/admin/orders/${order.id}`}
                      className="text-primary hover:underline"
                    >
                      {formatOrderNumber(order.orderNumber)}
                    </Link>
                  </TableCell>
                  <TableCell className="truncate">
                    <Link
                      href={`/${locale}/admin/exhibitors/${order.exhibitorAccountId}`}
                      className="text-primary hover:underline"
                    >
                      {order.exhibitorName}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(order.paidAt)}</TableCell>
                  <TableCell className="text-center">{order.itemCount}</TableCell>
                  <TableCell className="text-right">
                    {formatAmount(order.total, order.currency, locale)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[order.status as OrderStatus] ?? "outline"}>
                      {t(`status.${order.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/${locale}/admin/orders/${order.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {t("view")}
                        </DropdownMenuItem>
                        {canRefund(order) && (
                          <DropdownMenuItem
                            onClick={() => {
                              setRefundTarget(order);
                              setRefundReason("");
                            }}
                            className="text-destructive"
                          >
                            {t("refund")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage <= 1 || loading}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground text-sm">
            {t("pagination.page", { current: currentPage, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage >= totalPages || loading}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Refund Dialog */}
      <Dialog
        open={!!refundTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRefundTarget(null);
            setRefundReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("refund")}</DialogTitle>
            <DialogDescription>
              {refundTarget &&
                t("refundConfirm", {
                  orderNumber: formatOrderNumber(refundTarget.orderNumber),
                })}
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
            <Button
              variant="outline"
              onClick={() => {
                setRefundTarget(null);
                setRefundReason("");
              }}
              disabled={acting}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={acting || !refundReason.trim()}
            >
              {acting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("refund")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
