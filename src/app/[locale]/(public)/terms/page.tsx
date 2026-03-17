import { getTranslations } from "next-intl/server";

import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { getPublishedDocument, getLegalDocumentByVersion } from "@/lib/services/legal-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: t("pageTitle") };
}

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("legal.terms");
  const params = await searchParams;
  const version = typeof params.version === "string" ? params.version : undefined;

  const document = version
    ? await getLegalDocumentByVersion("terms_of_service", version)
    : await getPublishedDocument("terms_of_service");

  if (!document) {
    return (
      <div className="py-12 text-center">
        <h1 className="font-heading text-2xl">{t("pageTitle")}</h1>
        <p className="mt-4 text-muted-foreground">{t("notAvailable")}</p>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl">{document.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("version", { version: document.version })}
          {document.publishedAt && (
            <>
              {" · "}
              {t("publishedAt", {
                date: document.publishedAt.toLocaleDateString("en-GB", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }),
              })}
            </>
          )}
        </p>
      </div>
      <MarkdownRenderer content={document.content} />
    </div>
  );
}
