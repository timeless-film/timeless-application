"use client";

import { FilmBackdropCard } from "@/components/catalog/film-backdrop-card";

import type { FilmWithAvailability } from "@/lib/services/catalog-service";

interface FilmCardSimpleProps {
  film: FilmWithAvailability;
}

export function FilmCardSimple({ film }: FilmCardSimpleProps) {
  const subtitle = [film.directors?.[0], film.releaseYear ? String(film.releaseYear) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <FilmBackdropCard
      filmId={film.id}
      title={film.title}
      backdropUrl={film.backdropUrl}
      posterUrl={film.posterUrl}
      subtitle={subtitle}
    />
  );
}
