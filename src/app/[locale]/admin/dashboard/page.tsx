import { getTranslations } from "next-intl/server";

import { DashboardContent } from "@/components/admin/dashboard-content";
import {
  getDashboardKpis,
  getOrdersOverTime,
  getRevenue,
  getTopFilms,
} from "@/lib/services/admin-dashboard-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.dashboard");
  return {
    title: t("title"),
  };
}

export default async function DashboardPage() {
  const [kpis, initialRevenue, initialOrders, initialTopFilms] = await Promise.all([
    getDashboardKpis("12m"),
    getRevenue("month", "12m"),
    getOrdersOverTime("month", "12m"),
    getTopFilms("12m"),
  ]);

  return (
    <DashboardContent
      initialKpis={kpis}
      initialRevenue={initialRevenue}
      initialOrdersOverTime={initialOrders}
      initialTopFilms={initialTopFilms}
      initialGranularity="month"
      initialPeriod="12m"
    />
  );
}
