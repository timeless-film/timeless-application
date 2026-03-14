"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { SlideshowItemRow } from "@/lib/services/editorial-service";

interface HeroSlideshowProps {
  items: SlideshowItemRow[];
  viewFilmLabel: string;
}

export function HeroSlideshow({ items, viewFilmLabel }: HeroSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (isPaused || items.length <= 1) return;
    const interval = setInterval(goToNext, 6000);
    return () => clearInterval(interval);
  }, [isPaused, items.length, goToNext]);

  if (items.length === 0) return null;

  const current = items[currentIndex];
  if (!current) return null;

  const displayTitle = current.headline ?? current.film.title;
  const genre = current.film.genres?.[0] ?? "";

  return (
    <section
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured films"
    >
      <div className="relative aspect-[21/9] w-full md:aspect-[2.5/1]">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700",
              index === currentIndex ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            aria-hidden={index !== currentIndex}
          >
            {item.film.backdropUrl ? (
              <Image
                src={item.film.backdropUrl}
                alt={item.film.title}
                fill
                className="object-cover"
                sizes="100vw"
                priority={index === 0}
              />
            ) : (
              <div className="h-full w-full bg-muted" />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          </div>
        ))}

        {/* Content */}
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-7xl px-4 pb-10 lg:px-6 lg:pb-14">
            <div className="max-w-xl space-y-2">
              {genre && <p className="text-sm font-medium text-white/70">{genre}</p>}
              <h2 className="text-2xl font-bold text-white drop-shadow-lg md:text-4xl">
                {displayTitle}
              </h2>
              {current.subtitle && (
                <p className="text-sm text-white/80 md:text-base">{current.subtitle}</p>
              )}
              <div className="pt-2">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/catalog/${current.film.id}`}>{viewFilmLabel}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation arrows */}
        {items.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {items.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 lg:bottom-5">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "h-2 rounded-full transition-all",
                index === currentIndex ? "w-6 bg-white" : "w-2 bg-white/50"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
