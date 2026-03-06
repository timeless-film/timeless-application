const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  credits?: {
    cast: { name: string; order: number }[];
    crew: { name: string; job: string; department: string }[];
  };
  translations?: {
    translations: {
      iso_639_1: string;
      data: { overview: string; title: string };
    }[];
  };
}

export interface TmdbSearchResult {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  overview: string;
}

async function tmdbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 3600 }, // Cache 1h
  });

  if (!res.ok) {
    throw new Error(`TMDB API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Searches TMDB for films by title (and optional year).
 */
export async function searchFilms(query: string, year?: number): Promise<TmdbSearchResult[]> {
  const params: Record<string, string> = {
    query,
    language: "fr-FR",
    include_adult: "false",
  };
  if (year) params.year = year.toString();

  const data = await tmdbFetch<{ results: TmdbSearchResult[] }>("/search/movie", params);
  return data.results.slice(0, 5);
}

/**
 * Fetches full film details by TMDB ID.
 */
export async function getFilmDetails(tmdbId: number): Promise<TmdbMovie> {
  return tmdbFetch<TmdbMovie>(`/movie/${tmdbId}`, {
    language: "fr-FR",
    append_to_response: "credits,translations",
  });
}

/**
 * Normalizes TMDB data into a format suitable for our DB.
 */
export function normalizeTmdbData(movie: TmdbMovie) {
  const directors =
    movie.credits?.crew.filter((c) => c.job === "Director").map((c) => c.name) ?? [];

  const cast =
    movie.credits?.cast
      .sort((a, b) => a.order - b.order)
      .slice(0, 10)
      .map((c) => c.name) ?? [];

  const enTranslation = movie.translations?.translations.find((t) => t.iso_639_1 === "en");

  return {
    tmdbId: movie.id,
    originalTitle: movie.original_title,
    synopsis: movie.overview,
    synopsisEn: enTranslation?.data.overview ?? null,
    duration: movie.runtime ?? null,
    releaseYear: movie.release_date ? parseInt(movie.release_date.split("-")[0]) : null,
    genres: movie.genres.map((g) => g.name),
    directors,
    cast,
    countries: movie.production_countries.map((c) => c.iso_3166_1),
    posterUrl: movie.poster_path ? `${TMDB_IMAGE_BASE}/w500${movie.poster_path}` : null,
    backdropUrl: movie.backdrop_path ? `${TMDB_IMAGE_BASE}/w1280${movie.backdrop_path}` : null,
    tmdbRating: movie.vote_average.toFixed(1),
    tmdbMatchStatus: "matched" as const,
  };
}

/**
 * Automatically enriches a film from TMDB.
 * Returns null if no match found with sufficient confidence.
 */
export async function enrichFilmFromTmdb(
  title: string,
  year?: number
): Promise<ReturnType<typeof normalizeTmdbData> | null> {
  const results = await searchFilms(title, year);
  if (results.length === 0) return null;

  // Simple heuristic: first result if the title matches well
  const best = results[0];
  const titleMatch =
    best.title.toLowerCase().includes(title.toLowerCase()) ||
    best.original_title.toLowerCase().includes(title.toLowerCase());

  if (!titleMatch) return null;

  const details = await getFilmDetails(best.id);
  return normalizeTmdbData(details);
}
