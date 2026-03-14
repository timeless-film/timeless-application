"use client";

import {
  ClipboardList,
  DollarSign,
  Eye,
  Film,
  Loader2,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { getRightsHolderDashboardDataAction } from "@/app/[locale]/(home)/home/actions";
import { RightsHolderRevenueChart } from "@/components/rights-holder/dashboard-revenue-chart";
import { RightsHolderSalesChart } from "@/components/rights-holder/dashboard-sales-chart";
import { RightsHolderTopFilms } from "@/components/rights-holder/dashboard-top-films";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatAmount } from "@/lib/pricing/format";

import type {
  RevenueGranularity,
  RevenuePeriod,
  RevenuePoint,
  RightsHolderDashboardKpis,
  SalesPoint,
  TopFilm,
} from "@/lib/services/rights-holder-dashboard-service";

const GRANULARITIES: RevenueGranularity[] = ["day", "week", "month", "year"];
const PERIODS: RevenuePeriod[] = ["7d", "30d", "90d", "12m", "ytd", "all"];

interface RightsHolderDashboardContentProps {
  initialKpis: RightsHolderDashboardKpis;
  initialRevenue: RevenuePoint[];
  initialSales: SalesPoint[];
  initialTopFilms: TopFilm[];
  initialGranularity: RevenueGranularity;
  initialPeriod: RevenuePeriod;
}

export function RightsHolderDashboardContent({
  initialKpis,
  initialRevenue,
  initialSales,
  initialTopFilms,
  initialGranularity,
  initialPeriod,
}: RightsHolderDashboardContentProps) {
  const t = useTranslations("rightsHolderDashboard");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const [kpis, setKpis] = useState<RightsHolderDashboardKpis>(initialKpis);
  const [revenue, setRevenue] = useState<RevenuePoint[]>(initialRevenue);
  const [sales, setSales] = useState<SalesPoint[]>(initialSales);
  const [topFilms, setTopFilms] = useState<TopFilm[]>(initialTopFilms);
  const [granularity, setGranularity] = useState<RevenueGranularity>(initialGranularity);
  const [period, setPeriod] = useState<RevenuePeriod>(initialPeriod);

  function fetchData(newGranularity: RevenueGranularity, newPeriod: RevenuePeriod) {
    setGranularity(newGranularity);
    setPeriod(newPeriod);
    startTransition(async () => {
      const result = await getRightsHolderDashboardDataAction(newGranularity, newPeriod);
      if ("data" in result) {
        setKpis(result.data.kpis);
        setRevenue(result.data.revenue);
        setSales(result.data.sales);
        setTopFilms(result.data.topFilms);
      }
    });
  }

  const primaryCards = [
    {
      title: t("metrics.revenueThisMonth"),
      value: formatAmount(kpis.revenueThisMonth, "EUR", locale),
      icon: DollarSign,
    },
    {
      title: t("metrics.totalSales"),
      value: String(kpis.totalSales),
      icon: TrendingUp,
    },
    {
      title: t("metrics.pendingRequests"),
      value: String(kpis.pendingRequests),
      icon: ClipboardList,
    },
    {
      title: t("metrics.activeFilms"),
      value: String(kpis.activeFilms),
      icon: Film,
    },
  ];

  const secondaryCards = [
    {
      title: t("metrics.filmViewsThisMonth"),
      value: String(kpis.filmViewsThisMonth),
      icon: Eye,
    },
    {
      title: t("metrics.cartAdditionsThisMonth"),
      value: String(kpis.cartAdditionsThisMonth),
      icon: ShoppingCart,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading flex items-center gap-2 text-2xl">
          {t("title")}
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        </h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Tabs
            value={granularity}
            onValueChange={(value) => fetchData(value as RevenueGranularity, period)}
          >
            <TabsList>
              {GRANULARITIES.map((g) => (
                <TabsTrigger key={g} value={g}>
                  {t(`chart.granularity.${g}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select
            value={period}
            onValueChange={(value) => fetchData(granularity, value as RevenuePeriod)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`chart.period.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {primaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2">
        {secondaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RightsHolderRevenueChart data={revenue} granularity={granularity} />
        <RightsHolderSalesChart data={sales} granularity={granularity} />
      </div>

      {/* Top films */}
      <RightsHolderTopFilms data={topFilms} />
    </div>
  );
}
