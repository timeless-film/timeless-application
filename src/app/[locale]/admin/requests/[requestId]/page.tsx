"use client";

import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  adminCancelRequestAction,
  forceApproveRequestAction,
  forceRejectRequestAction,
  getRequestDetailAction,
} from "@/app/[locale]/admin/requests/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount } from "@/lib/pricing/format";

import type { AdminRequestDetail } from "@/lib/services/admin-requests-service";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
  cancelled: "secondary",
  paid: "default",
};

type DialogAction = "approve" | "reject" | "cancel";

// ─── Component ────────────────────────────────────────────────────────────────

export default function RequestDetailPage() {
  const t = useTranslations("admin.requests");
  const tDetail = useTranslations("admin.requests.detail");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<AdminRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Action dialog
  const [dialogAction, setDialogAction] = useState<DialogAction | null>(null);
  const [acting, setActing] = useState(false);

  const fetchRequest = useCallback(async () => {
    setLoading(true);
    const result = await getRequestDetailAction(params.requestId);
    if ("error" in result) {
      toast.error(t("error.unexpected"));
      setLoading(false);
      return;
    }
    setRequest(result.data);
    setLoading(false);
  }, [params.requestId, t]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  function formatDate(date: Date | string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function handleConfirmAction() {
    if (!request || !dialogAction) return;
    setActing(true);
    try {
      let result;
      if (dialogAction === "approve") {
        result = await forceApproveRequestAction(request.id);
      } else if (dialogAction === "reject") {
        result = await forceRejectRequestAction(request.id);
      } else {
        result = await adminCancelRequestAction(request.id);
      }

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(t(`actionSuccess.${dialogAction}`));
        fetchRequest();
      }
    } catch {
      toast.error(t("error.unexpected"));
    } finally {
      setActing(false);
      setDialogAction(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push(`/${locale}/admin/requests`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("title")}
        </Button>
        <p className="text-muted-foreground">{t("noResults")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/admin/requests`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl">
              <Link
                href={`/${locale}/admin/films/${request.filmId}`}
                className="text-primary hover:underline"
              >
                {request.filmTitle}
              </Link>
            </h1>
            <p className="text-muted-foreground text-sm">
              <Link
                href={`/${locale}/admin/exhibitors/${request.exhibitorAccountId}`}
                className="text-primary hover:underline"
              >
                {request.exhibitorName}
              </Link>
              {" → "}
              <Link
                href={`/${locale}/admin/rights-holders/${request.rightsHolderAccountId}`}
                className="text-primary hover:underline"
              >
                {request.rightsHolderName}
              </Link>
            </p>
          </div>
          <Badge variant={STATUS_VARIANTS[request.status] ?? "outline"}>
            {t(`status.${request.status}`)}
          </Badge>
        </div>
        {request.status === "pending" && (
          <div className="flex gap-2">
            <Button onClick={() => setDialogAction("approve")}>{t("actions.forceApprove")}</Button>
            <Button variant="outline" onClick={() => setDialogAction("reject")}>
              {t("actions.forceReject")}
            </Button>
            <Button variant="destructive" onClick={() => setDialogAction("cancel")}>
              {t("actions.cancel")}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Booking info */}
        <Card>
          <CardHeader>
            <CardTitle>{tDetail("booking")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("film")}</dt>
                <dd className="font-medium">
                  <Link
                    href={`/${locale}/admin/films/${request.filmId}`}
                    className="text-primary hover:underline"
                  >
                    {request.filmTitle}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("exhibitor")}</dt>
                <dd>
                  <Link
                    href={`/${locale}/admin/exhibitors/${request.exhibitorAccountId}`}
                    className="text-primary hover:underline"
                  >
                    {request.exhibitorName}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("rightsHolder")}</dt>
                <dd>
                  <Link
                    href={`/${locale}/admin/rights-holders/${request.rightsHolderAccountId}`}
                    className="text-primary hover:underline"
                  >
                    {request.rightsHolderName}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("cinema")}</dt>
                <dd>
                  {request.cinemaName} / {request.roomName}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("screenings")}</dt>
                <dd>{request.screeningCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("dates")}</dt>
                <dd>
                  {formatDate(request.startDate)}
                  {request.endDate ? ` → ${formatDate(request.endDate)}` : ""}
                </dd>
              </div>
              {request.note && (
                <div>
                  <dt className="text-muted-foreground text-sm">{tDetail("note")}</dt>
                  <dd className="text-sm">{request.note}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("created")}</dt>
                <dd>{formatDate(request.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Pricing breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>{tDetail("pricing")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("catalogPrice")}</dt>
                <dd>{formatAmount(request.catalogPrice, request.currency, locale)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("displayedPrice")}</dt>
                <dd className="text-lg font-bold">
                  {formatAmount(request.displayedPrice, request.currency, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("rhAmount")}</dt>
                <dd>
                  {formatAmount(
                    request.rightsHolderAmount * request.screeningCount,
                    request.currency,
                    locale
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("timelessAmount")}</dt>
                <dd>
                  {formatAmount(
                    request.timelessAmount * request.screeningCount,
                    request.currency,
                    locale
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("deliveryFees")}</dt>
                <dd>{formatAmount(request.deliveryFees, request.currency, locale)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("margin")}</dt>
                <dd>{(parseFloat(request.platformMarginRate) * 100).toFixed(0)}%</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("commission")}</dt>
                <dd>{(parseFloat(request.commissionRate) * 100).toFixed(0)}%</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Status timeline / notes */}
      {(request.rejectionReason ||
        request.cancellationReason ||
        request.approvalNote ||
        request.paidAt) && (
        <Card>
          <CardHeader>
            <CardTitle>{tDetail("timeline")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {request.approvedAt && (
                <div className="flex gap-3">
                  <Badge variant="default">{t("status.approved")}</Badge>
                  <span className="text-muted-foreground text-sm">
                    {formatDate(request.approvedAt)}
                  </span>
                  {request.approvalNote && <span className="text-sm">{request.approvalNote}</span>}
                </div>
              )}
              {request.rejectedAt && (
                <div className="flex gap-3">
                  <Badge variant="destructive">{t("status.rejected")}</Badge>
                  <span className="text-muted-foreground text-sm">
                    {formatDate(request.rejectedAt)}
                  </span>
                  {request.rejectionReason && (
                    <span className="text-sm">
                      <AlertTriangle className="mr-1 inline size-3" />
                      {request.rejectionReason}
                    </span>
                  )}
                </div>
              )}
              {request.cancelledAt && (
                <div className="flex gap-3">
                  <Badge variant="secondary">{t("status.cancelled")}</Badge>
                  <span className="text-muted-foreground text-sm">
                    {formatDate(request.cancelledAt)}
                  </span>
                  {request.cancellationReason && (
                    <span className="text-sm">{request.cancellationReason}</span>
                  )}
                </div>
              )}
              {request.paidAt && (
                <div className="flex gap-3">
                  <Badge variant="default">{t("status.paid")}</Badge>
                  <span className="text-muted-foreground text-sm">
                    {formatDate(request.paidAt)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm action dialog */}
      <Dialog open={!!dialogAction} onOpenChange={() => setDialogAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogAction && t(`dialog.${dialogAction}.title`)}</DialogTitle>
            <DialogDescription>
              {dialogAction &&
                t(`dialog.${dialogAction}.description`, {
                  film: request.filmTitle,
                  exhibitor: request.exhibitorName,
                })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAction(null)} disabled={acting}>
              {t("cancel")}
            </Button>
            <Button
              variant={dialogAction === "approve" ? "default" : "destructive"}
              onClick={handleConfirmAction}
              disabled={acting}
            >
              {acting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogAction && t(`dialog.${dialogAction}.confirm`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
