import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { editorialSections } from "@/lib/db/schema";
import { getCollectionForAdmin } from "@/lib/services/editorial-service";

import { CollectionEditor } from "./collection-editor";

import type { Metadata } from "next";

interface CollectionPageProps {
  params: Promise<{ sectionId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.editorial");
  return { title: t("collectionTitle") };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { sectionId } = await params;
  const t = await getTranslations("admin.editorial");

  const section = await db.query.editorialSections.findFirst({
    where: eq(editorialSections.id, sectionId),
  });

  if (!section || section.type !== "collection") {
    notFound();
  }

  const collection = await getCollectionForAdmin(sectionId);

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("collectionTitle")}</h1>
      <p className="text-muted-foreground">{t("collectionDescription")}</p>
      {collection ? (
        <CollectionEditor sectionId={sectionId} initialCollection={collection} />
      ) : (
        <p className="text-muted-foreground">{t("noCollection")}</p>
      )}
    </div>
  );
}
