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
      release_date: "1999-10-31",
      runtime: 120,
      genres: [{ id: 1, name: "Drama" }],
      production_countries: [{ iso_3166_1: "FR", name: "France" }],
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
      vote_average: 7.36,
      credits: {
        cast: [{ name: "Actor A", order: 0 }],
        crew: [
          { name: "Director One", job: "Director", department: "Directing" },
          { name: "Composer", job: "Original Music Composer", department: "Sound" },
        ],
      },
      translations: {
        translations: [{ iso_639_1: "en", data: { overview: "English synopsis", title: "Demo" } }],
      },
    };

    const result = normalizeTmdbData(movie);
    expect(result.directors).toEqual(["Director One"]);
  });

  it("limits cast to 10 actors ordered by cast order", () => {
    const cast = Array.from({ length: 12 }, (_, index) => ({
      name: `Actor ${index + 1}`,
      order: index,
    }));

    const movie: TmdbMovie = {
      id: 102,
      title: "Demo",
      original_title: "Demo Original",
      overview: "Synopsis",
      release_date: "2001-01-01",
      runtime: 90,
      genres: [],
      production_countries: [],
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
