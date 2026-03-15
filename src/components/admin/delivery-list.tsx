"use client";

import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Loader2,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getDeliveriesPaginated,
  updateDeliveryNotesAction,
  updateDeliveryStatusAction,
} from "@/app/[locale]/admin/deliveries/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";

import type { AdminDeliveryRow } from "@/lib/services/admin-delivery-service";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliveryStatus = "pending" | "in_progress" | "delivered";
type TabValue = "pending" | "in_progress" | "delivered" | "all";

interface DeliveryListProps {
  initialDeliveries: AdminDeliveryRow[];
  initialTotal: number;
  deliveryUrgencyDaysBeforeStart: number;
}

type DialogMode = "take_over" | "mark_delivered" | "edit_notes" | null;

interface DialogState {
  mode: DialogMode;
  item: AdminDeliveryRow | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

const STATUS_VARIANTS: Record<DeliveryStatus, "default" | "secondary" | "destructive" | "outline"> =
  {
    pending: "outline",
    in_progress: "secondary",
    delivered: "default",
  };

// ─── Component ────────────────────────────────────────────────────────────────

export function DeliveryList({
  initialDeliveries,
  initialTotal,
  deliveryUrgencyDaysBeforeStart,
}: DeliveryListProps) {
  const t = useTranslations("admin.deliveries");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [deliveryRows, setDeliveryRows] = useState<AdminDeliveryRow[]>(initialDeliveries);
  const [total, setTotal] = useState(initialTotal);
  const [searchInput, setSearchInput] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState<"search" | "page" | "tab" | null>(null);
  const isInitialMount = useRef(true);

  // Dialog state
  const [dialog, setDialog] = useState<DialogState>({ mode: null, item: null });
  const [dialogNotes, setDialogNotes] = useState("");
  const [dialogLabOrderNumber, setDialogLabOrderNumber] = useState("");
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const fetchDeliveries = useCallback(
    async (search: string, page: number, tab: TabValue) => {
      setLoading(true);
      try {
        const result = await getDeliveriesPaginated({
          search: search || undefined,
          status: tab === "all" ? undefined : tab,
          page,
          limit: ITEMS_PER_PAGE,
          deliveryUrgencyDaysBeforeStart,
        });
        if ("error" in result) {
          toast.error(t("error.unexpected"));
          return;
        }
        setDeliveryRows(result.deliveries ?? []);
        setTotal(result.total ?? 0);
      } catch {
        toast.error(t("error.unexpected"));
      } finally {
        setLoading(false);
      }
    },
    [t, deliveryUrgencyDaysBeforeStart]
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
      fetchDeliveries(searchInput, 1, activeTab);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, fetchDeliveries, activeTab]);

  function handleTabChange(value: string) {
    const newTab = value as TabValue;
    setActiveTab(newTab);
    setLoadingSource("tab");
    setCurrentPage(1);
    fetchDeliveries(searchInput, 1, newTab);
  }

  function handlePageChange(page: number) {
    setLoadingSource("page");
    setCurrentPage(page);
    fetchDeliveries(searchInput, page, activeTab);
  }

  function openDialog(mode: DialogMode, item: AdminDeliveryRow) {
    setDialog({ mode, item });
    setDialogNotes(item.deliveryNotes ?? "");
    setDialogLabOrderNumber(item.labOrderNumber ?? "");
  }

  function closeDialog() {
    setDialog({ mode: null, item: null });
    setDialogNotes("");
    setDialogLabOrderNumber("");
  }

  function handleStatusChange(newStatus: DeliveryStatus) {
    if (!dialog.item) return;
    startTransition(async () => {
      const result = await updateDeliveryStatusAction(
        dialog.item!.orderItemId,
        newStatus,
        dialogNotes || undefined,
        dialogLabOrderNumber || undefined
      );
      if ("error" in result) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("statusUpdated"));
      closeDialog();
      fetchDeliveries(searchInput, currentPage, activeTab);
    });
  }

  function handleNotesUpdate() {
    if (!dialog.item) return;
    startTransition(async () => {
      const result = await updateDeliveryNotesAction(
        dialog.item!.orderItemId,
        dialogNotes,
        dialogLabOrderNumber || undefined
      );
      if ("error" in result) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("notesUpdated"));
      closeDialog();
      fetchDeliveries(searchInput, currentPage, activeTab);
    });
  }

  function formatDate(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatOrderNumber(num: number) {
    return `ORD-${String(num).padStart(6, "0")}`;
  }

  function getUrgencyBadge(urgencyDays: number | null) {
    if (urgencyDays === null) return null;
    const halfThreshold = Math.ceil(deliveryUrgencyDaysBeforeStart / 2);

    if (urgencyDays < 0) {
      return (
        <Badge variant="destructive" className="bg-black text-white">
          {t("urgency.overdue")}
        </Badge>
      );
    }
    if (urgencyDays <= halfThreshold) {
      return <Badge variant="destructive">{t("urgency.critical", { days: urgencyDays })}</Badge>;
    }
    if (urgencyDays <= deliveryUrgencyDaysBeforeStart) {
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
          {t("urgency.high", { days: urgencyDays })}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-green-600">
        {t("urgency.normal", { days: urgencyDays })}
      </Badge>
    );
  }

  const showSkeleton = loading && loadingSource !== "search";

  return (
    <div className="space-y-4">
      {/* Search & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="pending">{t("tabs.pending")}</TabsTrigger>
            <TabsTrigger value="in_progress">{t("tabs.inProgress")}</TabsTrigger>
            <TabsTrigger value="delivered">{t("tabs.delivered")}</TabsTrigger>
            <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
          </TabsList>
        </Tabs>

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
      </div>

      {/* Table */}
      <div className="rounded-md">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">{t("columns.film")}</TableHead>
              <TableHead className="w-[10%]">{t("columns.order")}</TableHead>
              <TableHead className="w-[16%]">{t("columns.cinema")}</TableHead>
              <TableHead className="w-[14%]">{t("columns.rightsHolder")}</TableHead>
              <TableHead className="w-[10%]">{t("columns.startDate")}</TableHead>
              <TableHead className="w-[10%]">{t("columns.labOrder")}</TableHead>
              <TableHead className="w-[7%]">{t("columns.urgency")}</TableHead>
              <TableHead className="w-[7%]">{t("columns.status")}</TableHead>
              <TableHead className="w-[8%]">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-10" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : deliveryRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                  {initialTotal === 0 &&
                  total === 0 &&
                  !searchInput.trim() &&
                  activeTab === "pending"
                    ? t("empty")
                    : t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              deliveryRows.map((row) => (
                <TableRow key={row.orderItemId}>
                  <TableCell className="truncate font-medium">{row.filmTitle}</TableCell>
                  <TableCell className="font-mono text-sm">
                    <Link
                      href={`/${locale}/admin/orders/${row.orderId}`}
                      className="text-primary hover:underline"
                    >
                      {formatOrderNumber(row.orderNumber)}
                    </Link>
                  </TableCell>
                  <TableCell className="truncate">
                    {row.cinemaName}
                    <span className="text-muted-foreground"> — {row.roomName}</span>
                  </TableCell>
                  <TableCell className="truncate">{row.rightsHolderName}</TableCell>
                  <TableCell>{formatDate(row.startDate)}</TableCell>
                  <TableCell className="truncate text-sm">{row.labOrderNumber || "—"}</TableCell>
                  <TableCell>{getUrgencyBadge(row.urgencyDays)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[row.deliveryStatus] ?? "outline"}>
                      {t(`status.${row.deliveryStatus}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {row.deliveryStatus === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t("actions.takeOver")}
                          onClick={() => openDialog("take_over", row)}
                        >
                          <Truck className="h-4 w-4" />
                        </Button>
                      )}
                      {(row.deliveryStatus === "pending" ||
                        row.deliveryStatus === "in_progress") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t("actions.markDelivered")}
                          onClick={() => openDialog("mark_delivered", row)}
                        >
                          <PackageCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={t("actions.editNotes")}
                        onClick={() => openDialog("edit_notes", row)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
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

      {/* Take Over Dialog */}
      <Dialog open={dialog.mode === "take_over"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialog.takeOver.title")}</DialogTitle>
            <DialogDescription>
              {dialog.item && t("dialog.takeOver.description", { film: dialog.item.filmTitle })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="take-over-lab">{t("dialog.labOrderNumber")}</Label>
              <Input
                id="take-over-lab"
                value={dialogLabOrderNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDialogLabOrderNumber(e.target.value)
                }
                placeholder={t("dialog.labOrderNumberPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="take-over-notes">{t("dialog.notes")}</Label>
              <Textarea
                id="take-over-notes"
                value={dialogNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setDialogNotes(e.target.value)
                }
                placeholder={t("dialog.notesPlaceholder")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={() => handleStatusChange("in_progress")} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("dialog.takeOver.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Delivered Dialog */}
      <Dialog
        open={dialog.mode === "mark_delivered"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialog.markDelivered.title")}</DialogTitle>
            <DialogDescription>
              {dialog.item &&
                t("dialog.markDelivered.description", { film: dialog.item.filmTitle })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delivered-lab">{t("dialog.labOrderNumber")}</Label>
              <Input
                id="delivered-lab"
                value={dialogLabOrderNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDialogLabOrderNumber(e.target.value)
                }
                placeholder={t("dialog.labOrderNumberPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivered-notes">{t("dialog.notes")}</Label>
              <Textarea
                id="delivered-notes"
                value={dialogNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setDialogNotes(e.target.value)
                }
                placeholder={t("dialog.notesPlaceholder")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={() => handleStatusChange("delivered")} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("dialog.markDelivered.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Notes Dialog */}
      <Dialog open={dialog.mode === "edit_notes"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialog.editNotes.title")}</DialogTitle>
            <DialogDescription>
              {dialog.item && t("dialog.editNotes.description", { film: dialog.item.filmTitle })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-lab">{t("dialog.labOrderNumber")}</Label>
              <Input
                id="edit-lab"
                value={dialogLabOrderNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDialogLabOrderNumber(e.target.value)
                }
                placeholder={t("dialog.labOrderNumberPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">{t("dialog.notes")}</Label>
              <Textarea
                id="edit-notes"
                value={dialogNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setDialogNotes(e.target.value)
                }
                placeholder={t("dialog.notesPlaceholder")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleNotesUpdate} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("dialog.editNotes.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
