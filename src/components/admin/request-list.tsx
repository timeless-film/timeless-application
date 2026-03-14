"use client";

import {
  AlertTriangle,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  adminCancelRequestAction,
  forceApproveRequestAction,
  forceRejectRequestAction,
  getRequestsPaginated,
} from "@/app/[locale]/admin/requests/actions";
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
  DropdownMenuSeparator,
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
import { formatAmount } from "@/lib/pricing/format";

import type { AdminRequestRow } from "@/lib/services/admin-requests-service";
import type { RequestStatus } from "@/lib/services/request-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestListProps {
  initialRequests: AdminRequestRow[];
  initialTotal: number;
}

type DialogAction = "approve" | "reject" | "cancel";

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
  cancelled: "secondary",
  paid: "default",
};

const FILTER_STATUSES: RequestStatus[] = ["pending", "approved", "rejected", "cancelled", "paid"];

// ─── Component ────────────────────────────────────────────────────────────────

export function RequestList({ initialRequests, initialTotal }: RequestListProps) {
  const t = useTranslations("admin.requests");
  const locale = useLocale();
  const router = useRouter();
  const [requestRows, setRequestRows] = useState<AdminRequestRow[]>(initialRequests);
  const [total, setTotal] = useState(initialTotal);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState<"search" | "page" | "tab" | null>(null);
  const isInitialMount = useRef(true);

  // Action dialog
  const [dialogAction, setDialogAction] = useState<DialogAction | null>(null);
  const [dialogTarget, setDialogTarget] = useState<AdminRequestRow | null>(null);
  const [acting, setActing] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const fetchRequests = useCallback(
    async (search: string, page: number, status: RequestStatus | "all") => {
      setLoading(true);
      try {
        const result = await getRequestsPaginated({
          search: search || undefined,
          status: status === "all" ? undefined : status,
          page,
          limit: ITEMS_PER_PAGE,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        setRequestRows(result.requests ?? []);
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
      fetchRequests(searchInput, 1, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, fetchRequests, statusFilter]);

  function handleStatusFilterChange(value: string) {
    const newStatus = value as RequestStatus | "all";
    setStatusFilter(newStatus);
    setLoadingSource("tab");
    setCurrentPage(1);
    fetchRequests(searchInput, 1, newStatus);
  }

  function handlePageChange(page: number) {
    setLoadingSource("page");
    setCurrentPage(page);
    fetchRequests(searchInput, page, statusFilter);
  }

  function openDialog(action: DialogAction, target: AdminRequestRow) {
    setDialogAction(action);
    setDialogTarget(target);
  }

  async function handleConfirmAction() {
    if (!dialogTarget || !dialogAction) return;
    setActing(true);
    try {
      let result;
      if (dialogAction === "approve") {
        result = await forceApproveRequestAction(dialogTarget.id);
      } else if (dialogAction === "reject") {
        result = await forceRejectRequestAction(dialogTarget.id);
      } else {
        result = await adminCancelRequestAction(dialogTarget.id);
      }

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(t(`actionSuccess.${dialogAction}`));
        await fetchRequests(searchInput, currentPage, statusFilter);
      }
    } catch {
      toast.error(t("error.unexpected"));
    } finally {
      setActing(false);
      setDialogAction(null);
      setDialogTarget(null);
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatRequestId(id: string) {
    return id.substring(0, 8);
  }

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
        <Search className="text-muted-foreground mb-4 size-12" />
        <p className="text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  // ─── Table ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filters row */}
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
            <TableHead className="w-[8%]">{t("columns.id")}</TableHead>
            <TableHead className="w-[14%]">{t("columns.exhibitor")}</TableHead>
            <TableHead className="w-[14%]">{t("columns.rightsHolder")}</TableHead>
            <TableHead className="w-[16%]">{t("columns.film")}</TableHead>
            <TableHead className="w-[12%]">{t("columns.dates")}</TableHead>
            <TableHead className="w-[10%]">{t("columns.amount")}</TableHead>
            <TableHead className="w-[10%]">{t("columns.status")}</TableHead>
            <TableHead className="w-[10%]">{t("columns.createdAt")}</TableHead>
            <TableHead className="w-[6%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && loadingSource !== "search" ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="border-b border-border/40">
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8 rounded" />
                </TableCell>
              </TableRow>
            ))
          ) : requestRows.length === 0 ? (
            <TableRow className="border-b border-border/40">
              <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                {t("noResults")}
              </TableCell>
            </TableRow>
          ) : (
            requestRows.map((req) => (
              <TableRow key={req.id} className="border-b border-border/40">
                <TableCell className="text-muted-foreground font-mono text-xs">
                  <Link
                    href={`/${locale}/admin/requests/${req.id}`}
                    className="text-primary hover:underline"
                  >
                    {formatRequestId(req.id)}
                  </Link>
                </TableCell>
                <TableCell className="truncate text-sm">
                  <Link
                    href={`/${locale}/admin/exhibitors/${req.exhibitorAccountId}`}
                    className="text-primary hover:underline"
                  >
                    {req.exhibitorName}
                  </Link>
                </TableCell>
                <TableCell className="truncate text-sm">
                  <Link
                    href={`/${locale}/admin/rights-holders/${req.rightsHolderAccountId}`}
                    className="text-primary hover:underline"
                  >
                    {req.rightsHolderName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/${locale}/admin/films/${req.filmId}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    {req.filmPosterUrl ? (
                      <Image
                        src={req.filmPosterUrl}
                        alt={req.filmTitle}
                        width={32}
                        height={48}
                        className="h-12 w-8 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex h-12 w-8 shrink-0 items-center justify-center rounded">
                        <span className="text-muted-foreground text-xs">🎬</span>
                      </div>
                    )}
                    <span className="text-primary truncate font-medium">{req.filmTitle}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDate(req.startDate)}
                  {req.endDate ? ` → ${formatDate(req.endDate)}` : ""}
                </TableCell>
                <TableCell className="text-sm">
                  {formatAmount(req.displayedPrice, req.currency, locale)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Badge variant={STATUS_VARIANTS[req.status] ?? "secondary"}>
                      {t(`status.${req.status}`)}
                    </Badge>
                    {req.isUrgent && req.status === "pending" && (
                      <AlertTriangle className="size-4 text-orange-500" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDate(req.createdAt.toString())}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/${locale}/admin/requests/${req.id}`)}
                      >
                        <Eye className="mr-2 size-4" />
                        {t("view")}
                      </DropdownMenuItem>
                      {req.status === "pending" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openDialog("approve", req)}>
                            <Check className="mr-2 size-4" />
                            {t("actions.forceApprove")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDialog("reject", req)}>
                            <X className="mr-2 size-4" />
                            {t("actions.forceReject")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => openDialog("cancel", req)}
                          >
                            <Ban className="mr-2 size-4" />
                            {t("actions.cancel")}
                          </DropdownMenuItem>
                        </>
                      )}
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

      {/* Confirm action dialog */}
      <Dialog
        open={!!dialogAction && !!dialogTarget}
        onOpenChange={() => {
          setDialogAction(null);
          setDialogTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogAction && t(`dialog.${dialogAction}.title`)}</DialogTitle>
            <DialogDescription>
              {dialogAction &&
                t(`dialog.${dialogAction}.description`, {
                  film: dialogTarget?.filmTitle ?? "",
                  exhibitor: dialogTarget?.exhibitorName ?? "",
                })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogAction(null);
                setDialogTarget(null);
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              variant={dialogAction === "approve" ? "default" : "destructive"}
              onClick={handleConfirmAction}
              disabled={acting}
            >
              {acting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {dialogAction && t(`dialog.${dialogAction}.confirm`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
