"use client";

import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  EyeOff,
  Film,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  archiveFilmAction,
  getFilmsPaginated,
  setFilmStatusAction,
} from "@/app/[locale]/(rights-holder)/films/actions";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilmPrice {
  id: string;
  filmId: string;
  countries: string[];
  price: number;
  currency: string;
}

interface FilmRow {
  id: string;
  title: string;
  externalId: string | null;
  status: "active" | "inactive" | "retired";
  type: "direct" | "validation";
  tmdbMatchStatus: "matched" | "pending" | "no_match" | "manual" | null;
  posterUrl: string | null;
  releaseYear: number | null;
  prices: FilmPrice[];
}

interface FilmListProps {
  initialFilms: FilmRow[];
  initialTotal: number;
  currentUserRole: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FILMS_PER_PAGE = 20;

export function FilmList({ initialFilms, initialTotal, currentUserRole }: FilmListProps) {
  const t = useTranslations("films");
  const [films, setFilms] = useState<FilmRow[]>(initialFilms);
  const [total, setTotal] = useState(initialTotal);
  const [archiveTarget, setArchiveTarget] = useState<FilmRow | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState<"search" | "page" | null>(null);
  const isInitialMount = useRef(true);

  const canEdit = currentUserRole === "owner" || currentUserRole === "admin";
  const totalPages = Math.max(1, Math.ceil(total / FILMS_PER_PAGE));

  const fetchFilms = useCallback(
    async (search: string, page: number) => {
      setLoading(true);
      try {
        const result = await getFilmsPaginated({
          search: search || undefined,
          page,
          limit: FILMS_PER_PAGE,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        setFilms(result.films as FilmRow[]);
        setTotal(result.total);
      } catch {
        toast.error(t("unexpectedError"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  // Debounce search — skip first render (uses initialData)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setLoadingSource("search");
      setCurrentPage(1);
      fetchFilms(searchInput, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, fetchFilms]);

  function handlePageChange(page: number) {
    setLoadingSource("page");
    setCurrentPage(page);
    fetchFilms(searchInput, page);
  }

  function formatPriceRange(prices: FilmPrice[]): string {
    if (prices.length === 0) return "—";
    const amounts = prices.map((p) => p.price);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const currency = prices[0]?.currency ?? "";
    const fmt = (cents: number) => (cents / 100).toFixed(2);
    if (min === max) return `${fmt(min)} ${currency.toUpperCase()}`;
    return `${fmt(min)} – ${fmt(max)} ${currency.toUpperCase()}`;
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const result = await archiveFilmAction(archiveTarget.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(t("archiveSuccess"));
        await fetchFilms(searchInput, currentPage);
      }
    } catch {
      toast.error(t("unexpectedError"));
    } finally {
      setArchiving(false);
      setArchiveTarget(null);
    }
  }

  async function handleSetStatus(film: FilmRow, newStatus: "active" | "inactive") {
    try {
      const result = await setFilmStatusAction(film.id, newStatus);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(t("statusUpdateSuccess"));
      await fetchFilms(searchInput, currentPage);
    } catch {
      toast.error(t("unexpectedError"));
    }
  }

  function getStatusVariant(status: string) {
    switch (status) {
      case "active":
        return "default" as const;
      case "inactive":
        return "secondary" as const;
      case "retired":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  }

  function getTmdbStatusVariant(status: string | null) {
    switch (status) {
      case "matched":
        return "default" as const;
      case "pending":
        return "secondary" as const;
      case "no_match":
        return "outline" as const;
      case "manual":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  }

  function getTmdbStatusLabel(status: string | null) {
    switch (status) {
      case "matched":
        return t("tmdbStatus.matched");
      case "pending":
        return t("tmdbStatus.pending");
      case "no_match":
        return t("tmdbStatus.noMatch");
      case "manual":
        return t("tmdbStatus.manual");
      default:
        return "";
    }
  }

  // ─── Empty state (no films at all) ─────────────────────────────────────
  // Guard with initialTotal: if SSR found films, never flash this state.
  // Without this, clearing a search that returned 0 results causes a flash
  // during the 300ms debounce gap (total=0, searchInput="", loading=false).

  if (initialTotal === 0 && total === 0 && !searchInput.trim() && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl">{t("title")}</h1>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Film className="text-muted-foreground mb-4 size-12" />
          <p className="text-muted-foreground mb-4">{t("empty")}</p>
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/films/import">
                  <Upload className="mr-2 size-4" />
                  {t("importButton")}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/films/new">
                  <Plus className="mr-2 size-4" />
                  {t("add")}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Table ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">{t("title")}</h1>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/films/import">
                <Upload className="mr-2 size-4" />
                {t("importButton")}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/films/new">
                <Plus className="mr-2 size-4" />
                {t("add")}
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="relative">
        {loading && loadingSource === "search" ? (
          <Loader2 className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
        ) : (
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        )}
        <Input
          type="search"
          name="film-search"
          id="film-search"
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

      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/35 border-border/60 hover:bg-muted/35">
            <TableHead className="text-foreground/85 w-[44%] py-3 text-xs tracking-wide uppercase">
              {t("columns.title")}
            </TableHead>
            <TableHead className="text-foreground/85 w-[14%] py-3 text-xs tracking-wide uppercase">
              {t("columns.type")}
            </TableHead>
            <TableHead className="text-foreground/85 w-[14%] py-3 text-xs tracking-wide uppercase">
              {t("columns.status")}
            </TableHead>
            <TableHead className="text-foreground/85 w-[20%] py-3 text-xs tracking-wide uppercase">
              {t("columns.price")}
            </TableHead>
            {canEdit && (
              <TableHead className="text-foreground/85 w-[8%] py-3 text-xs tracking-wide uppercase" />
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && loadingSource !== "search" ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="border-b border-border/45">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-8 rounded" />
                    <div>
                      <Skeleton className="h-4 w-36 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded" />
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : films.length === 0 ? (
            <TableRow className="border-b border-border/45">
              <TableCell
                colSpan={canEdit ? 5 : 4}
                className="text-muted-foreground py-8 text-center"
              >
                {t("noResults")}
              </TableCell>
            </TableRow>
          ) : (
            films.map((film) => (
              <TableRow key={film.id} className="border-b border-border/45 hover:bg-muted/25">
                <TableCell>
                  <div className="flex items-center gap-3">
                    {film.posterUrl ? (
                      <Image
                        src={film.posterUrl}
                        alt={film.title}
                        width={32}
                        height={48}
                        className="h-12 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex h-12 w-8 items-center justify-center rounded">
                        <Film className="text-muted-foreground size-4" />
                      </div>
                    )}
                    <div>
                      <div className="font-heading text-base leading-tight">{film.title}</div>
                      <div className="flex items-center gap-2">
                        {film.releaseYear && (
                          <span className="text-muted-foreground text-xs">{film.releaseYear}</span>
                        )}
                        {film.tmdbMatchStatus && (
                          <Badge
                            variant={getTmdbStatusVariant(film.tmdbMatchStatus)}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {getTmdbStatusLabel(film.tmdbMatchStatus)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{t(`type.${film.type}`)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(film.status)}>
                    {t(`status.${film.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">
                    {formatPriceRange(film.prices)}
                  </span>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/films/${film.id}`}>
                            <Edit className="mr-2 size-4" />
                            {t("edit")}
                          </Link>
                        </DropdownMenuItem>
                        {film.status === "active" && (
                          <DropdownMenuItem onClick={() => handleSetStatus(film, "inactive")}>
                            <EyeOff className="mr-2 size-4" />
                            {t("setInactive")}
                          </DropdownMenuItem>
                        )}
                        {film.status === "inactive" && (
                          <DropdownMenuItem onClick={() => handleSetStatus(film, "active")}>
                            <Eye className="mr-2 size-4" />
                            {t("setActive")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setArchiveTarget(film)}
                        >
                          <Archive className="mr-2 size-4" />
                          {t("archive")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {total > FILMS_PER_PAGE && (
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

      {/* Archive confirmation dialog */}
      <Dialog open={!!archiveTarget} onOpenChange={() => setArchiveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("archive")}</DialogTitle>
            <DialogDescription>
              {archiveTarget && t("archiveConfirm", { title: archiveTarget.title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiving}>
              {archiving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
