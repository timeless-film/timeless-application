/* eslint-disable no-console */
import { config } from "dotenv";
config({ path: ".env.local" });

const TMDB_GENRES = [
  { tmdbId: 28, nameEn: "Action", nameFr: "Action" },
  { tmdbId: 12, nameEn: "Adventure", nameFr: "Aventure" },
  { tmdbId: 16, nameEn: "Animation", nameFr: "Animation" },
  { tmdbId: 35, nameEn: "Comedy", nameFr: "Comédie" },
  { tmdbId: 80, nameEn: "Crime", nameFr: "Crime" },
  { tmdbId: 99, nameEn: "Documentary", nameFr: "Documentaire" },
  { tmdbId: 18, nameEn: "Drama", nameFr: "Drame" },
  { tmdbId: 10751, nameEn: "Family", nameFr: "Familial" },
  { tmdbId: 14, nameEn: "Fantasy", nameFr: "Fantastique" },
  { tmdbId: 36, nameEn: "History", nameFr: "Histoire" },
  { tmdbId: 27, nameEn: "Horror", nameFr: "Horreur" },
  { tmdbId: 10402, nameEn: "Music", nameFr: "Musique" },
  { tmdbId: 9648, nameEn: "Mystery", nameFr: "Mystère" },
  { tmdbId: 10749, nameEn: "Romance", nameFr: "Romance" },
  { tmdbId: 878, nameEn: "Science Fiction", nameFr: "Science-Fiction" },
  { tmdbId: 10770, nameEn: "TV Movie", nameFr: "Téléfilm" },
  { tmdbId: 53, nameEn: "Thriller", nameFr: "Thriller" },
  { tmdbId: 10752, nameEn: "War", nameFr: "Guerre" },
  { tmdbId: 37, nameEn: "Western", nameFr: "Western" },
];

async function main() {
  const { sql } = await import("drizzle-orm");
  const { db } = await import("../src/lib/db");
  const { filmCompanies, filmGenres, filmPeople, genres } = await import(
    "../src/lib/db/schema"
  );
  const { normalizeTmdbData } = await import("../src/lib/tmdb");

  // 1. Seed genres taxonomy
  console.log("Seeding genres taxonomy...");
  for (const genre of TMDB_GENRES) {
    await db
      .insert(genres)
      .values(genre)
      .onConflictDoUpdate({
        target: genres.tmdbId,
        set: { nameEn: genre.nameEn, nameFr: genre.nameFr },
      });
  }
  console.log(`  ✓ ${TMDB_GENRES.length} genres upserted`);

  // Build TMDB ID → internal ID map
  const allGenres = await db.select({ id: genres.id, tmdbId: genres.tmdbId }).from(genres);
  const tmdbToInternal = new Map<number, number>();
  for (const g of allGenres) {
    if (g.tmdbId !== null) tmdbToInternal.set(g.tmdbId, g.id);
  }

  // 2. Backfill films from tmdb_data snapshots
  console.log("Backfilling normalized TMDB relations from tmdb_data snapshots...");

  const filmsWithTmdb = await db.execute(sql`
    SELECT id, tmdb_data
    FROM films
    WHERE tmdb_match_status = 'matched'
      AND tmdb_data IS NOT NULL
  `);

  const validTmdbGenreIds = new Set(TMDB_GENRES.map((g) => g.tmdbId));
  let processed = 0;
  let skipped = 0;

  // SAFETY: db.execute returns an iterable of rows
  const rows = filmsWithTmdb as unknown as { id: string; tmdb_data: unknown }[];

  for (const film of rows) {
    try {
      const tmdbData = film.tmdb_data;
      if (!tmdbData || typeof tmdbData !== "object") {
        skipped++;
        continue;
      }

      // SAFETY: tmdb_data was stored from TMDB API response
      const normalized = normalizeTmdbData(tmdbData as Parameters<typeof normalizeTmdbData>[0]);

      // Update tagline on films table
      await db.execute(sql`
        UPDATE films
        SET tagline = ${normalized.tagline},
            tagline_en = ${normalized.taglineEn}
        WHERE id = ${film.id}
      `);

      // Clear existing relations
      await db.execute(sql`DELETE FROM film_genres WHERE film_id = ${film.id}`);
      await db.execute(sql`DELETE FROM film_people WHERE film_id = ${film.id}`);
      await db.execute(sql`DELETE FROM film_companies WHERE film_id = ${film.id}`);

      // Insert genres (map TMDB IDs to internal IDs)
      const filmGenreValues = normalized.genreIds
        .filter((gid) => validTmdbGenreIds.has(gid))
        .map((gid) => tmdbToInternal.get(gid))
        .filter((id): id is number => id !== undefined);
      if (filmGenreValues.length > 0) {
        await db.insert(filmGenres).values(
          filmGenreValues.map((genreId) => ({
            filmId: film.id,
            genreId,
          }))
        );
      }

      // Insert people
      if (normalized.people.length > 0) {
        await db.insert(filmPeople).values(
          normalized.people.map((person) => ({
            filmId: film.id,
            tmdbPersonId: person.tmdbPersonId,
            name: person.name,
            role: person.role,
            character: person.character,
            displayOrder: person.displayOrder,
            profileUrl: person.profileUrl,
          }))
        );
      }

      // Insert companies
      if (normalized.companies.length > 0) {
        await db.insert(filmCompanies).values(
          normalized.companies.map((company) => ({
            filmId: film.id,
            tmdbCompanyId: company.tmdbCompanyId,
            name: company.name,
            logoUrl: company.logoUrl,
            originCountry: company.originCountry,
          }))
        );
      }

      processed++;
      if (processed % 50 === 0) {
        console.log(`  ... ${processed} films processed`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to backfill film ${film.id}:`, error);
      skipped++;
    }
  }

  console.log(`  ✓ ${processed} films backfilled, ${skipped} skipped`);
  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
