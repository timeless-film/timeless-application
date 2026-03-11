"use client";

import { ChevronLeft, ChevronRight, Film, Loader2, RotateCcw, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  cancelRequest,
  getRequests,
  payRequest,
  relaunchRequest,
} from "@/components/booking/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { formatAmount } from "@/lib/pricing/format";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestItem {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "paid" | string;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  displayedPrice: number;
  currency: string;
  originalCatalogPrice: number | null;
  originalCurrency: string | null;
  convertedTotal: number | null;
  convertedCurrency: string | null;
  createdAt: string | Date;
  approvalNote: string | null;
  rejectionReason: string | null;
  approvedAt: string | Date | null;
  rejectedAt: string | Date | null;
  film: { id: string; title: string; posterUrl: string | null };
  rightsHolderAccount: { companyName: string | null };
  cinema: { name: string };
  room: { name: string };
  createdByUser: { name: string } | null;
}

interface RequestsPageContentProps {
  initialRequests: RequestItem[];
  initialPagination: { page: number; limit: number; total: number };
  initialTab: "pending" | "history";
  checkoutSessionId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeClassName(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100/80";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80";
    case "cancelled":
      return "text-muted-foreground";
    case "paid":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100/80";
    default:
      return "";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const REQUESTS_PER_PAGE = 20;

export function RequestsPageContent({
  initialRequests,
  initialPagination,
  initialTab,
  checkoutSessionId,
}: RequestsPageContentProps) {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"pending" | "history">(initialTab);
  const [requestsList, setRequestsList] = useState<RequestItem[]>(initialRequests);
  const [pagination, setPagination] = useState(initialPagination);
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(initialPagination.page);
  const [loadingSource, setLoadingSource] = useState<"tab" | "search" | "page" | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState<string | null>(null);
  const [payingRequestId, setPayingRequestId] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  const paymentToastShown = useRef(false);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [locale]
  );

  const shortDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [locale]
  );

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  const statusLabel = (status: string) => {
    const mapping: Record<string, string> = {
      pending: t("status.pending"),
      approved: t("status.approved"),
      validated: t("status.approved"),
      rejected: t("status.rejected"),
      refused: t("status.rejected"),
      cancelled: t("status.cancelled"),
      paid: t("status.paid"),
    };
    return mapping[status] ?? status;
  };

  const fetchRequests = useCallback((tab: "pending" | "history", page: number, search: string) => {
    startTransition(async () => {
      const result = await getRequests({
        page,
        limit: REQUESTS_PER_PAGE,
        tab,
        search: search.trim() || undefined,
      });
      if ("success" in result && result.data && result.pagination) {
        setRequestsList(result.data as unknown as RequestItem[]);
        setPagination(result.pagination);
      }
    });
  }, []);

  // Debounced search
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setLoadingSource("search");
      setCurrentPage(1);
      fetchRequests(activeTab, 1, searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, fetchRequests, activeTab]);

  const handleTabChange = (tab: string) => {
    const newTab = tab as "pending" | "history";
    setLoadingSource("tab");
    setActiveTab(newTab);
    setCurrentPage(1);
    setSearchInput("");
    fetchRequests(newTab, 1, "");
  };

  const handlePageChange = (newPage: number) => {
    setLoadingSource("page");
    setCurrentPage(newPage);
    fetchRequests(activeTab, newPage, searchInput);
  };

  const handleCancel = (requestId: string) => {
    startTransition(async () => {
      const result = await cancelRequest(requestId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("cancelSuccess"));
      fetchRequests(activeTab, currentPage, searchInput);
    });
    setCancelDialogOpen(null);
  };

  const handleRelaunch = (requestId: string) => {
    startTransition(async () => {
      const result = await relaunchRequest(requestId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("resubmitSuccess"));
      router.refresh();
    });
  };

  const handlePay = (requestId: string) => {
    setPayingRequestId(requestId);
    startTransition(async () => {
      const result = await payRequest({ requestId, locale });
      if ("error" in result) {
        toast.error(result.error);
        setPayingRequestId(null);
        return;
      }
      if ("redirectUrl" in result && result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    });
  };

  // Show success toast when returning from Stripe Checkout
  useEffect(() => {
    if (checkoutSessionId && !paymentToastShown.current) {
      paymentToastShown.current = true;
      toast.success(t("paymentSuccess"));
      // Refresh to get updated request status
      fetchRequests(activeTab, currentPage, searchInput);
    }
  }, [checkoutSessionId, t, fetchRequests, activeTab, currentPage, searchInput]);

  // ─── Skeleton cards ────────────────────────────────────────────────────

  const renderSkeletons = () =>
    Array.from({ length: 3 }).map((_, i) => (
      <Card key={`skeleton-${i}`} className="overflow-hidden">
        <div className="flex gap-4 p-5">
          <Skeleton className="h-36 w-24 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
        <div className="flex items-center justify-between border-t px-5 py-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
      </Card>
    ));

  // ─── Status alert ──────────────────────────────────────────────────────

  const renderStatusAlert = (request: RequestItem) => {
    if (request.status === "approved" && (request.approvedAt || request.approvalNote)) {
      return (
        <div className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {request.approvedAt && (
            <p>
              {t("approvedAt", {
                date: dateFormatter.format(new Date(request.approvedAt)),
              })}
            </p>
          )}
          {request.approvalNote && (
            <p className="mt-0.5 italic opacity-80">
              {t("approvalNote", { note: request.approvalNote })}
            </p>
          )}
        </div>
      );
    }
    if (request.status === "rejected" && (request.rejectedAt || request.rejectionReason)) {
      return (
        <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {request.rejectedAt && (
            <p>
              {t("rejectedAt", {
                date: dateFormatter.format(new Date(request.rejectedAt)),
              })}
            </p>
          )}
          {request.rejectionReason && (
            <p className="mt-0.5 italic opacity-80">
              {t("refusalReason", { reason: request.rejectionReason })}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar: tabs + search */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="pending">{t("tabs.pending")}</TabsTrigger>
            <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-72">
          {isPending && loadingSource === "search" ? (
            <Loader2 className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
          ) : (
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          )}
          <Input
            type="search"
            name="request-search"
            id="request-search"
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
            aria-label={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
      </div>

      {/* Cards list */}
      {isPending && loadingSource !== "search" ? (
        <div className="space-y-3">{renderSkeletons()}</div>
      ) : requestsList.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {requestsList.map((request) => (
            <Card key={request.id} className="overflow-hidden transition-shadow hover:shadow-md">
              {/* Top section: poster + details */}
              <div className="flex gap-4 p-5">
                {/* Poster */}
                <Link
                  href={`/catalog/${request.film.id}`}
                  className="relative h-36 w-24 shrink-0 overflow-hidden rounded-md"
                >
                  {request.film.posterUrl ? (
                    <Image
                      src={request.film.posterUrl}
                      alt={request.film.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="bg-muted flex h-full w-full items-center justify-center rounded-md">
                      <Film className="text-muted-foreground size-6" />
                    </div>
                  )}
                </Link>

                {/* Details */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {/* Title + badge + actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Link
                        href={`/catalog/${request.film.id}`}
                        className="truncate text-base font-semibold hover:underline"
                      >
                        {request.film.title}
                      </Link>
                      <Badge
                        variant="outline"
                        className={cn("shrink-0", statusBadgeClassName(request.status))}
                      >
                        {statusLabel(request.status)}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {request.status === "pending" && (
                        <AlertDialog
                          open={cancelDialogOpen === request.id}
                          onOpenChange={(open) => setCancelDialogOpen(open ? request.id : null)}
                        >
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive size-8"
                              disabled={isPending}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("cancelConfirmTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("cancelConfirmDescription")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleCancel(request.id)}
                              >
                                {t("cancelConfirmButton")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {(request.status === "cancelled" || request.status === "rejected") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleRelaunch(request.id)}
                          disabled={isPending}
                          title={t("actions.resubmit")}
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Metadata lines */}
                  <p className="text-muted-foreground text-sm">
                    {request.rightsHolderAccount.companyName ?? "—"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {request.cinema.name} <span className="mx-1 opacity-40">·</span>{" "}
                    {request.room.name}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {request.screeningCount}{" "}
                    {request.screeningCount > 1
                      ? t("item.screeningsPlural")
                      : t("item.screeningsSingular")}
                    {request.startDate && (
                      <>
                        <span className="mx-1 opacity-40">·</span>
                        {shortDateFormatter.format(new Date(request.startDate))}
                        {request.endDate &&
                          ` — ${shortDateFormatter.format(new Date(request.endDate))}`}
                      </>
                    )}
                  </p>

                  {/* Status alert */}
                  {renderStatusAlert(request)}
                </div>
              </div>

              {/* Footer: price + meta + action */}
              <div className="flex items-center justify-between border-t px-5 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold">
                    {formatAmount(
                      request.displayedPrice * request.screeningCount,
                      request.currency,
                      locale
                    )}
                    <span className="text-muted-foreground ml-1 text-xs font-normal">
                      {tCommon("excludingTax")}
                    </span>
                  </span>
                  {request.screeningCount > 1 && (
                    <span className="text-muted-foreground text-xs">
                      {formatAmount(request.displayedPrice, request.currency, locale)} ×{" "}
                      {request.screeningCount}
                    </span>
                  )}
                  {request.convertedTotal !== null && request.convertedCurrency && (
                    <span className="text-muted-foreground text-xs">
                      {t("item.convertedFrom", {
                        amount: formatAmount(
                          request.convertedTotal,
                          request.convertedCurrency,
                          locale
                        ),
                        currency: request.convertedCurrency,
                      })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground text-xs">
                    {shortDateFormatter.format(new Date(request.createdAt))}
                    {request.createdByUser && (
                      <>
                        <span className="mx-1 opacity-40">·</span>
                        {request.createdByUser.name}
                      </>
                    )}
                  </span>
                  {request.status === "approved" && (
                    <Button
                      variant="default"
                      size="sm"
                      disabled={payingRequestId === request.id}
                      onClick={() => handlePay(request.id)}
                    >
                      {payingRequestId === request.id && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t("actions.pay")}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.total > REQUESTS_PER_PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            {t("pagination.info", { page: currentPage, total: totalPages })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isPending}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <ChevronLeft className="mr-1 size-4" />
              {t("pagination.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || isPending}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              {t("pagination.next")}
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
