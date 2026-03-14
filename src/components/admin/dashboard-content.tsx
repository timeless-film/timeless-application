"use client";

import {
  ClipboardList,
  DollarSign,
  Film,
  Loader2,
  Package,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { getDashboardDataAction } from "@/app/[locale]/admin/dashboard/actions";
import { DashboardOrdersChart } from "@/components/admin/dashboard-orders-chart";
import { DashboardRevenueChart } from "@/components/admin/dashboard-revenue-chart";
import { DashboardTopFilms } from "@/components/admin/dashboard-top-films";
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
  DashboardKpis,
  OrdersPoint,
  RevenueGranularity,
  RevenuePeriod,
  RevenuePoint,
  TopFilm,
} from "@/lib/services/admin-dashboard-service";

const GRANULARITIES: RevenueGranularity[] = ["day", "week", "month", "year"];
const PERIODS: RevenuePeriod[] = ["7d", "30d", "90d", "12m", "ytd", "all"];

interface DashboardContentProps {
  initialKpis: DashboardKpis;
  initialRevenue: RevenuePoint[];
  initialOrdersOverTime: OrdersPoint[];
  initialTopFilms: TopFilm[];
  initialGranularity: RevenueGranularity;
  initialPeriod: RevenuePeriod;
}

export function DashboardContent({
  initialKpis,
  initialRevenue,
  initialOrdersOverTime,
  initialTopFilms,
  initialGranularity,
  initialPeriod,
}: DashboardContentProps) {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const [kpis, setKpis] = useState<DashboardKpis>(initialKpis);
  const [revenue, setRevenue] = useState<RevenuePoint[]>(initialRevenue);
  const [ordersOverTime, setOrdersOverTime] = useState<OrdersPoint[]>(initialOrdersOverTime);
  const [topFilms, setTopFilms] = useState<TopFilm[]>(initialTopFilms);
  const [granularity, setGranularity] = useState<RevenueGranularity>(initialGranularity);
  const [period, setPeriod] = useState<RevenuePeriod>(initialPeriod);

  function fetchData(newGranularity: RevenueGranularity, newPeriod: RevenuePeriod) {
    setGranularity(newGranularity);
    setPeriod(newPeriod);
    startTransition(async () => {
      const result = await getDashboardDataAction(newGranularity, newPeriod);
      if ("data" in result) {
        setKpis(result.data.kpis);
        setRevenue(result.data.revenue);
        setOrdersOverTime(result.data.ordersOverTime);
        setTopFilms(result.data.topFilms);
      }
    });
  }

  const primaryCards = [
    {
      title: t("metrics.businessVolume"),
      value: formatAmount(kpis.businessVolume, "EUR", locale),
      icon: DollarSign,
    },
    {
      title: t("metrics.timelessMargin"),
      value: formatAmount(kpis.timelessMargin, "EUR", locale),
      icon: DollarSign,
    },
    {
      title: t("metrics.transactions"),
      value: String(kpis.ordersCount),
      icon: ShoppingCart,
    },
    {
      title: t("metrics.pendingRequests"),
      value: String(kpis.pendingRequests),
      icon: ClipboardList,
    },
  ];

  const secondaryCards = [
    {
      title: t("metrics.pendingDeliveries"),
      value: String(kpis.pendingDeliveries),
      icon: Truck,
    },
    {
      title: t("metrics.activeExhibitors"),
      value: String(kpis.activeExhibitors),
      icon: Store,
    },
    {
      title: t("metrics.activeRightsHolders"),
      value: String(kpis.activeRightsHolders),
      icon: Users,
    },
    {
      title: t("metrics.activeFilms"),
      value: String(kpis.activeFilms),
      icon: Film,
    },
    {
      title: t("metrics.pendingOnboardings"),
      value: String(kpis.pendingOnboardings),
      icon: Package,
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <DashboardRevenueChart data={revenue} granularity={granularity} />
        <DashboardOrdersChart data={ordersOverTime} granularity={granularity} />
      </div>

      {/* Top films */}
      <DashboardTopFilms data={topFilms} />
    </div>
  );
}
