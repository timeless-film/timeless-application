import { afterEach, describe, expect, it, vi } from "vitest";

import { enrichFilmFromTmdb, normalizeTmdbData } from "../index";

import type { TmdbMovie } from "../index";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeTmdbData", () => {
  it("extracts directors from crew", () => {
    const movie: TmdbMovie = {
      id: 101,
      title: "Demo",
      original_title: "Demo Original",
      overview: "Synopsis",
      tagline: "A demo tagline",
      release_date: "1999-10-31",
      runtime: 120,
      genres: [{ id: 18, name: "Drama" }],
      production_countries: [{ iso_3166_1: "FR", name: "France" }],
      production_companies: [],
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
      vote_average: 7.36,
      credits: {
        cast: [{ id: 1, name: "Actor A", character: "Role A", order: 0, profile_path: null }],
        crew: [
          {
            id: 2,
            name: "Director One",
            job: "Director",
            department: "Directing",
            profile_path: null,
          },
          {
            id: 3,
            name: "Composer",
            job: "Original Music Composer",
            department: "Sound",
            profile_path: null,
          },
        ],
      },
      translations: {
        translations: [
          {
            iso_639_1: "en",
            data: { overview: "English synopsis", title: "Demo", tagline: "An English tagline" },
          },
        ],
      },
    };

    const result = normalizeTmdbData(movie);
    expect(result.directors).toEqual(["Director One"]);
    expect(result.genreIds).toEqual([18]);
    expect(result.tagline).toBe("A demo tagline");
    expect(result.taglineEn).toBe("An English tagline");
    expect(result.people).toHaveLength(3); // 1 actor + 1 director + 1 composer
  });

  it("limits cast to 10 actors ordered by cast order", () => {
    const cast = Array.from({ length: 12 }, (_, index) => ({
      id: index + 100,
      name: `Actor ${index + 1}`,
      character: `Character ${index + 1}`,
      order: index,
      profile_path: null,
    }));

    const movie: TmdbMovie = {
      id: 102,
      title: "Demo",
      original_title: "Demo Original",
      overview: "Synopsis",
      tagline: "",
      release_date: "2001-01-01",
      runtime: 90,
      genres: [],
      production_countries: [],
      production_companies: [],
      poster_path: null,
      backdrop_path: null,
      vote_average: 5,
      credits: {
        cast,
        crew: [],
      },
      translations: { translations: [] },
    };

    const result = normalizeTmdbData(movie);
    expect(result.cast).toHaveLength(10);
    expect(result.cast[0]).toBe("Actor 1");
    expect(result.cast[9]).toBe("Actor 10");
    // Normalized people includes top 20 actors
    expect(result.people).toHaveLength(12);
  });
});

describe("enrichFilmFromTmdb", () => {
  it("returns null when TMDB search has no results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await enrichFilmFromTmdb("Unknown Film");

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
