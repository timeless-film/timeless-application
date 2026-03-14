import { getTranslations } from "next-intl/server";

import { DeliveryList } from "@/components/admin/delivery-list";
import { getPlatformPricingSettings } from "@/lib/pricing";
import { listDeliveriesForAdmin } from "@/lib/services/admin-delivery-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.deliveries");
  return {
    title: t("title"),
  };
}

export default async function DeliveriesPage() {
  const t = await getTranslations("admin.deliveries");

  const [{ deliveries, total }, settings] = await Promise.all([
    listDeliveriesForAdmin({ page: 1, limit: 20, status: "pending" }),
    getPlatformPricingSettings(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <DeliveryList
        initialDeliveries={deliveries}
        initialTotal={total}
        deliveryUrgencyDaysBeforeStart={settings.deliveryUrgencyDaysBeforeStart}
      />
    </div>
  );
}
