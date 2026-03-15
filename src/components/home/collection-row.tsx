"use client";

import { ChevronLeft, ChevronRight, Film } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { FilmPoster } from "@/components/catalog/film-poster";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { CollectionRow } from "@/lib/services/editorial-service";

interface CollectionRowComponentProps {
  collection: CollectionRow;
}

export function CollectionRowComponent({ collection }: CollectionRowComponentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function updateScrollState() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.7;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }

  if (collection.collectionFilms.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <Link href={`/playlist/${collection.slug}`} className="group flex items-center gap-1.5">
          <h2 className="font-heading text-2xl tracking-tight md:text-3xl">{collection.title}</h2>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="group/scroll relative">
        {/* Scroll buttons */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute -left-2 top-1/3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md transition-opacity hover:bg-background"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute -right-2 top-1/3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md transition-opacity hover:bg-background"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="scrollbar-hide -my-2 flex gap-5 overflow-x-auto py-2 scroll-smooth"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {collection.collectionFilms.map((cf) => (
            <div key={cf.id} className="shrink-0" style={{ scrollSnapAlign: "start" }}>
              {collection.displayMode === "backdrop" ? (
                <Link
                  href={`/catalog/${cf.film.id}`}
                  className={cn(
                    "group flex shrink-0 flex-col gap-1.5",
                    "w-[220px] md:w-[260px] lg:w-[300px]"
                  )}
                >
                  <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg shadow-md transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-xl">
                    {cf.film.backdropUrl || cf.film.posterUrl ? (
                      <Image
                        src={(cf.film.backdropUrl || cf.film.posterUrl)!}
                        alt={cf.film.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 60vw, (max-width: 1024px) 35vw, 300px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                        <Film className="h-10 w-10" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <p className="truncate text-sm font-medium">{cf.film.title}</p>
                </Link>
              ) : (
                <FilmPoster
                  filmId={cf.film.id}
                  title={cf.film.title}
                  posterUrl={cf.film.posterUrl}
                  genre={cf.film.genres?.[0]}
                  className="w-[140px] md:w-[160px] lg:w-[180px]"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
