import { Film } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { FilmPoster } from "@/components/catalog/film-poster";
import { getCollectionBySlug } from "@/lib/services/editorial-service";

import type { Metadata } from "next";

interface PlaylistPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PlaylistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: "Not Found" };
  return { title: collection.title };
}

export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const collection = await getCollectionBySlug(slug, locale);
  const t = await getTranslations("home");

  if (!collection) {
    notFound();
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg">
        {collection.coverUrl ? (
          <div className="relative aspect-[3/1] w-full">
            <Image
              src={collection.coverUrl}
              alt={collection.title}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6 lg:p-8">
              <h1 className="font-heading text-3xl text-white md:text-4xl">{collection.title}</h1>
              {collection.description && (
                <p className="mt-2 max-w-2xl text-sm text-white/80 md:text-base">
                  {collection.description}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl space-y-2 px-4 py-8 lg:px-6">
            <h1 className="font-heading text-2xl md:text-3xl">{collection.title}</h1>
            {collection.description && (
              <p className="max-w-2xl text-muted-foreground">{collection.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Film grid */}
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        {collection.collectionFilms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <Film className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t("playlist.empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {collection.collectionFilms.map((cf) => (
              <FilmPoster
                key={cf.id}
                filmId={cf.film.id}
                title={cf.film.title}
                posterUrl={cf.film.posterUrl}
                genre={cf.film.genres?.[0]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
