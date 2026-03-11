import { getTranslations } from "next-intl/server";

import { getOrders } from "@/components/booking/actions";
import { OrdersPageContent } from "@/components/booking/orders-page-content";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return {
    title: t("title"),
  };
}

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const t = await getTranslations("orders");
  const params = await searchParams;
  const result = await getOrders({ page: 1, limit: 20 });
  const orders = "success" in result ? result.data : [];
  const pagination = "success" in result ? result.pagination : { page: 1, limit: 20, total: 0 };
  const sessionId = typeof params.session_id === "string" ? params.session_id : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6">
      <h1 className="font-heading text-3xl">{t("title")}</h1>
      <OrdersPageContent
        initialOrders={orders}
        initialPagination={pagination}
        checkoutSessionId={sessionId}
      />
    </div>
  );
}
