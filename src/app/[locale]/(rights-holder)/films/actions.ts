"use server";

import { eq } from "drizzle-orm";
import { after } from "next/server";

import { getCurrentMembership } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { films } from "@/lib/db/schema";
import { normalizeTitle, validateGroupedFilmForServer } from "@/lib/services/film-import-service";
import {
  archiveFilmById,
  createFilm,
  getFilmById,
  listAllFilmsForAccount,
  listFilmsForAccount,
  listFilmsForAccountPaginated,
  syncFilmFromImportById,
  setFilmStatus,
  updateFilmById,
} from "@/lib/services/film-service";
import { enrichFilmFromTmdb, getFilmDetails, normalizeTmdbData, searchFilms } from "@/lib/tmdb";

import type { GroupedFilm } from "@/lib/services/film-import-service";
import type { CreateFilmInput } from "@/lib/services/film-service";

// ─── List ─────────────────────────────────────────────────────────────────────

export async function getFilms() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  const films = await listFilmsForAccount(ctx.accountId);
  return { films };
}

// ─── List (paginated) ─────────────────────────────────────────────────────────

export async function getFilmsPaginated(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  const result = await listFilmsForAccountPaginated(ctx.accountId, params);
  return result;
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getFilm(filmId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  const result = await getFilmById(filmId, ctx.accountId);

  if ("error" in result) {
    return { error: result.error };
  }

  return { film: result.film };
}

// ─── Create ───────────────────────────────────────────────────────────────────

interface CreateFilmActionInput {
  title: string;
  externalId?: string;
  type: "direct" | "validation";
  status?: "active" | "inactive";
  prices: { countries: string[]; price: number; currency: string }[];
  tmdbId?: number | null;
}

export async function createFilmAction(input: CreateFilmActionInput) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  if (!input.title.trim()) {
    return { error: "INVALID_INPUT" as const };
  }

  if (input.prices.length === 0) {
    return { error: "NO_PRICE_ZONES" as const };
  }

  // TMDB enrichment (synchronous if a match was selected)
  let tmdbFields: Partial<CreateFilmInput> = {};
  if (input.tmdbId) {
    try {
      const details = await getFilmDetails(input.tmdbId);
      const normalized = normalizeTmdbData(details);
      tmdbFields = {
        tmdbId: normalized.tmdbId,
        tmdbMatchStatus: "matched",
        tmdbData: details,
        originalTitle: normalized.originalTitle,
        synopsis: normalized.synopsis,
        synopsisEn: normalized.synopsisEn,
        duration: normalized.duration,
        releaseYear: normalized.releaseYear,
        genres: normalized.genres,
        directors: normalized.directors,
        cast: normalized.cast,
        countries: normalized.countries,
        posterUrl: normalized.posterUrl,
        backdropUrl: normalized.backdropUrl,
        tmdbRating: normalized.tmdbRating,
      };
    } catch {
      // TMDB unavailable — create with pending status
      tmdbFields = { tmdbMatchStatus: "pending" };
    }
  } else {
    tmdbFields = { tmdbMatchStatus: "pending" };
  }

  const result = await createFilm(ctx.accountId, {
    title: input.title,
    externalId: input.externalId || null,
    type: input.type,
    status: input.status,
    prices: input.prices,
    ...tmdbFields,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  // Auto-enrich from TMDB when no match was selected manually
  if (!input.tmdbId && result.film) {
    const filmId = result.film.id;
    const title = input.title;
    after(async () => {
      try {
        const enriched = await enrichFilmFromTmdb(title);
        if (enriched) {
          await db
            .update(films)
            .set({ ...enriched, tmdbMatchStatus: "matched", updatedAt: new Date() })
            .where(eq(films.id, filmId));
        } else {
          await db
            .update(films)
            .set({ tmdbMatchStatus: "no_match", updatedAt: new Date() })
            .where(eq(films.id, filmId));
        }
      } catch (error) {
        console.error(`[TMDB] Failed to auto-enrich film ${filmId}:`, error);
      }
    });
  }

  return { success: true as const, film: result.film };
}

// ─── Update ───────────────────────────────────────────────────────────────────

interface UpdateFilmActionInput {
  title?: string;
  externalId?: string | null;
  type?: "direct" | "validation";
  status?: "active" | "inactive";
  prices?: { countries: string[]; price: number; currency: string }[];
}

export async function updateFilmAction(filmId: string, input: UpdateFilmActionInput) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const result = await updateFilmById(filmId, ctx.accountId, input);

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const, film: result.film };
}

// ─── Set Status ───────────────────────────────────────────────────────────────

export async function setFilmStatusAction(
  filmId: string,
  newStatus: "active" | "inactive" | "retired"
) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const result = await setFilmStatus(filmId, ctx.accountId, newStatus);

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const };
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function archiveFilmAction(filmId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const result = await archiveFilmById(filmId, ctx.accountId);

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const };
}

// ─── TMDB Search ──────────────────────────────────────────────────────────────

export async function searchTmdb(query: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (!query.trim()) return { results: [] };

  try {
    const results = await searchFilms(query.trim());
    return { results };
  } catch {
    return { results: [] };
  }
}

// ─── Resync TMDB ──────────────────────────────────────────────────────────────

export async function resyncTmdbAction(filmId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  const filmResult = await getFilmById(filmId, ctx.accountId);
  if ("error" in filmResult) return { error: filmResult.error };

  const film = filmResult.film;

  try {
    const results = await searchFilms(film.title, film.releaseYear ?? undefined);
    const best = results[0];

    const titleMatch =
      best &&
      (best.title.toLowerCase().includes(film.title.toLowerCase()) ||
        best.original_title.toLowerCase().includes(film.title.toLowerCase()));

    if (!best || !titleMatch) {
      await updateFilmById(filmId, ctx.accountId, {
        tmdbMatchStatus: "no_match",
        tmdbData: null,
        tmdbId: null,
      });
      return { success: true as const, status: "no_match" as const };
    }

    const details = await getFilmDetails(best.id);
    const normalized = normalizeTmdbData(details);

    await updateFilmById(filmId, ctx.accountId, {
      tmdbId: normalized.tmdbId,
      tmdbMatchStatus: "matched",
      tmdbData: details,
      originalTitle: normalized.originalTitle,
      synopsis: normalized.synopsis,
      synopsisEn: normalized.synopsisEn,
      duration: normalized.duration,
      releaseYear: normalized.releaseYear,
      genres: normalized.genres,
      directors: normalized.directors,
      cast: normalized.cast,
      countries: normalized.countries,
      posterUrl: normalized.posterUrl,
      backdropUrl: normalized.backdropUrl,
      tmdbRating: normalized.tmdbRating,
    });

    return {
      success: true as const,
      status: "matched" as const,
      data: {
        tmdbId: normalized.tmdbId,
        originalTitle: normalized.originalTitle,
        posterUrl: normalized.posterUrl,
        backdropUrl: normalized.backdropUrl,
        synopsis: normalized.synopsis,
        synopsisEn: normalized.synopsisEn,
        directors: normalized.directors,
        cast: normalized.cast,
        duration: normalized.duration,
        releaseYear: normalized.releaseYear,
        genres: normalized.genres,
      },
    };
  } catch {
    return { error: "TMDB_UNAVAILABLE" as const };
  }
}

// ─── Disassociate TMDB ────────────────────────────────────────────────────────

export async function disassociateTmdbAction(filmId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  const result = await updateFilmById(filmId, ctx.accountId, {
    tmdbMatchStatus: "no_match",
    tmdbData: null,
    tmdbId: null,
    originalTitle: null,
    synopsis: null,
    synopsisEn: null,
    duration: null,
    releaseYear: null,
    genres: null,
    directors: null,
    cast: null,
    countries: null,
    posterUrl: null,
    backdropUrl: null,
    tmdbRating: null,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const };
}

interface ManualTmdbInput {
  originalTitle?: string | null;
  synopsis?: string | null;
  synopsisEn?: string | null;
  releaseYear?: number | null;
  duration?: number | null;
  directors?: string[] | null;
  genres?: string[] | null;
  cast?: string[] | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
}

export async function updateTmdbManualAction(filmId: string, input: ManualTmdbInput) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const result = await updateFilmById(filmId, ctx.accountId, {
    tmdbMatchStatus: "manual",
    originalTitle: input.originalTitle ?? null,
    synopsis: input.synopsis ?? null,
    synopsisEn: input.synopsisEn ?? null,
    releaseYear: input.releaseYear ?? null,
    duration: input.duration ?? null,
    directors: input.directors ?? null,
    genres: input.genres ?? null,
    cast: input.cast ?? null,
    posterUrl: input.posterUrl ?? null,
    backdropUrl: input.backdropUrl ?? null,
    tmdbData: {
      source: "manual",
      originalTitle: input.originalTitle ?? null,
      synopsis: input.synopsis ?? null,
      synopsisEn: input.synopsisEn ?? null,
      releaseYear: input.releaseYear ?? null,
      duration: input.duration ?? null,
      directors: input.directors ?? null,
      genres: input.genres ?? null,
      cast: input.cast ?? null,
      posterUrl: input.posterUrl ?? null,
      backdropUrl: input.backdropUrl ?? null,
    },
  });

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const };
}

// ─── Import Films ─────────────────────────────────────────────────────────────

interface ImportPayload {
  toCreate: GroupedFilm[];
  toUpdate: GroupedFilm[];
  toArchive: { id: string; title: string }[];
  hasIdentifierColumn: boolean;
  importSource?: "csv" | "excel";
  autoEnrichImportedFilms?: boolean;
  importedMetadataFields?: Array<
    | "synopsis"
    | "synopsisEn"
    | "duration"
    | "releaseYear"
    | "genres"
    | "directors"
    | "cast"
    | "posterUrl"
    | "backdropUrl"
  >;
}

export async function importFilmsAction(payload: ImportPayload) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const batchId = crypto.randomUUID();
  const importSource = payload.importSource ?? "csv";
  let created = 0;
  let updated = 0;
  let archived = 0;
  let errorCount = 0;
  const filmsToEnrich: Array<{
    filmId: string;
    title: string;
    releaseYear?: number;
    importedFields: {
      synopsis: boolean;
      synopsisEn: boolean;
      duration: boolean;
      releaseYear: boolean;
      genres: boolean;
      directors: boolean;
      cast: boolean;
      posterUrl: boolean;
      backdropUrl: boolean;
    };
  }> = [];
  const existingFilms = await listAllFilmsForAccount(ctx.accountId);

  const hasImportedMetadata = (film: GroupedFilm) => {
    return (
      film.synopsis !== undefined ||
      film.synopsisEn !== undefined ||
      film.duration !== undefined ||
      film.releaseYear !== undefined ||
      film.genres !== undefined ||
      film.directors !== undefined ||
      film.cast !== undefined ||
      film.posterUrl !== undefined ||
      film.backdropUrl !== undefined
    );
  };

  const getImportedFieldFlags = (film: GroupedFilm) => ({
    synopsis: film.synopsis !== undefined,
    synopsisEn: film.synopsisEn !== undefined,
    duration: film.duration !== undefined,
    releaseYear: film.releaseYear !== undefined,
    genres: film.genres !== undefined,
    directors: film.directors !== undefined,
    cast: film.cast !== undefined,
    posterUrl: film.posterUrl !== undefined,
    backdropUrl: film.backdropUrl !== undefined,
  });

  await db.transaction(async () => {
    // ── Create new films ──
    for (const film of payload.toCreate) {
      try {
        if (validateGroupedFilmForServer(film)) {
          errorCount++;
          continue;
        }

        const result = await createFilm(ctx.accountId, {
          title: film.title,
          externalId: payload.hasIdentifierColumn ? film.identifier : null,
          type: film.type,
          status: film.status,
          prices: film.prices,
          synopsis: film.synopsis,
          synopsisEn: film.synopsisEn,
          duration: film.duration,
          releaseYear: film.releaseYear,
          genres: film.genres,
          directors: film.directors,
          cast: film.cast,
          posterUrl: film.posterUrl,
          backdropUrl: film.backdropUrl,
          tmdbMatchStatus: hasImportedMetadata(film) ? "manual" : "pending",
          importSource,
          importBatchId: batchId,
        });
        if ("error" in result) {
          errorCount++;
        } else {
          created++;
          if (result.film?.id) {
            filmsToEnrich.push({
              filmId: result.film.id,
              title: film.title,
              releaseYear: film.releaseYear ?? undefined,
              importedFields: getImportedFieldFlags(film),
            });
          }
        }
      } catch {
        errorCount++;
      }
    }

    // ── Update existing films ──
    for (const film of payload.toUpdate) {
      try {
        if (validateGroupedFilmForServer(film)) {
          errorCount++;
          continue;
        }

        let existingFilm;

        if (payload.hasIdentifierColumn) {
          existingFilm = existingFilms.find(
            (currentFilm) => currentFilm.externalId === film.identifier
          );
        }
        if (!existingFilm) {
          existingFilm = existingFilms.find(
            (currentFilm) => normalizeTitle(currentFilm.title) === normalizeTitle(film.title)
          );
        }

        if (!existingFilm) {
          errorCount++;
          continue;
        }

        const result = await syncFilmFromImportById(existingFilm.id, ctx.accountId, {
          title: film.title,
          externalId: payload.hasIdentifierColumn ? film.identifier : existingFilm.externalId,
          type: film.type,
          status: film.status,
          prices: film.prices,
          synopsis: film.synopsis,
          synopsisEn: film.synopsisEn,
          duration: film.duration,
          releaseYear: film.releaseYear,
          genres: film.genres,
          directors: film.directors,
          cast: film.cast,
          posterUrl: film.posterUrl,
          backdropUrl: film.backdropUrl,
          tmdbMatchStatus: hasImportedMetadata(film) ? "manual" : undefined,
          importSource,
          importBatchId: batchId,
        });

        if ("error" in result) {
          errorCount++;
        } else {
          updated++;
          filmsToEnrich.push({
            filmId: existingFilm.id,
            title: film.title,
            releaseYear: film.releaseYear ?? undefined,
            importedFields: getImportedFieldFlags(film),
          });
        }
      } catch {
        errorCount++;
      }
    }

    // ── Archive missing films ──
    for (const film of payload.toArchive) {
      try {
        const result = await archiveFilmById(film.id, ctx.accountId);
        if ("error" in result) {
          errorCount++;
        } else {
          archived++;
        }
      } catch {
        errorCount++;
      }
    }
  });

  if (payload.autoEnrichImportedFilms && filmsToEnrich.length > 0) {
    after(async () => {
      for (const film of filmsToEnrich) {
        try {
          const tmdbData = await enrichFilmFromTmdb(film.title, film.releaseYear);

          if (!tmdbData) {
            await db
              .update(films)
              .set({ tmdbMatchStatus: "no_match", updatedAt: new Date() })
              .where(eq(films.id, film.filmId));
            continue;
          }

          const updatePayload: Partial<typeof films.$inferInsert> = {
            tmdbId: tmdbData.tmdbId,
            tmdbMatchStatus: "matched",
            originalTitle: tmdbData.originalTitle,
            countries: tmdbData.countries,
            tmdbRating: tmdbData.tmdbRating,
            updatedAt: new Date(),
          };

          // Only complete metadata fields that were not provided by import.
          if (!film.importedFields.synopsis) updatePayload.synopsis = tmdbData.synopsis;
          if (!film.importedFields.synopsisEn) updatePayload.synopsisEn = tmdbData.synopsisEn;
          if (!film.importedFields.duration) updatePayload.duration = tmdbData.duration;
          if (!film.importedFields.releaseYear) updatePayload.releaseYear = tmdbData.releaseYear;
          if (!film.importedFields.genres) updatePayload.genres = tmdbData.genres;
          if (!film.importedFields.directors) updatePayload.directors = tmdbData.directors;
          if (!film.importedFields.cast) updatePayload.cast = tmdbData.cast;
          if (!film.importedFields.posterUrl) updatePayload.posterUrl = tmdbData.posterUrl;
          if (!film.importedFields.backdropUrl) {
            updatePayload.backdropUrl = tmdbData.backdropUrl;
          }

          await db.update(films).set(updatePayload).where(eq(films.id, film.filmId));
        } catch (error) {
          console.error(`[TMDB] Failed to auto-enrich imported film ${film.filmId}:`, error);
        }
      }
    });
  }

  return { success: true as const, created, updated, archived, errors: errorCount };
}
