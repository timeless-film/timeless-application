"use client";

import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { getIncomingRequests } from "@/app/[locale]/(rights-holder)/validation-requests/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

function statusBadgeVariant(status: string): StatusVariant {
  switch (status) {
    case "pending":
      return "secondary";
    case "approved":
      return "default";
    case "rejected":
      return "destructive";
    case "cancelled":
      return "outline";
    default:
      return "outline";
  }
}

interface RequestItem {
  id: string;
  status: string;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  displayedPrice: number;
  currency: string;
  note: string | null;
  createdAt: string | Date;
  film: { id: string; title: string; posterUrl: string | null };
  exhibitorAccount: {
    id: string;
    companyName: string | null;
    country: string;
    vatNumber: string | null;
  };
  cinema: { id: string; name: string; city: string | null; country: string };
  room: { id: string; name: string; capacity: number };
  createdByUser: { id: string; name: string } | null;
}

interface ValidationRequestsPageContentProps {
  initialRequests: RequestItem[];
  initialPagination: { page: number; limit: number; total: number };
  initialTab: "pending" | "history";
}

const REQUESTS_PER_PAGE = 20;

export function ValidationRequestsPageContent({
  initialRequests,
  initialPagination,
  initialTab,
}: ValidationRequestsPageContentProps) {
  const t = useTranslations("films.validation");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("requests.status");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"pending" | "history">(initialTab);
  const [requestsList, setRequestsList] = useState<RequestItem[]>(initialRequests);
  const [pagination, setPagination] = useState(initialPagination);
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(initialPagination.page);
  const [loadingSource, setLoadingSource] = useState<"tab" | "search" | "page" | null>(null);
  const isInitialMount = useRef(true);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    [locale]
  );

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  const fetchRequests = useCallback((tab: "pending" | "history", page: number, search: string) => {
    startTransition(async () => {
      const result = await getIncomingRequests({
        page,
        limit: REQUESTS_PER_PAGE,
        tab,
        search: search.trim() || undefined,
      });
      if ("success" in result && result.success) {
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
    fetchRequests(newTab, 1, searchInput);
  };

  const handlePageChange = (newPage: number) => {
    setLoadingSource("page");
    setCurrentPage(newPage);
    fetchRequests(activeTab, newPage, searchInput);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
            className="bg-card pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/35 border-border/60 hover:bg-muted/35">
            <TableHead className="text-foreground/85 w-[28%] py-3 text-xs tracking-wide uppercase">
              {t("columns.film")}
            </TableHead>
            <TableHead className="text-foreground/85 w-[16%] py-3 text-xs tracking-wide uppercase">
              {t("columns.exhibitor")}
            </TableHead>
            <TableHead className="text-foreground/85 w-[16%] py-3 text-xs tracking-wide uppercase">
              {t("columns.cinema")}
            </TableHead>
            <TableHead className="text-foreground/85 w-[8%] py-3 text-xs tracking-wide uppercase">
              {t("columns.screenings")}
            </TableHead>
            <TableHead className="text-foreground/85 w-[12%] py-3 text-xs tracking-wide uppercase">
              {t("columns.price")}
            </TableHead>
            <TableHead className="text-foreground/85 w-[12%] py-3 text-xs tracking-wide uppercase">
              {t("columns.requestDate")}
            </TableHead>
            <TableHead className="text-foreground/85 w-[8%] py-3 text-xs tracking-wide uppercase">
              {t("columns.status")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending && loadingSource !== "search" ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="border-b border-border/45">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-8 rounded" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
              </TableRow>
            ))
          ) : requestsList.length === 0 ? (
            <TableRow className="border-b border-border/45">
              <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            requestsList.map((request) => (
              <TableRow key={request.id} className="border-b border-border/45 hover:bg-muted/25">
                <TableCell>
                  <div className="flex items-center gap-3">
                    {request.film.posterUrl ? (
                      <Image
                        src={request.film.posterUrl}
                        alt={request.film.title}
                        width={32}
                        height={48}
                        className="h-12 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex h-12 w-8 items-center justify-center rounded">
                        <span className="text-muted-foreground text-xs">🎬</span>
                      </div>
                    )}
                    <Link
                      href={`/validation-requests/${request.id}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {request.film.title}
                    </Link>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{request.exhibitorAccount.companyName ?? "—"}</span>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <span>{request.cinema.name}</span>
                    {request.cinema.city && (
                      <span className="text-muted-foreground"> ({request.cinema.city})</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{request.screeningCount}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {formatAmount(
                      request.displayedPrice * request.screeningCount,
                      request.currency,
                      locale
                    )}{" "}
                    <span className="text-muted-foreground text-xs">{tCommon("excludingTax")}</span>
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">
                    {dateFormatter.format(new Date(request.createdAt))}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(request.status)}>
                    {tStatus(
                      request.status as "pending" | "approved" | "rejected" | "cancelled" | "paid"
                    )}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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
