import { getTranslations } from "next-intl/server";

import { getRequests } from "@/components/booking/actions";
import { RequestsPageContent } from "@/components/booking/requests-page-content";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("requests");
  return {
    title: t("title"),
  };
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("requests");
  const resolvedParams = await searchParams;
  const sessionId =
    typeof resolvedParams.session_id === "string" ? resolvedParams.session_id : undefined;
  const result = await getRequests({ page: 1, limit: 20, tab: "pending" });
  const requests = "success" in result && result.data ? result.data : [];
  const pagination =
    "success" in result && result.pagination ? result.pagination : { page: 1, limit: 20, total: 0 };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6 2xl:max-w-[1440px]">
      <h1 className="font-heading text-3xl">{t("title")}</h1>
      <RequestsPageContent
        initialRequests={requests}
        initialPagination={pagination}
        initialTab="pending"
        checkoutSessionId={sessionId}
      />
    </div>
  );
}
