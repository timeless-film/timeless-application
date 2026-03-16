const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const TMDB_PROFILE_IMAGE_BASE = `${TMDB_IMAGE_BASE}/w185`;

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  tagline: string;
  release_date: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  production_companies: {
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }[];
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  credits?: {
    cast: {
      id: number;
      name: string;
      character: string;
      order: number;
      profile_path: string | null;
    }[];
    crew: {
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }[];
  };
  translations?: {
    translations: {
      iso_639_1: string;
      data: { overview: string; title: string; tagline: string };
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

// Crew roles we extract to normalized film_people table
const EXTRACTED_CREW_ROLES: Record<string, NormalizedPerson["role"]> = {
  Director: "director",
  Producer: "producer",
  "Executive Producer": "executive_producer",
  "Original Music Composer": "composer",
  "Director of Photography": "cinematographer",
  Screenplay: "screenplay",
  Writer: "screenplay",
};

export interface NormalizedPerson {
  tmdbPersonId: number;
  name: string;
  role:
    | "director"
    | "actor"
    | "producer"
    | "executive_producer"
    | "composer"
    | "cinematographer"
    | "screenplay";
  character: string | null;
  displayOrder: number;
  profileUrl: string | null;
}

export interface NormalizedCompany {
  tmdbCompanyId: number;
  name: string;
  logoUrl: string | null;
  originCountry: string | null;
}

/**
 * Normalizes TMDB data into a format suitable for our DB.
 */
export function normalizeTmdbData(movie: TmdbMovie) {
  const directors =
    movie.credits?.crew.filter((c) => c.job === "Director").map((c) => c.name) ?? [];

  const castNames =
    movie.credits?.cast
      .sort((a, b) => a.order - b.order)
      .slice(0, 10)
      .map((c) => c.name) ?? [];

  const enTranslation = movie.translations?.translations.find((t) => t.iso_639_1 === "en");

  // Normalized people (actors + crew)
  const people: NormalizedPerson[] = [];

  // Actors (top 20 for normalized table, display names limited to 10 for text cache)
  if (movie.credits?.cast) {
    const sortedCast = [...movie.credits.cast].sort((a, b) => a.order - b.order).slice(0, 20);
    for (const actor of sortedCast) {
      people.push({
        tmdbPersonId: actor.id,
        name: actor.name,
        role: "actor",
        character: actor.character || null,
        displayOrder: actor.order,
        profileUrl: actor.profile_path ? `${TMDB_PROFILE_IMAGE_BASE}${actor.profile_path}` : null,
      });
    }
  }

  // Crew by role
  if (movie.credits?.crew) {
    let crewOrder = 0;
    const seenCrewKeys = new Set<string>();
    for (const member of movie.credits.crew) {
      const role = EXTRACTED_CREW_ROLES[member.job];
      if (!role) continue;
      // Deduplicate: same person can appear multiple times with different jobs
      const key = `${member.id}-${role}`;
      if (seenCrewKeys.has(key)) continue;
      seenCrewKeys.add(key);
      people.push({
        tmdbPersonId: member.id,
        name: member.name,
        role,
        character: null,
        displayOrder: crewOrder++,
        profileUrl: member.profile_path ? `${TMDB_PROFILE_IMAGE_BASE}${member.profile_path}` : null,
      });
    }
  }

  // Production companies
  const companies: NormalizedCompany[] = movie.production_companies.map((c) => ({
    tmdbCompanyId: c.id,
    name: c.name,
    logoUrl: c.logo_path ? `${TMDB_IMAGE_BASE}/w200${c.logo_path}` : null,
    originCountry: c.origin_country || null,
  }));

  return {
    tmdbId: movie.id,
    originalTitle: movie.original_title,
    synopsis: movie.overview,
    synopsisEn: enTranslation?.data.overview ?? null,
    tagline: movie.tagline || null,
    taglineEn: enTranslation?.data.tagline || null,
    duration: movie.runtime ?? null,
    releaseYear: movie.release_date ? parseInt(movie.release_date.split("-")[0] ?? "", 10) : null,
    genres: movie.genres.map((g) => g.name),
    genreIds: movie.genres.map((g) => g.id),
    directors,
    cast: castNames,
    people,
    companies,
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
  if (!best) return null;

  const titleMatch =
    best.title.toLowerCase().includes(title.toLowerCase()) ||
    best.original_title.toLowerCase().includes(title.toLowerCase());

  if (!titleMatch) return null;

  const details = await getFilmDetails(best.id);
  return normalizeTmdbData(details);
}
