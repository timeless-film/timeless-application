import { eq } from "drizzle-orm";
import { Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  films,
  filmCompanies,
  filmGenres,
  filmPeople,
  genres as genresTable,
} from "@/lib/db/schema";

// ─── Component ────────────────────────────────────────────────────────────────

interface FilmEnrichedInfoProps {
  filmId: string;
}

export async function FilmEnrichedInfo({ filmId }: FilmEnrichedInfoProps) {
  const t = await getTranslations("catalog.film");
  const locale = await getLocale();

  const [film, people, genres, companies] = await Promise.all([
    db.query.films.findFirst({
      where: eq(films.id, filmId),
      columns: { tagline: true, taglineEn: true, tmdbRating: true },
    }),
    db
      .select({
        name: filmPeople.name,
        role: filmPeople.role,
        character: filmPeople.character,
      })
      .from(filmPeople)
      .where(eq(filmPeople.filmId, filmId))
      .orderBy(filmPeople.displayOrder),
    db
      .select({
        nameEn: genresTable.nameEn,
        nameFr: genresTable.nameFr,
      })
      .from(filmGenres)
      .innerJoin(genresTable, eq(filmGenres.genreId, genresTable.id))
      .where(eq(filmGenres.filmId, filmId)),
    db
      .select({
        name: filmCompanies.name,
      })
      .from(filmCompanies)
      .where(eq(filmCompanies.filmId, filmId)),
  ]);

  // Nothing to show if no enriched data
  if (
    !film ||
    (people.length === 0 &&
      genres.length === 0 &&
      companies.length === 0 &&
      !film.tagline &&
      !film.tmdbRating)
  ) {
    return null;
  }

  const tagline = locale === "en" && film.taglineEn ? film.taglineEn : film.tagline;
  const tmdbRating = film.tmdbRating ? parseFloat(film.tmdbRating) : null;

  const directors = people.filter((p) => p.role === "director");
  const actors = people.filter((p) => p.role === "actor");
  const producers = people.filter((p) => p.role === "producer" || p.role === "executive_producer");
  const crew = people.filter(
    (p) => p.role === "composer" || p.role === "cinematographer" || p.role === "screenplay"
  );
  const genreNames = genres.map((g) => (locale === "fr" ? g.nameFr : g.nameEn));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("enrichedInfo")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tagline + Rating */}
        {(tagline || (tmdbRating !== null && tmdbRating > 0)) && (
          <div className="space-y-1">
            {tagline && <p className="text-sm italic text-muted-foreground">{tagline}</p>}
            {tmdbRating !== null && tmdbRating > 0 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                <span>{tmdbRating.toFixed(1)} / 10</span>
              </div>
            )}
          </div>
        )}

        {/* Genres */}
        {genreNames.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-muted-foreground">{t("genres")}</p>
            <div className="flex flex-wrap gap-1">
              {genreNames.map((name) => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* People grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {directors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("director")}</p>
              <p className="text-sm">{directors.map((d) => d.name).join(", ")}</p>
            </div>
          )}
          {actors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("cast")}</p>
              <p className="text-sm line-clamp-2">
                {actors
                  .map((a) => (a.character ? `${a.name} (${a.character})` : a.name))
                  .join(", ")}
              </p>
            </div>
          )}
          {producers.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("producers")}</p>
              <p className="text-sm">{producers.map((p) => p.name).join(", ")}</p>
            </div>
          )}
          {crew.map((person) => (
            <div key={`${person.role}-${person.name}`}>
              <p className="text-sm font-medium text-muted-foreground">
                {t(`role.${person.role}`)}
              </p>
              <p className="text-sm">{person.name}</p>
            </div>
          ))}
        </div>

        {/* Companies */}
        {companies.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("productionCompanies")}</p>
            <p className="text-sm">{companies.map((c) => c.name).join(", ")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
