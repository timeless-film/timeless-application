"use client";

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  Loader2,
  MoreHorizontal,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getFilmsPaginated } from "@/app/[locale]/admin/films/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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

import type { AdminFilmRow } from "@/lib/services/admin-films-service";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilmStatus = "active" | "inactive" | "retired";

interface FilmListProps {
  initialFilms: AdminFilmRow[];
  initialTotal: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

const STATUS_VARIANTS: Record<FilmStatus, "default" | "secondary" | "destructive"> = {
  active: "default",
  inactive: "secondary",
  retired: "destructive",
};

const TMDB_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  matched: "default",
  pending: "outline",
  no_match: "destructive",
  manual: "secondary",
};

const FILTER_STATUSES: FilmStatus[] = ["active", "inactive", "retired"];

// ─── Component ────────────────────────────────────────────────────────────────

export function FilmList({ initialFilms, initialTotal }: FilmListProps) {
  const t = useTranslations("admin.films");
  const locale = useLocale();
  const router = useRouter();
  const [filmRows, setFilmRows] = useState<AdminFilmRow[]>(initialFilms);
  const [total, setTotal] = useState(initialTotal);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilmStatus | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState<"search" | "page" | "tab" | null>(null);
  const isInitialMount = useRef(true);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const fetchFilms = useCallback(
    async (search: string, page: number, status: FilmStatus | "all") => {
      setLoading(true);
      try {
        const result = await getFilmsPaginated({
          search: search || undefined,
          status: status === "all" ? undefined : status,
          page,
          limit: ITEMS_PER_PAGE,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        setFilmRows(result.films ?? []);
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
      fetchFilms(searchInput, 1, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, fetchFilms, statusFilter]);

  function handleStatusFilterChange(value: string) {
    const newStatus = value as FilmStatus | "all";
    setStatusFilter(newStatus);
    setLoadingSource("tab");
    setCurrentPage(1);
    fetchFilms(searchInput, 1, newStatus);
  }

  function handlePageChange(page: number) {
    setLoadingSource("page");
    setCurrentPage(page);
    fetchFilms(searchInput, page, statusFilter);
  }

  const showSkeleton = loading && loadingSource !== "search";

  // ─── Empty state ─────────────────────────────────────────────────────────

  if (
    initialTotal === 0 &&
    total === 0 &&
    !searchInput.trim() &&
    statusFilter === "all" &&
    !loading
  ) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Film className="text-muted-foreground mb-4 size-12" />
        <p className="text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  // ─── Table ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          {loading && loadingSource === "search" ? (
            <Loader2 className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
          ) : (
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          )}
          <Input
            type="search"
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
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
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

      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="border-border/40">
            <TableHead className="w-[26%]">{t("columns.title")}</TableHead>
            <TableHead className="w-[16%]">{t("columns.rightsHolder")}</TableHead>
            <TableHead className="w-[8%]">{t("columns.year")}</TableHead>
            <TableHead className="w-[12%]">{t("columns.status")}</TableHead>
            <TableHead className="w-[12%]">{t("columns.tmdb")}</TableHead>
            <TableHead className="w-[10%]">{t("columns.priceZones")}</TableHead>
            <TableHead className="w-[10%]">{t("columns.orders")}</TableHead>
            <TableHead className="w-[6%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {showSkeleton ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="border-b border-border/40">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-8 rounded" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-10" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8 rounded" />
                </TableCell>
              </TableRow>
            ))
          ) : filmRows.length === 0 ? (
            <TableRow className="border-b border-border/40">
              <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                {t("noResults")}
              </TableCell>
            </TableRow>
          ) : (
            filmRows.map((film) => (
              <TableRow key={film.id} className="border-b border-border/40">
                <TableCell>
                  <Link
                    href={`/${locale}/admin/films/${film.id}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    {film.posterUrl ? (
                      <Image
                        src={film.posterUrl}
                        alt={film.title}
                        width={32}
                        height={48}
                        className="h-12 w-8 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex h-12 w-8 shrink-0 items-center justify-center rounded">
                        <Film className="text-muted-foreground h-4 w-4" />
                      </div>
                    )}
                    <span className="text-primary truncate font-medium">{film.title}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground truncate text-sm">
                  <Link
                    href={`/${locale}/admin/rights-holders/${film.rightsHolderAccountId}`}
                    className="text-primary hover:underline"
                  >
                    {film.rightsHolderName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {film.releaseYear ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[film.status]}>{t(`status.${film.status}`)}</Badge>
                </TableCell>
                <TableCell>
                  {film.tmdbMatchStatus ? (
                    <Badge variant={TMDB_VARIANTS[film.tmdbMatchStatus] ?? "secondary"}>
                      {t(`tmdb.${film.tmdbMatchStatus}`)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{film.priceZoneCount}</TableCell>
                <TableCell className="text-sm">{film.orderCount}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/${locale}/admin/films/${film.id}`)}
                      >
                        <Eye className="mr-2 size-4" />
                        {t("view")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {total > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            {t("pagination.info", { page: currentPage, total: totalPages })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <ChevronLeft className="mr-1 size-4" />
              {t("pagination.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || loading}
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
