"use client";

import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  approveRequest,
  rejectRequest,
} from "@/app/[locale]/(rights-holder)/validation-requests/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useInvalidatePendingRequestsCount } from "@/hooks/use-pending-requests-count";
import { Link } from "@/i18n/navigation";
import { formatAmount } from "@/lib/pricing/format";

interface RequestData {
  id: string;
  status: string;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  displayedPrice: number;
  rightsHolderAmount: number;
  currency: string;
  note: string | null;
  approvalNote: string | null;
  rejectionReason: string | null;
  approvedAt: string | Date | null;
  rejectedAt: string | Date | null;
  createdAt: string | Date;
  film: { id: string; title: string; posterUrl: string | null };
  exhibitorAccount: {
    id: string;
    companyName: string | null;
    country: string;
    vatNumber: string | null;
  };
  cinema: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    country: string;
  };
  room: { id: string; name: string; capacity: number };
  createdByUser: { id: string; name: string } | null;
  processedByUser: { id: string; name: string } | null;
}

interface RequestDetailPageContentProps {
  request: RequestData;
}

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

function statusBadgeVariant(status: string): StatusVariant {
  switch (status) {
    case "pending":
      return "secondary";
    case "approved":
      return "default";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

export function RequestDetailPageContent({ request }: RequestDetailPageContentProps) {
  const t = useTranslations("films.validation");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("requests.status");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const invalidatePendingCount = useInvalidatePendingRequestsCount();

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [locale]
  );

  const isPendingStatus = request.status === "pending";

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveRequest({
        requestId: request.id,
        approvalNote: approvalNote.trim() || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      invalidatePendingCount();
      toast.success(t("approveSuccess"));
      router.push("/validation-requests");
      router.refresh();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectRequest({
        requestId: request.id,
        rejectionReason: rejectionReason.trim() || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      invalidatePendingCount();
      toast.success(t("rejectSuccess"));
      router.push("/validation-requests");
      router.refresh();
    });
  };

  const formatAddress = () => {
    const parts = [
      request.cinema.address,
      request.cinema.postalCode,
      request.cinema.city,
      request.cinema.country,
    ].filter(Boolean);
    return parts.join(", ");
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link href="/validation-requests">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="font-heading text-2xl">{t("detail.title")}</h1>
        <Badge variant={statusBadgeVariant(request.status)}>
          {tStatus(request.status as "pending" | "approved" | "rejected" | "cancelled" | "paid")}
        </Badge>
      </div>

      {/* Already processed messages */}
      {request.status === "approved" && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="pt-4">
            <p className="text-green-700 dark:text-green-300">{t("detail.alreadyApproved")}</p>
            {request.approvedAt && (
              <p className="text-sm text-green-600 dark:text-green-400">
                {dateFormatter.format(new Date(request.approvedAt))}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {request.status === "rejected" && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="pt-4">
            <p className="text-red-700 dark:text-red-300">{t("detail.alreadyRejected")}</p>
            {request.rejectedAt && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {dateFormatter.format(new Date(request.rejectedAt))}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {request.status === "cancelled" && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardContent className="pt-4">
            <p className="text-yellow-700 dark:text-yellow-300">{t("detail.alreadyCancelled")}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Film info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.filmSection")}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            {request.film.posterUrl ? (
              <div className="relative h-36 w-24 flex-shrink-0">
                <Image
                  src={request.film.posterUrl}
                  alt={request.film.title}
                  fill
                  className="rounded-md object-cover"
                />
              </div>
            ) : null}
            <div>
              <p className="text-lg font-semibold">{request.film.title}</p>
            </div>
          </CardContent>
        </Card>

        {/* Exhibitor info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.exhibitorSection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">{t("detail.companyName")}: </span>
              {request.exhibitorAccount.companyName ?? "-"}
            </p>
            <p>
              <span className="font-medium">{t("detail.country")}: </span>
              {request.exhibitorAccount.country}
            </p>
            {request.exhibitorAccount.vatNumber && (
              <p>
                <span className="font-medium">{t("detail.vatNumber")}: </span>
                {request.exhibitorAccount.vatNumber}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Cinema info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.cinemaSection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold">{request.cinema.name}</p>
            <p>
              <span className="font-medium">{t("detail.address")}: </span>
              {formatAddress()}
            </p>
          </CardContent>
        </Card>

        {/* Room info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.roomSection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold">{request.room.name}</p>
            <p>{t("detail.capacity", { capacity: request.room.capacity })}</p>
          </CardContent>
        </Card>

        {/* Screening details */}
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.screeningsSection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">{t("detail.screeningCount")}: </span>
              {request.screeningCount}
            </p>
            <p>
              <span className="font-medium">{t("detail.dates")}: </span>
              {request.startDate
                ? `${dateFormatter.format(new Date(request.startDate))}${request.endDate ? ` — ${dateFormatter.format(new Date(request.endDate))}` : ""}`
                : t("detail.noDates")}
            </p>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.pricingSection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">{t("detail.displayedPrice")}: </span>
              {formatAmount(request.displayedPrice, request.currency, locale)} ×{" "}
              {request.screeningCount}
              {" = "}
              {formatAmount(
                request.displayedPrice * request.screeningCount,
                request.currency,
                locale
              )}{" "}
              <span className="text-muted-foreground">{tCommon("excludingTax")}</span>
            </p>
            <p>
              <span className="font-medium">{t("detail.yourRevenue")}: </span>
              {formatAmount(
                request.rightsHolderAmount * request.screeningCount,
                request.currency,
                locale
              )}{" "}
              <span className="text-muted-foreground">{tCommon("excludingTax")}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Note from exhibitor */}
      {request.note && (
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.noteSection")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{request.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Approval note / Rejection reason (when already processed) */}
      {request.approvalNote && (
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.approvalNoteSection")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{request.approvalNote}</p>
          </CardContent>
        </Card>
      )}
      {request.rejectionReason && (
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.rejectionReasonSection")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{request.rejectionReason}</p>
          </CardContent>
        </Card>
      )}
      {request.processedByUser && (
        <p className="text-sm text-muted-foreground">
          {t("detail.processedBy")}: {request.processedByUser.name}
        </p>
      )}

      {/* Actions — only for pending requests */}
      {isPendingStatus && (
        <>
          <Separator />
          <div className="space-y-4">
            {/* Approve section */}
            <div className="space-y-2">
              <Label htmlFor="approvalNote">{t("approvalNote")}</Label>
              <textarea
                id="approvalNote"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={t("approvalNotePlaceholder")}
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                maxLength={1000}
              />
              <Button
                onClick={() => setShowApproveDialog(true)}
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {t("accept")}
              </Button>
            </div>

            <Separator />

            {/* Reject section */}
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">{t("refusalReason")}</Label>
              <textarea
                id="rejectionReason"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={t("refusalReasonPlaceholder")}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                maxLength={1000}
              />
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {t("refuse")}
              </Button>
            </div>
          </div>

          {/* Approve confirmation dialog */}
          <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirmAcceptTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("confirmAcceptDescription")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>{tCommon("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleApprove} disabled={isPending}>
                  {t("confirmAcceptButton")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Reject confirmation dialog */}
          <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirmRefuseTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("confirmRefuseDescription")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>{tCommon("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReject}
                  disabled={isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("confirmRefuseButton")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
