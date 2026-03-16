"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "next-intl";
import { useRef, useState } from "react";

import { FilmPoster } from "@/components/catalog/film-poster";
import { Link } from "@/i18n/navigation";

import type { DecadeGroup } from "@/lib/services/editorial-service";

interface DecadeCatalogProps {
  decades: DecadeGroup[];
  decadeLabel: string;
  viewMoreLabel: string;
}

export function DecadeCatalog({ decades, decadeLabel, viewMoreLabel }: DecadeCatalogProps) {
  if (decades.length === 0) return null;

  return (
    <div className="space-y-8">
      {decades.map((decade) => (
        <DecadeRow
          key={decade.decade}
          decade={decade}
          decadeLabel={decadeLabel}
          viewMoreLabel={viewMoreLabel}
        />
      ))}
    </div>
  );
}

function DecadeRow({
  decade,
  decadeLabel,
  viewMoreLabel,
}: {
  decade: DecadeGroup;
  decadeLabel: string;
  viewMoreLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const locale = useLocale();

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

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl tracking-tight md:text-3xl">
          {decadeLabel.replace("{decade}", String(decade.decade))}
        </h2>
        <Link
          href={`/catalog?yearMin=${decade.decade}&yearMax=${decade.decade + 9}`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {viewMoreLabel} →
        </Link>
      </div>

      <div className="group/scroll relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute -left-2 top-1/3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md hover:bg-background"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute -right-2 top-1/3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md hover:bg-background"
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
          {decade.films.map((film) => (
            <div key={film.id} className="shrink-0" style={{ scrollSnapAlign: "start" }}>
              <FilmPoster
                filmId={film.id}
                title={film.title}
                posterUrl={film.posterUrl}
                genre={
                  film.genres?.[0]
                    ? locale === "fr"
                      ? film.genres[0].nameFr
                      : film.genres[0].nameEn
                    : undefined
                }
                className="w-[140px] md:w-[160px] lg:w-[180px]"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
