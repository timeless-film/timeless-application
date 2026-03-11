import { getTranslations } from "next-intl/server";

import { RequestDetailPageContent } from "@/components/validation/request-detail-page-content";

import { getIncomingRequestDetail } from "../actions";

import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("films.validation.detail");
  return {
    title: t("title"),
  };
}

export default async function ValidationRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;
  const result = await getIncomingRequestDetail(requestId);

  if (!("success" in result) || !result.data) {
    const t = await getTranslations("films.validation");
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  return <RequestDetailPageContent request={result.data} />;
}
