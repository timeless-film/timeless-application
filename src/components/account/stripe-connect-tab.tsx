"use client";

import { BadgeCheck, CreditCard, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  detachStripeConnectAccount,
  createStripeConnectDashboardLink,
  startStripeConnectOnboarding,
} from "./stripe-connect-actions";

interface StripeConnectTabProps {
  status: "not_started" | "incomplete" | "complete";
}

export function StripeConnectTab({ status }: StripeConnectTabProps) {
  const t = useTranslations("stripeConnect");
  const [isLoading, setIsLoading] = useState(false);

  async function handleStartOnboarding() {
    setIsLoading(true);
    try {
      const baseUrl = window.location.origin;
      const locale = window.location.pathname.split("/")[1] ?? "en";
      const result = await startStripeConnectOnboarding({
        returnUrl: `${baseUrl}/${locale}/account/stripe-connect`,
        refreshUrl: `${baseUrl}/${locale}/account/stripe-connect/refresh`,
      });

      if ("error" in result) {
        toast.error(t(`error.${result.error}`));
        return;
      }

      window.location.href = result.url;
    } catch {
      toast.error(t("error.UNKNOWN"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenDashboard() {
    setIsLoading(true);
    try {
      const result = await createStripeConnectDashboardLink();

      if ("error" in result) {
        toast.error(t(`error.${result.error}`));
        return;
      }

      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("error.UNKNOWN"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDetach() {
    const confirmed = window.confirm(t("reset.confirmation"));
    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await detachStripeConnectAccount();

      if ("error" in result) {
        toast.error(t(`error.${result.error}`));
        return;
      }

      toast.success(t("reset.success"));
      window.location.reload();
    } catch {
      toast.error(t("error.UNKNOWN"));
    } finally {
      setIsLoading(false);
    }
  }

  if (status === "complete") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BadgeCheck className="h-5 w-5 text-green-600" />
          <div>
            <h3 className="font-medium">{t("configured.heading")}</h3>
            <p className="text-sm text-muted-foreground">{t("configured.description")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleOpenDashboard} disabled={isLoading}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("configured.dashboardLink")}
          </Button>
          <Button variant="outline" onClick={handleDetach} disabled={isLoading}>
            {t("reset.cta")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t("reset.description")}</p>
      </div>
    );
  }

  const isIncomplete = status === "incomplete";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CreditCard className="h-5 w-5 text-muted-foreground" />
        <div>
          <h3 className="font-medium">
            {isIncomplete ? t("incomplete.heading") : t("notConfigured.heading")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isIncomplete ? t("incomplete.description") : t("notConfigured.description")}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleStartOnboarding} disabled={isLoading}>
          {isIncomplete ? t("incomplete.cta") : t("notConfigured.cta")}
        </Button>
        {isIncomplete ? (
          <Button variant="outline" onClick={handleDetach} disabled={isLoading}>
            {t("reset.cta")}
          </Button>
        ) : null}
      </div>
      {isIncomplete ? (
        <p className="text-sm text-muted-foreground">{t("reset.description")}</p>
      ) : null}
    </div>
  );
}
