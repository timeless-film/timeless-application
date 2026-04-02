"use client";

import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  PlayCircle,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  getExhibitorsPaginated,
  reactivateExhibitorAction,
  suspendExhibitorAction,
} from "@/app/[locale]/admin/exhibitors/actions";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCountryOptions } from "@/lib/countries";

import type { AdminAccountRow } from "@/lib/services/admin-accounts-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExhibitorListProps {
  initialAccounts: AdminAccountRow[];
  initialTotal: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

export function ExhibitorList({ initialAccounts, initialTotal }: ExhibitorListProps) {
  const t = useTranslations("admin.exhibitors");
  const locale = useLocale();
  const router = useRouter();
  const countryOptions = getCountryOptions(locale);
  const [accounts, setAccounts] = useState<AdminAccountRow[]>(initialAccounts);
  const [total, setTotal] = useState(initialTotal);
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState<"search" | "page" | null>(null);
  const isInitialMount = useRef(true);

  // Suspend/reactivate dialog
  const [suspendTarget, setSuspendTarget] = useState<AdminAccountRow | null>(null);
  const [suspending, setSuspending] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  function getCountryName(code: string) {
    return countryOptions.find((c) => c.value === code)?.label ?? code;
  }

  const fetchAccounts = useCallback(
    async (search: string, page: number) => {
      setLoading(true);
      try {
        const result = await getExhibitorsPaginated({
          search: search || undefined,
          page,
          limit: ITEMS_PER_PAGE,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        setAccounts(result.accounts ?? []);
        setTotal(result.total ?? 0);
      } catch {
        toast.error(t("error.unexpected"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setLoadingSource("search");
      setCurrentPage(1);
      fetchAccounts(searchInput, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, fetchAccounts]);

  function handlePageChange(page: number) {
    setLoadingSource("page");
    setCurrentPage(page);
    fetchAccounts(searchInput, page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSuspendToggle() {
    if (!suspendTarget) return;
    setSuspending(true);
    try {
      const isSuspended = suspendTarget.status === "suspended";
      const result = isSuspended
        ? await reactivateExhibitorAction(suspendTarget.id)
        : await suspendExhibitorAction(suspendTarget.id);

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(isSuspended ? t("reactivated") : t("suspended"));
        await fetchAccounts(searchInput, currentPage);
      }
    } catch {
      toast.error(t("error.unexpected"));
    } finally {
      setSuspending(false);
      setSuspendTarget(null);
    }
  }

  // ─── Empty state ─────────────────────────────────────────────────────────

  if (initialTotal === 0 && total === 0 && !searchInput.trim() && !loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Users className="text-muted-foreground mb-4 size-12" />
        <p className="text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  // ─── Table ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
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

      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="border-border/40">
            <TableHead className="w-[25%]">{t("columns.name")}</TableHead>
            <TableHead className="w-[15%]">{t("columns.country")}</TableHead>
            <TableHead className="w-[12%]">{t("columns.cinemas")}</TableHead>
            <TableHead className="w-[12%]">{t("columns.orders")}</TableHead>
            <TableHead className="w-[15%]">{t("columns.onboarding")}</TableHead>
            <TableHead className="w-[12%]">{t("columns.status")}</TableHead>
            <TableHead className="w-[9%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && loadingSource !== "search" ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="border-b border-border/40">
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8 rounded" />
                </TableCell>
              </TableRow>
            ))
          ) : accounts.length === 0 ? (
            <TableRow className="border-b border-border/40">
              <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                {t("noResults")}
              </TableCell>
            </TableRow>
          ) : (
            accounts.map((account) => (
              <TableRow key={account.id} className="border-b border-border/40">
                <TableCell className="font-medium">
                  <Link
                    href={`/${locale}/admin/exhibitors/${account.id}`}
                    className="text-primary hover:underline"
                  >
                    {account.companyName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {getCountryName(account.country)}
                </TableCell>
                <TableCell>{account.cinemaCount}</TableCell>
                <TableCell>{account.orderCount}</TableCell>
                <TableCell>
                  <Badge variant={account.onboardingCompleted ? "default" : "secondary"}>
                    {account.onboardingCompleted
                      ? t("onboarding.complete")
                      : t("onboarding.incomplete")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={account.status === "active" ? "default" : "destructive"}>
                    {t(`status.${account.status}`)}
                  </Badge>
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
                        onClick={() => router.push(`/${locale}/admin/exhibitors/${account.id}`)}
                      >
                        <Eye className="mr-2 size-4" />
                        {t("view")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {account.status === "active" ? (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setSuspendTarget(account)}
                        >
                          <Ban className="mr-2 size-4" />
                          {t("suspend")}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setSuspendTarget(account)}>
                          <PlayCircle className="mr-2 size-4" />
                          {t("reactivate")}
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

      {/* Suspend / Reactivate dialog */}
      <Dialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {suspendTarget?.status === "suspended" ? t("reactivate") : t("suspend")}
            </DialogTitle>
            <DialogDescription>
              {suspendTarget?.status === "suspended"
                ? t("reactivateConfirm", { name: suspendTarget?.companyName ?? "" })
                : t("suspendConfirm", { name: suspendTarget?.companyName ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant={suspendTarget?.status === "suspended" ? "default" : "destructive"}
              onClick={handleSuspendToggle}
              disabled={suspending}
            >
              {suspending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {suspendTarget?.status === "suspended" ? t("reactivate") : t("suspend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
