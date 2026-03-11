"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatAmount } from "@/lib/pricing/format";

import { processRequestAction } from "./actions";

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
}

interface RequestActionFormProps {
  request: RequestData;
  action: "approve" | "reject";
  token: string;
}

export function RequestActionForm({ request, action, token }: RequestActionFormProps) {
  const t = useTranslations("requestAction");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [locale]
  );

  const isApproval = action === "approve";

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await processRequestAction({
        token,
        action,
        note: note.trim() || undefined,
      });

      if ("error" in result) {
        toast.error(t("error"));
        return;
      }

      setIsProcessed(true);
      toast.success(isApproval ? t("successApproved") : t("successRejected"), {
        description: isApproval ? t("successApprovedDescription") : t("successRejectedDescription"),
      });
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

  if (isProcessed) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="space-y-4 pt-6 text-center">
          <p className="text-lg font-semibold">
            {isApproval ? t("successApproved") : t("successRejected")}
          </p>
          <p className="text-muted-foreground">
            {isApproval ? t("successApprovedDescription") : t("successRejectedDescription")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-center font-heading text-2xl">
        {isApproval ? t("approveTitle") : t("rejectTitle")}
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Film info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("filmLabel")}</CardTitle>
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
            <p className="text-lg font-semibold">{request.film.title}</p>
          </CardContent>
        </Card>

        {/* Exhibitor info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("exhibitorLabel")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold">{request.exhibitorAccount.companyName ?? "-"}</p>
            <p>{request.exhibitorAccount.country}</p>
            {request.exhibitorAccount.vatNumber && (
              <p className="text-muted-foreground">{request.exhibitorAccount.vatNumber}</p>
            )}
          </CardContent>
        </Card>

        {/* Cinema info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("cinemaLabel")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold">{request.cinema.name}</p>
            <p>{formatAddress()}</p>
          </CardContent>
        </Card>

        {/* Room info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("roomLabel")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold">{request.room.name}</p>
            <p>{request.room.capacity} seats</p>
          </CardContent>
        </Card>

        {/* Screenings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("screeningsLabel")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{request.screeningCount}</p>
            <p>
              <span className="font-medium">{t("datesLabel")}: </span>
              {request.startDate
                ? `${dateFormatter.format(new Date(request.startDate))}${request.endDate ? ` — ${dateFormatter.format(new Date(request.endDate))}` : ""}`
                : t("noDates")}
            </p>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>{t("priceLabel")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              {formatAmount(request.displayedPrice, request.currency, locale)} ×{" "}
              {request.screeningCount}
              {" = "}
              {formatAmount(
                request.displayedPrice * request.screeningCount,
                request.currency,
                locale
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Note from exhibitor */}
      {request.note && (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-1 text-sm font-medium text-muted-foreground">Note</p>
            <p className="whitespace-pre-wrap text-sm">{request.note}</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Action form */}
      <div className="space-y-4">
        <Label htmlFor="actionNote">{isApproval ? t("approvalNote") : t("rejectionReason")}</Label>
        <textarea
          id="actionNote"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={isApproval ? t("approvalNotePlaceholder") : t("rejectionReasonPlaceholder")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          disabled={isPending}
        />
        <Button
          onClick={() => setShowDialog(true)}
          disabled={isPending}
          variant={isApproval ? "default" : "destructive"}
          className="w-full sm:w-auto"
        >
          {isApproval ? t("confirmApproveButton") : t("confirmRejectButton")}
        </Button>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isApproval ? t("confirmApproveTitle") : t("confirmRejectTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isApproval ? t("confirmApproveDescription") : t("confirmRejectDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isPending}
              className={
                isApproval
                  ? undefined
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {isApproval ? t("confirmApproveButton") : t("confirmRejectButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
