import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { RightsHolderDashboardContent } from "@/components/rights-holder/dashboard-content";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import {
  getRightsHolderDashboardKpis,
  getRightsHolderRevenue,
  getRightsHolderSales,
  getRightsHolderTopFilms,
} from "@/lib/services/rights-holder-dashboard-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const activeCookie = await getActiveAccountCookie();
  const namespace =
    activeCookie?.type === "rights_holder" ? "rightsHolderDashboard" : "exhibitorDashboard";
  const t = await getTranslations(namespace);
  return {
    title: t("title"),
  };
}

export default async function HomePage() {
  const activeCookie = await getActiveAccountCookie();

  if (!activeCookie) {
    redirect("/accounts");
  }

  if (activeCookie.type === "rights_holder") {
    const [kpis, initialRevenue, initialSales, initialTopFilms] = await Promise.all([
      getRightsHolderDashboardKpis(activeCookie.accountId),
      getRightsHolderRevenue(activeCookie.accountId, "month", "12m"),
      getRightsHolderSales(activeCookie.accountId, "month", "12m"),
      getRightsHolderTopFilms(activeCookie.accountId, "12m"),
    ]);

    return (
      <RightsHolderDashboardContent
        initialKpis={kpis}
        initialRevenue={initialRevenue}
        initialSales={initialSales}
        initialTopFilms={initialTopFilms}
        initialGranularity="month"
        initialPeriod="12m"
      />
    );
  }

  // Exhibitor dashboard
  const t = await getTranslations("exhibitorDashboard");
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6">
      <h1 className="font-heading text-3xl">{t("title")}</h1>
      <p className="text-muted-foreground">{t("placeholder")}</p>
    </div>
  );
}
