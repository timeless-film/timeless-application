"use client";

import { Eye, ShoppingCart, Send, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatAmount } from "@/lib/pricing/format";

import type { ChartConfig } from "@/components/ui/chart";
import type { FilmEventStats } from "@/lib/services/film-event-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilmStatsChartProps {
  stats: FilmEventStats;
  currency?: string;
}

// ─── Chart config ─────────────────────────────────────────────────────────────

const chartConfig: ChartConfig = {
  views: {
    label: "Views",
    color: "var(--chart-1)",
  },
  cartAdds: {
    label: "Cart adds",
    color: "var(--chart-2)",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function FilmStatsChart({ stats, currency = "EUR" }: FilmStatsChartProps) {
  const t = useTranslations("filmStats");
  const locale = useLocale();

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Eye className="h-4 w-4 text-muted-foreground" />}
          label={t("kpi.views")}
          value={stats.totalViews.toLocaleString(locale)}
        />
        <KpiCard
          icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
          label={t("kpi.cartAdds")}
          value={stats.totalCartAdds.toLocaleString(locale)}
        />
        <KpiCard
          icon={<Send className="h-4 w-4 text-muted-foreground" />}
          label={t("kpi.requests")}
          value={stats.totalRequests.toLocaleString(locale)}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          label={t("kpi.revenue")}
          value={formatAmount(stats.totalRevenue, currency, locale)}
        />
      </div>

      {/* Timeline chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("chart.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.timeline.length === 0 ? (
            <div className="flex h-[250px] items-center justify-center">
              <p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
              <AreaChart accessibilityLayer data={stats.timeline}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value: string) => {
                    const date = new Date(value);
                    return date.toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value: string) => {
                        const date = new Date(value);
                        return date.toLocaleDateString(locale, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        });
                      }}
                    />
                  }
                />
                <Area
                  dataKey="views"
                  type="monotone"
                  fill="var(--color-views)"
                  fillOpacity={0.2}
                  stroke="var(--color-views)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="cartAdds"
                  type="monotone"
                  fill="var(--color-cartAdds)"
                  fillOpacity={0.2}
                  stroke="var(--color-cartAdds)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-muted-foreground text-sm">{label}</p>
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
