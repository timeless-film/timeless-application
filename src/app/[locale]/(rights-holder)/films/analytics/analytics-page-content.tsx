"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { AnalyticsResult } from "@/lib/services/analytics-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsPageContentProps {
  accountId: string;
  initialData: AnalyticsResult;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalyticsPageContent({
  accountId: _accountId,
  initialData,
}: AnalyticsPageContentProps) {
  const t = useTranslations("analytics");

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-heading text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("kpi.views")}</CardTitle>
            <CardDescription>{t("kpi.viewsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{initialData.kpis.totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("kpi.cartAdditions")}</CardTitle>
            <CardDescription>{t("kpi.cartAdditionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {initialData.kpis.totalAddsToCart.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("kpi.requests")}</CardTitle>
            <CardDescription>{t("kpi.requestsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {initialData.kpis.totalRequests.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("kpi.revenue")}</CardTitle>
            <CardDescription>{t("kpi.revenueDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCents(initialData.kpis.totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Films & Searches */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Films */}
        <Card>
          <CardHeader>
            <CardTitle>{t("topFilms.title")}</CardTitle>
            <CardDescription>{t("topFilms.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {initialData.films.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("topFilms.empty")}</p>
            ) : (
              <div className="space-y-2">
                {initialData.films.slice(0, 10).map((film, idx) => (
                  <div key={film.id} className="flex items-center justify-between">
                    <span className="text-sm">
                      {idx + 1}. {film.title}
                    </span>
                    <span className="text-sm font-medium">
                      {film.views} {t("topFilms.views")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Searches */}
        <Card>
          <CardHeader>
            <CardTitle>{t("topSearches.title")}</CardTitle>
            <CardDescription>{t("topSearches.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {initialData.topSearches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("topSearches.empty")}</p>
            ) : (
              <div className="space-y-2">
                {initialData.topSearches.map((search, idx) => (
                  <div key={search.query} className="flex items-center justify-between">
                    <span className="text-sm">
                      {idx + 1}. {search.query}
                    </span>
                    <span className="text-sm font-medium">
                      {search.count} {t("topSearches.searches")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
