import { getTranslations } from "next-intl/server";

import { OrderList } from "@/components/admin/order-list";
import { listOrdersForAdmin } from "@/lib/services/admin-orders-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.orders");
  return {
    title: t("title"),
  };
}

export default async function OrderManagementPage() {
  const t = await getTranslations("admin.orders");
  const { orders, total } = await listOrdersForAdmin({ page: 1, limit: 20 });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <OrderList initialOrders={orders} initialTotal={total} />
    </div>
  );
}
