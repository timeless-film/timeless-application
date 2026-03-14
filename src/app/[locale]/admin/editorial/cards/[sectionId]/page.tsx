import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { editorialSections } from "@/lib/db/schema";
import { getEditorialCardsForAdmin } from "@/lib/services/editorial-service";

import { CardsEditor } from "./cards-editor";

import type { Metadata } from "next";

interface CardsPageProps {
  params: Promise<{ sectionId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.editorial");
  return { title: t("cardsTitle") };
}

export default async function CardsPage({ params }: CardsPageProps) {
  const { sectionId } = await params;
  const t = await getTranslations("admin.editorial");

  const section = await db.query.editorialSections.findFirst({
    where: eq(editorialSections.id, sectionId),
  });

  if (!section || section.type !== "card_grid") {
    notFound();
  }

  const cards = await getEditorialCardsForAdmin(sectionId);

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("cardsTitle")}</h1>
      <p className="text-muted-foreground">{t("cardsDescription")}</p>
      <CardsEditor sectionId={sectionId} initialCards={cards} />
    </div>
  );
}
