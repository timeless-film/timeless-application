"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

import { FilmPoster } from "@/components/catalog/film-poster";
import { Link } from "@/i18n/navigation";

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
          <h2 className="text-lg font-semibold md:text-xl">{collection.title}</h2>
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
          className="scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth pb-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {collection.collectionFilms.map((cf) => (
            <div key={cf.id} className="shrink-0" style={{ scrollSnapAlign: "start" }}>
              <FilmPoster
                filmId={cf.film.id}
                title={cf.film.title}
                posterUrl={cf.film.posterUrl}
                genre={cf.film.genres?.[0]}
                className="w-[140px] md:w-[160px] lg:w-[180px]"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
