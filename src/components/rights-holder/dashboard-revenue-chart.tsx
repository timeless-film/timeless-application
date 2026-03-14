"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatAmount } from "@/lib/pricing/format";

import type { ChartConfig } from "@/components/ui/chart";
import type {
  RevenueGranularity,
  RevenuePoint,
} from "@/lib/services/rights-holder-dashboard-service";

interface RightsHolderRevenueChartProps {
  data: RevenuePoint[];
  granularity: RevenueGranularity;
}

const chartConfig: ChartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
};

function formatTickLabel(value: string, granularity: RevenueGranularity, locale: string): string {
  switch (granularity) {
    case "day": {
      const date = new Date(value);
      return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
    }
    case "week":
      return value.split("-")[1] ?? value;
    case "month": {
      const date = new Date(`${value}-01`);
      return date.toLocaleDateString(locale, { month: "short" });
    }
    case "year":
      return value;
  }
}

function formatTooltipLabel(
  value: string,
  granularity: RevenueGranularity,
  locale: string
): string {
  switch (granularity) {
    case "day": {
      const date = new Date(value);
      return date.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    case "week":
      return value;
    case "month": {
      const date = new Date(`${value}-01`);
      return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
    }
    case "year":
      return value;
  }
}

export function RightsHolderRevenueChart({ data, granularity }: RightsHolderRevenueChartProps) {
  const t = useTranslations("rightsHolderDashboard.revenueChart");
  const locale = useLocale();

  const chartData = data.map((point) => ({
    date: point.date,
    revenue: point.revenue / 100,
  }));

  const totalRevenue = data.reduce((sum, point) => sum + point.revenue, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <BarChart accessibilityLayer data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value: string) => formatTickLabel(value, granularity, locale)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value: string) =>
                      formatTooltipLabel(value, granularity, locale)
                    }
                    formatter={(value) => formatAmount(Number(value) * 100, "eur", locale)}
                  />
                }
              />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="text-muted-foreground leading-none">
          {t("total")}{" "}
          <span className="font-medium text-foreground">
            {formatAmount(totalRevenue, "eur", locale)}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
