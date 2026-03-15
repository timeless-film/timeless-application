"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import { getCatalogForExhibitor } from "@/lib/services/catalog-service";

export interface SearchSuggestion {
  id: string;
  title: string;
  posterUrl: string | null;
  releaseYear: number | null;
  directors: string[] | null;
}

export async function searchFilmSuggestions(
  query: string
): Promise<{ suggestions: SearchSuggestion[] }> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return { suggestions: [] };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { suggestions: [] };
  }

  const activeAccount = await getActiveAccountCookie();
  if (!activeAccount?.accountId) {
    return { suggestions: [] };
  }

  try {
    const result = await getCatalogForExhibitor(
      activeAccount.accountId,
      { search: trimmed, availableForTerritory: false },
      { page: 1, limit: 5 },
      { field: "title", order: "asc" }
    );

    return {
      suggestions: result.films.map((film) => ({
        id: film.id,
        title: film.title,
        posterUrl: film.posterUrl,
        releaseYear: film.releaseYear,
        directors: film.directors,
      })),
    };
  } catch (error) {
    console.error("[searchFilmSuggestions] Failed to fetch suggestions:", error);
    return { suggestions: [] };
  }
}
