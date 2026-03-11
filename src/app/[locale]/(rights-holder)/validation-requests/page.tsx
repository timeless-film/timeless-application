import { getTranslations } from "next-intl/server";

import { ValidationRequestsPageContent } from "@/components/validation/validation-requests-page-content";

import { getIncomingRequests } from "./actions";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("films.validation");
  return {
    title: t("title"),
  };
}

export default async function ValidationRequestsPage() {
  const t = await getTranslations("films.validation");
  const result = await getIncomingRequests({ page: 1, limit: 20, tab: "pending" });

  const requests = "success" in result && result.success ? result.data : [];
  const pagination =
    "success" in result && result.success ? result.pagination : { page: 1, limit: 20, total: 0 };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <ValidationRequestsPageContent
        initialRequests={requests as never[]}
        initialPagination={pagination}
        initialTab="pending"
      />
    </div>
  );
}
