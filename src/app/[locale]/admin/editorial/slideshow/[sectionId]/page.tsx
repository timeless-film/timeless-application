import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { editorialSections } from "@/lib/db/schema";
import { getSlideshowItemsForAdmin } from "@/lib/services/editorial-service";

import { SlideshowEditor } from "./slideshow-editor";

import type { Metadata } from "next";

interface SlideshowPageProps {
  params: Promise<{ sectionId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.editorial");
  return { title: t("slideshowTitle") };
}

export default async function SlideshowPage({ params }: SlideshowPageProps) {
  const { sectionId } = await params;
  const t = await getTranslations("admin.editorial");

  const section = await db.query.editorialSections.findFirst({
    where: eq(editorialSections.id, sectionId),
  });

  if (!section || section.type !== "slideshow") {
    notFound();
  }

  const items = await getSlideshowItemsForAdmin(sectionId);

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("slideshowTitle")}</h1>
      <p className="text-muted-foreground">{t("slideshowDescription")}</p>
      <SlideshowEditor sectionId={sectionId} initialItems={items} />
    </div>
  );
}
