"use client";

import { ChevronLeft, ChevronRight, FileText, Loader2, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getAuditLogsPaginated } from "@/app/[locale]/admin/logs/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

import type { AuditLogRow } from "@/lib/services/admin-audit-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLogListProps {
  initialLogs: AuditLogRow[];
  initialTotal: number;
  availableActions: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "account.suspended": "destructive",
  "account.reactivated": "default",
  "commission.updated": "outline",
  "settings.updated": "outline",
  "order.refunded": "destructive",
  "request.force_approved": "default",
  "request.force_rejected": "destructive",
  "request.cancelled": "secondary",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AuditLogList({ initialLogs, initialTotal, availableActions }: AuditLogListProps) {
  const t = useTranslations("admin.logs");
  const locale = useLocale();
  const [logRows, setLogRows] = useState<AuditLogRow[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [searchInput, setSearchInput] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState<"search" | "page" | "tab" | null>(null);
  const isInitialMount = useRef(true);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const fetchLogs = useCallback(
    async (search: string, page: number, action: string) => {
      setLoading(true);
      try {
        const result = await getAuditLogsPaginated({
          search: search || undefined,
          action: action === "all" ? undefined : action,
          page,
          limit: ITEMS_PER_PAGE,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        setLogRows(result.logs ?? []);
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
      fetchLogs(searchInput, 1, actionFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, fetchLogs, actionFilter]);

  function handleActionFilterChange(value: string) {
    setActionFilter(value);
    setLoadingSource("tab");
    setCurrentPage(1);
    fetchLogs(searchInput, 1, value);
  }

  function handlePageChange(page: number) {
    setLoadingSource("page");
    setCurrentPage(page);
    fetchLogs(searchInput, page, actionFilter);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatMetadata(metadata: string | null): string {
    if (!metadata) return "—";
    try {
      const parsed = JSON.parse(metadata) as Record<string, unknown>;
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(", ");
    } catch {
      return metadata;
    }
  }

  function formatEntityId(id: string | null): string {
    if (!id) return "—";
    return id.substring(0, 8);
  }

  const showSkeleton = loading && loadingSource !== "search";

  // ─── Empty state ─────────────────────────────────────────────────────────

  if (
    initialTotal === 0 &&
    total === 0 &&
    !searchInput.trim() &&
    actionFilter === "all" &&
    !loading
  ) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FileText className="text-muted-foreground mb-4 size-12" />
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
        {availableActions.length > 0 && (
          <Select value={actionFilter} onValueChange={handleActionFilterChange}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filter.allActions")}</SelectItem>
              {availableActions.map((action) => (
                <SelectItem key={action} value={action}>
                  {t(`actions.${action.replaceAll(".", "_")}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="border-border/40">
            <TableHead className="w-[18%]">{t("columns.date")}</TableHead>
            <TableHead className="w-[20%]">{t("columns.action")}</TableHead>
            <TableHead className="w-[10%]">{t("columns.entity")}</TableHead>
            <TableHead className="w-[17%]">{t("columns.performedBy")}</TableHead>
            <TableHead className="w-[35%]">{t("columns.details")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {showSkeleton ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="border-b border-border/40">
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-32 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
              </TableRow>
            ))
          ) : logRows.length === 0 ? (
            <TableRow className="border-b border-border/40">
              <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                {t("noResults")}
              </TableCell>
            </TableRow>
          ) : (
            logRows.map((log) => (
              <TableRow key={log.id} className="border-b border-border/40">
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(log.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={ACTION_VARIANTS[log.action] ?? "secondary"}>
                    {t(`actions.${log.action.replaceAll(".", "_")}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {log.entityType ? `${log.entityType}:${formatEntityId(log.entityId)}` : "—"}
                </TableCell>
                <TableCell className="truncate text-sm">{log.performedByName ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground truncate text-xs">
                  {formatMetadata(log.metadata)}
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
