"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchRevenueChart } from "@/components/wallet/wallet-actions";
import { formatAmount } from "@/lib/pricing/format";

import type { ChartConfig } from "@/components/ui/chart";
import type { RevenueChartSeries, SalesCountPoint } from "@/lib/services/wallet-service";

interface WalletRevenueChartProps {
  initialSeries: RevenueChartSeries[];
  initialSalesCounts: SalesCountPoint[];
}

const COLOR_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function formatDateTick(value: string, period: "30d" | "12m", locale: string) {
  const date = new Date(value);
  if (period === "30d") {
    return date.toLocaleDateString(locale, { day: "numeric" });
  }
  return date.toLocaleDateString(locale, { month: "short" });
}

export function WalletRevenueChart({ initialSeries, initialSalesCounts }: WalletRevenueChartProps) {
  const t = useTranslations("wallet.revenueChart");
  const locale = useLocale();
  const [series, setSeries] = useState(initialSeries);
  const [salesCounts, setSalesCounts] = useState(initialSalesCounts);
  const [period, setPeriod] = useState<"30d" | "12m">("30d");
  const [isPending, startTransition] = useTransition();

  const handlePeriodChange = useCallback(
    (value: string) => {
      const newPeriod = value as "30d" | "12m";
      setPeriod(newPeriod);
      startTransition(async () => {
        const result = await fetchRevenueChart(newPeriod);
        if ("success" in result && result.success) {
          setSeries(result.series);
          setSalesCounts(result.salesCounts);
        }
      });
    },
    [startTransition]
  );

  // Build unified chart data
  const { revenueData, salesData, currencyKeys, totalRevenue, totalSales } = useMemo(() => {
    const allDates = new Set<string>();
    const keys: string[] = [];
    for (const s of series) {
      keys.push(s.currency.toUpperCase());
      for (const point of s.points) {
        allDates.add(point.date);
      }
    }
    for (const sc of salesCounts) {
      allDates.add(sc.date);
    }

    const sortedDates = Array.from(allDates).sort();

    const revenue = sortedDates.map((date) => {
      const entry: Record<string, string | number> = { date };
      for (const s of series) {
        const point = s.points.find((p) => p.date === date);
        entry[s.currency.toUpperCase()] = point ? point.amount / 100 : 0;
      }
      return entry;
    });

    const salesCountMap = new Map(salesCounts.map((sc) => [sc.date, sc.count]));
    const sales = sortedDates.map((date) => ({
      date,
      sales: salesCountMap.get(date) ?? 0,
    }));

    // Compute totals
    let revTotal = 0;
    for (const s of series) {
      for (const p of s.points) {
        revTotal += p.amount;
      }
    }
    let salesTotal = 0;
    for (const sc of salesCounts) {
      salesTotal += sc.count;
    }

    return {
      revenueData: revenue,
      salesData: sales,
      currencyKeys: keys,
      totalRevenue: revTotal,
      totalSales: salesTotal,
    };
  }, [series, salesCounts]);

  // Chart configs
  const revenueConfig: ChartConfig = {};
  for (let i = 0; i < currencyKeys.length; i++) {
    const key = currencyKeys[i];
    if (key) {
      revenueConfig[key] = {
        label: key,
        color: COLOR_VARS[i % COLOR_VARS.length],
      };
    }
  }

  const salesConfig: ChartConfig = {
    sales: {
      label: t("salesCount"),
      color: "var(--chart-1)",
    },
  };

  const isEmpty = revenueData.length === 0;

  const periodLabel = period === "30d" ? t("period30d") : t("period12m");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Revenue chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{periodLabel}</CardDescription>
          </div>
          <Tabs value={period} onValueChange={handlePeriodChange}>
            <TabsList className="h-8">
              <TabsTrigger value="30d" className="text-xs">
                {t("period30d")}
              </TabsTrigger>
              <TabsTrigger value="12m" className="text-xs">
                {t("period12m")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <div className="flex h-[250px] items-center justify-center">
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
            </div>
          ) : (
            <ChartContainer
              config={revenueConfig}
              className={`aspect-auto h-[250px] w-full ${isPending ? "opacity-50" : ""}`}
            >
              <BarChart accessibilityLayer data={revenueData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value: string) => formatDateTick(value, period, locale)}
                />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <ChartLegend content={<ChartLegendContent />} />
                {currencyKeys.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="revenue"
                    fill={`var(--color-${key})`}
                    radius={
                      index === currencyKeys.length - 1
                        ? [4, 4, 0, 0]
                        : index === 0
                          ? [0, 0, 4, 4]
                          : [0, 0, 0, 0]
                    }
                  />
                ))}
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
        {!isEmpty && (
          <CardFooter className="flex-col items-start gap-2 text-sm">
            <div className="text-muted-foreground leading-none">
              {t("totalLabel")}{" "}
              <span className="font-medium text-foreground">
                {formatAmount(totalRevenue, currencyKeys[0]?.toLowerCase() ?? "eur", locale)}
              </span>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Sales count chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("salesCountTitle")}</CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <div className="flex h-[250px] items-center justify-center">
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
            </div>
          ) : (
            <ChartContainer
              config={salesConfig}
              className={`aspect-auto h-[250px] w-full ${isPending ? "opacity-50" : ""}`}
            >
              <BarChart accessibilityLayer data={salesData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value: string) => formatDateTick(value, period, locale)}
                />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="sales" fill="var(--color-sales)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
        {!isEmpty && (
          <CardFooter className="flex-col items-start gap-2 text-sm">
            <div className="text-muted-foreground leading-none">
              {t("totalSalesLabel")}{" "}
              <span className="font-medium text-foreground">{totalSales}</span>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
