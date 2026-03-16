import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { films } from "@/lib/db/schema";
import { syncFilmTmdbRelations } from "@/lib/services/film-service";
import { enrichFilmFromTmdb } from "@/lib/tmdb";

import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.BETTER_AUTH_SECRET) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid internal secret" } },
      { status: 401 }
    );
  }

  const { batchId } = await params;

  const requestBody = (await request.json().catch(() => null)) as {
    importedMetadataFields?: string[];
  } | null;

  const importedMetadataFields = new Set(requestBody?.importedMetadataFields ?? []);

  const pendingFilms = await db
    .select({
      id: films.id,
      title: films.title,
      releaseYear: films.releaseYear,
    })
    .from(films)
    .where(and(eq(films.importBatchId, batchId), eq(films.status, "active")));

  let enriched = 0;
  let noMatch = 0;

  for (const film of pendingFilms) {
    try {
      const tmdbData = await enrichFilmFromTmdb(film.title, film.releaseYear ?? undefined);

      if (tmdbData) {
        const updateFields: Partial<typeof films.$inferInsert> = {
          tmdbMatchStatus: "matched",
          updatedAt: new Date(),
          tmdbId: tmdbData.tmdbId,
          originalTitle: tmdbData.originalTitle,
          countries: tmdbData.countries,
          tmdbRating: tmdbData.tmdbRating,
          tagline: tmdbData.tagline,
          taglineEn: tmdbData.taglineEn,
        };

        if (!importedMetadataFields.has("synopsis")) {
          updateFields.synopsis = tmdbData.synopsis;
        }

        if (!importedMetadataFields.has("synopsisEn")) {
          updateFields.synopsisEn = tmdbData.synopsisEn;
        }

        if (!importedMetadataFields.has("duration")) {
          updateFields.duration = tmdbData.duration;
        }

        if (!importedMetadataFields.has("releaseYear")) {
          updateFields.releaseYear = tmdbData.releaseYear;
        }

        if (!importedMetadataFields.has("genres")) {
          updateFields.genres = tmdbData.genres;
        }

        if (!importedMetadataFields.has("directors")) {
          updateFields.directors = tmdbData.directors;
        }

        if (!importedMetadataFields.has("cast")) {
          updateFields.cast = tmdbData.cast;
        }

        if (!importedMetadataFields.has("posterUrl")) {
          updateFields.posterUrl = tmdbData.posterUrl;
        }

        if (!importedMetadataFields.has("backdropUrl")) {
          updateFields.backdropUrl = tmdbData.backdropUrl;
        }

        await db.update(films).set(updateFields).where(eq(films.id, film.id));

        // Sync normalized TMDB relations (genres, people, companies)
        await syncFilmTmdbRelations(film.id, {
          genreIds: tmdbData.genreIds,
          people: tmdbData.people,
          companies: tmdbData.companies,
        });

        enriched++;
      } else {
        await db
          .update(films)
          .set({
            tmdbMatchStatus: "no_match",
            updatedAt: new Date(),
          })
          .where(eq(films.id, film.id));
        noMatch++;
      }
    } catch (error) {
      console.error(`TMDB enrichment failed for film ${film.id}:`, error);
      await db
        .update(films)
        .set({
          tmdbMatchStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(films.id, film.id));
    }
  }

  return NextResponse.json({ data: { enriched, noMatch, total: pendingFilms.length } });
}
