"use server";

import { getCurrentMembership } from "@/lib/auth/membership";
import { getFilmDetailForAdmin, listFilmsForAdmin } from "@/lib/services/admin-films-service";

type FilmStatus = "active" | "inactive" | "retired";
type TmdbMatchStatus = "matched" | "pending" | "no_match" | "manual";

interface ListFilmsInput {
  search?: string;
  status?: FilmStatus;
  tmdbMatchStatus?: TmdbMatchStatus;
  page: number;
  limit: number;
}

export async function getFilmsPaginated(input: ListFilmsInput) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const result = await listFilmsForAdmin({
    page: input.page,
    limit: input.limit,
    search: input.search,
    status: input.status,
    tmdbMatchStatus: input.tmdbMatchStatus,
  });

  return { films: result.films, total: result.total };
}

export async function getFilmDetailAction(filmId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const detail = await getFilmDetailForAdmin(filmId);
  if (!detail) return { error: "NOT_FOUND" as const };

  return { data: detail };
}
