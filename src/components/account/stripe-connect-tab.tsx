"use client";

import { BadgeCheck, CreditCard, ExternalLink, Loader2, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { PayoutScheduleSection } from "./payout-schedule-section";
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
  const [loadingAction, setLoadingAction] = useState<"onboarding" | "dashboard" | "detach" | null>(
    null
  );

  async function handleStartOnboarding() {
    setLoadingAction("onboarding");
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
      setLoadingAction(null);
    }
  }

  async function handleOpenDashboard() {
    setLoadingAction("dashboard");
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
      setLoadingAction(null);
    }
  }

  async function handleDetach() {
    const confirmed = window.confirm(t("reset.confirmation"));
    if (!confirmed) {
      return;
    }

    setLoadingAction("detach");
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
      setLoadingAction(null);
    }
  }

  if (status === "complete") {
    return (
      <div className="space-y-6">
        {/* Status card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <BadgeCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base">{t("configured.heading")}</CardTitle>
                <CardDescription>{t("configured.description")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDashboard}
              disabled={loadingAction !== null}
            >
              {loadingAction === "dashboard" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              {t("configured.dashboardLink")}
            </Button>
          </CardContent>
        </Card>

        {/* Payout schedule card */}
        <Card>
          <CardContent className="pt-6">
            <PayoutScheduleSection />
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <Unplug className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-base">{t("reset.cta")}</CardTitle>
                <CardDescription>{t("reset.description")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDetach}
              disabled={loadingAction !== null}
            >
              {loadingAction === "detach" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("reset.cta")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isIncomplete = status === "incomplete";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">
                {isIncomplete ? t("incomplete.heading") : t("notConfigured.heading")}
              </CardTitle>
              <CardDescription>
                {isIncomplete ? t("incomplete.description") : t("notConfigured.description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleStartOnboarding} disabled={loadingAction !== null}>
              {loadingAction === "onboarding" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isIncomplete ? t("incomplete.cta") : t("notConfigured.cta")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isIncomplete && (
        <Card className="border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <Unplug className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-base">{t("reset.cta")}</CardTitle>
                <CardDescription>{t("reset.description")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDetach}
              disabled={loadingAction !== null}
            >
              {loadingAction === "detach" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("reset.cta")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
