"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

import type { ChartConfig } from "@/components/ui/chart";
import type {
  RevenueGranularity,
  SalesPoint,
} from "@/lib/services/rights-holder-dashboard-service";

interface RightsHolderSalesChartProps {
  data: SalesPoint[];
  granularity: RevenueGranularity;
}

const chartConfig: ChartConfig = {
  count: {
    label: "Sales",
    color: "var(--chart-2)",
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

export function RightsHolderSalesChart({ data, granularity }: RightsHolderSalesChartProps) {
  const t = useTranslations("rightsHolderDashboard.salesChart");
  const locale = useLocale();

  const totalSales = data.reduce((sum, point) => sum + point.count, 0);

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
            <BarChart accessibilityLayer data={data}>
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
                  />
                }
              />
              <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="text-muted-foreground text-sm">
        {t("total")} <span className="ml-1 font-medium text-foreground">{totalSales}</span>
      </CardFooter>
    </Card>
  );
}
