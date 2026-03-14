import { getTranslations } from "next-intl/server";

import { RequestList } from "@/components/admin/request-list";
import { getPlatformPricingSettings } from "@/lib/pricing";
import { listRequestsForAdmin } from "@/lib/services/admin-requests-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.requests");
  return {
    title: t("title"),
  };
}

export default async function AdminRequestsPage() {
  const t = await getTranslations("admin.requests");
  const settings = await getPlatformPricingSettings();

  const { requests, total } = await listRequestsForAdmin(
    { page: 1, limit: 20 },
    settings.requestUrgencyDaysBeforeStart
  );

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <RequestList initialRequests={requests} initialTotal={total} />
    </div>
  );
}
