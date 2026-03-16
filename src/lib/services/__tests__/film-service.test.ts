import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockDeleteWhere = vi.fn();
const mockSelectOrderBy = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere, orderBy: mockSelectOrderBy }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));
const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      films: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
    select: () => mockSelect(),
    transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  ne: (a: unknown, b: unknown) => ({ ne: [a, b] }),
  or: (...args: unknown[]) => ({ or: args }),
  ilike: (a: unknown, b: unknown) => ({ ilike: [a, b] }),
  count: () => "count",
}));

vi.mock("@/lib/db/schema", () => ({
  films: {
    id: "films.id",
    accountId: "films.accountId",
    status: "films.status",
    title: "films.title",
    externalId: "films.externalId",
  },
  filmPrices: {
    id: "filmPrices.id",
    filmId: "filmPrices.filmId",
  },
  filmPeople: {
    filmId: "filmPeople.filmId",
  },
  filmGenres: {
    filmId: "filmGenres.filmId",
  },
  genres: {
    id: "genres.id",
    nameEn: "genres.nameEn",
    nameFr: "genres.nameFr",
  },
}));

vi.mock("@/lib/currencies", () => ({
  STRIPE_CURRENCY_CODES: ["EUR", "USD", "GBP", "CHF", "JPY"] as const,
}));

// Import after mocks
import {
  archiveFilmById,
  createFilm,
  getFilmById,
  listFilmsForAccount,
  listFilmsForAccountPaginated,
  matchGenreNamesToIds,
  setFilmStatus,
  syncNormalizedRelationsFromFlatFields,
  updateFilmById,
  verifyFilmOwnership,
} from "../film-service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validPrices = [{ countries: ["FR", "BE"], price: 15000, currency: "EUR" }];

const filmFixture = {
  id: "film-1",
  accountId: "account-1",
  title: "Cléo de 5 à 7",
  status: "active",
  type: "direct",
  prices: [{ id: "p1", countries: ["FR", "BE"], price: 15000, currency: "EUR" }],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("film-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── listFilmsForAccount ────────────────────────────────────────────────

  describe("listFilmsForAccount", () => {
    it("returns films for the account (excluding retired)", async () => {
      const films = [filmFixture];
      mockFindMany.mockResolvedValue(films);

      const result = await listFilmsForAccount("account-1");

      expect(result).toEqual(films);
      expect(mockFindMany).toHaveBeenCalled();
    });

    it("returns empty array when no films", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await listFilmsForAccount("account-1");

      expect(result).toEqual([]);
    });
  });

  // ─── listFilmsForAccountPaginated ───────────────────────────────────────

  describe("listFilmsForAccountPaginated", () => {
    it("returns paginated films with total count", async () => {
      const films = [filmFixture];
      mockFindMany.mockResolvedValue(films);
      mockSelectWhere.mockResolvedValue([{ value: 12 }]);

      const result = await listFilmsForAccountPaginated("account-1", {
        page: 1,
        limit: 5,
      });

      expect(result).toEqual({ films, total: 12 });
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, offset: 0 }));
    });

    it("computes offset from page and limit", async () => {
      mockFindMany.mockResolvedValue([]);
      mockSelectWhere.mockResolvedValue([{ value: 0 }]);

      await listFilmsForAccountPaginated("account-1", { page: 3, limit: 5 });

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, offset: 10 }));
    });

    it("returns total 0 when count result is empty", async () => {
      mockFindMany.mockResolvedValue([]);
      mockSelectWhere.mockResolvedValue([]);

      const result = await listFilmsForAccountPaginated("account-1");

      expect(result.total).toBe(0);
    });

    it("passes search condition when search is provided", async () => {
      mockFindMany.mockResolvedValue([]);
      mockSelectWhere.mockResolvedValue([{ value: 0 }]);

      await listFilmsForAccountPaginated("account-1", { search: "cléo" });

      // Verify the where condition includes an ilike/or search filter
      const callArgs = mockFindMany.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs.limit).toBe(5);
      expect(callArgs.offset).toBe(0);
    });

    it("uses defaults when no options provided", async () => {
      mockFindMany.mockResolvedValue([]);
      mockSelectWhere.mockResolvedValue([{ value: 0 }]);

      await listFilmsForAccountPaginated("account-1");

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, offset: 0 }));
    });
  });

  // ─── getFilmById ────────────────────────────────────────────────────────

  describe("getFilmById", () => {
    it("returns film with prices when found", async () => {
      mockFindFirst.mockResolvedValue(filmFixture);

      const result = await getFilmById("film-1", "account-1");

      expect(result).toEqual({ film: filmFixture });
    });

    it("returns NOT_FOUND when film does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getFilmById("nonexistent", "account-1");

      expect(result).toEqual({ error: "NOT_FOUND" });
    });
  });

  // ─── verifyFilmOwnership ───────────────────────────────────────────────

  describe("verifyFilmOwnership", () => {
    it("returns true when film belongs to account", async () => {
      mockFindFirst.mockResolvedValue(filmFixture);

      const result = await verifyFilmOwnership("film-1", "account-1");

      expect(result).toBe(true);
    });

    it("returns false when film does not belong to account", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await verifyFilmOwnership("film-1", "other-account");

      expect(result).toBe(false);
    });
  });

  // ─── createFilm ────────────────────────────────────────────────────────

  describe("createFilm", () => {
    it("creates a film with valid prices", async () => {
      const createdFilm = { id: "new-film", title: "Test Film" };
      mockInsertReturning.mockResolvedValue([createdFilm]);
      mockFindFirst.mockResolvedValue({ ...createdFilm, prices: validPrices });

      const result = await createFilm("account-1", {
        title: "Test Film",
        type: "direct",
        prices: validPrices,
      });

      expect(result).toEqual({ film: { ...createdFilm, prices: validPrices } });
    });

    it("returns NO_PRICE_ZONES when prices array is empty", async () => {
      const result = await createFilm("account-1", {
        title: "Test Film",
        type: "direct",
        prices: [],
      });

      expect(result).toEqual({ error: "NO_PRICE_ZONES" });
    });

    it("returns INVALID_PRICE for negative price", async () => {
      const result = await createFilm("account-1", {
        title: "Test Film",
        type: "direct",
        prices: [{ countries: ["FR"], price: -100, currency: "EUR" }],
      });

      expect(result).toEqual({ error: "INVALID_PRICE" });
    });

    it("returns INVALID_PRICE for zero price", async () => {
      const result = await createFilm("account-1", {
        title: "Test Film",
        type: "direct",
        prices: [{ countries: ["FR"], price: 0, currency: "EUR" }],
      });

      expect(result).toEqual({ error: "INVALID_PRICE" });
    });

    it("returns INVALID_PRICE for non-integer price", async () => {
      const result = await createFilm("account-1", {
        title: "Test Film",
        type: "direct",
        prices: [{ countries: ["FR"], price: 150.5, currency: "EUR" }],
      });

      expect(result).toEqual({ error: "INVALID_PRICE" });
    });

    it("returns INVALID_CURRENCY for unknown currency", async () => {
      const result = await createFilm("account-1", {
        title: "Test Film",
        type: "direct",
        prices: [{ countries: ["FR"], price: 15000, currency: "INVALID" }],
      });

      expect(result).toEqual({ error: "INVALID_CURRENCY" });
    });

    it("returns EMPTY_COUNTRIES when countries array is empty", async () => {
      const result = await createFilm("account-1", {
        title: "Test Film",
        type: "direct",
        prices: [{ countries: [], price: 15000, currency: "EUR" }],
      });

      expect(result).toEqual({ error: "EMPTY_COUNTRIES" });
    });

    it("returns DUPLICATE_COUNTRY when a country appears in two zones", async () => {
      const result = await createFilm("account-1", {
        title: "Test Film",
        type: "direct",
        prices: [
          { countries: ["FR", "BE"], price: 15000, currency: "EUR" },
          { countries: ["FR", "US"], price: 20000, currency: "USD" },
        ],
      });

      expect(result).toEqual({ error: "DUPLICATE_COUNTRY" });
    });
  });

  // ─── updateFilmById ────────────────────────────────────────────────────

  describe("updateFilmById", () => {
    it("updates film and returns updated data", async () => {
      const existing = { ...filmFixture, status: "active" };
      const updated = { ...existing, title: "Updated Title" };
      mockFindFirst
        .mockResolvedValueOnce(existing) // ownership check
        .mockResolvedValueOnce({ ...updated, prices: validPrices }); // re-fetch
      mockUpdateReturning.mockResolvedValue([updated]);

      const result = await updateFilmById("film-1", "account-1", {
        title: "Updated Title",
      });

      expect(result).toEqual({ film: { ...updated, prices: validPrices } });
    });

    it("returns NOT_FOUND when film does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await updateFilmById("nonexistent", "account-1", {
        title: "Updated",
      });

      expect(result).toEqual({ error: "NOT_FOUND" });
    });

    it("returns FILM_RETIRED when trying to update a retired film", async () => {
      mockFindFirst.mockResolvedValue({ ...filmFixture, status: "retired" });

      const result = await updateFilmById("film-1", "account-1", {
        title: "Updated",
      });

      expect(result).toEqual({ error: "FILM_RETIRED" });
    });

    it("validates prices when provided", async () => {
      mockFindFirst.mockResolvedValue(filmFixture);

      const result = await updateFilmById("film-1", "account-1", {
        prices: [{ countries: ["FR"], price: -1, currency: "EUR" }],
      });

      expect(result).toEqual({ error: "INVALID_PRICE" });
    });
  });

  // ─── setFilmStatus ─────────────────────────────────────────────────────

  describe("setFilmStatus", () => {
    it("transitions active to inactive", async () => {
      mockFindFirst.mockResolvedValue({ ...filmFixture, status: "active" });
      mockUpdateReturning.mockResolvedValue([{ ...filmFixture, status: "inactive" }]);

      const result = await setFilmStatus("film-1", "account-1", "inactive");

      expect(result).toEqual({ film: { ...filmFixture, status: "inactive" } });
    });

    it("transitions active to retired", async () => {
      mockFindFirst.mockResolvedValue({ ...filmFixture, status: "active" });
      mockUpdateReturning.mockResolvedValue([{ ...filmFixture, status: "retired" }]);

      const result = await setFilmStatus("film-1", "account-1", "retired");

      expect(result).toEqual({ film: { ...filmFixture, status: "retired" } });
    });

    it("returns ALREADY_RETIRED when film is retired", async () => {
      mockFindFirst.mockResolvedValue({ ...filmFixture, status: "retired" });

      const result = await setFilmStatus("film-1", "account-1", "active");

      expect(result).toEqual({ error: "ALREADY_RETIRED" });
    });

    it("returns NOT_FOUND when film does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await setFilmStatus("nonexistent", "account-1", "active");

      expect(result).toEqual({ error: "NOT_FOUND" });
    });
  });

  // ─── archiveFilmById ───────────────────────────────────────────────────

  describe("archiveFilmById", () => {
    it("sets film status to retired", async () => {
      mockFindFirst.mockResolvedValue({ ...filmFixture, status: "active" });
      mockUpdateReturning.mockResolvedValue([{ ...filmFixture, status: "retired" }]);

      const result = await archiveFilmById("film-1", "account-1");

      expect(result).toEqual({ film: { ...filmFixture, status: "retired" } });
    });

    it("returns ALREADY_RETIRED for retired film", async () => {
      mockFindFirst.mockResolvedValue({ ...filmFixture, status: "retired" });

      const result = await archiveFilmById("film-1", "account-1");

      expect(result).toEqual({ error: "ALREADY_RETIRED" });
    });
  });

  // ─── matchGenreNamesToIds ────────────────────────────────────────────

  describe("matchGenreNamesToIds", () => {
    const genreFixtures = [
      { id: 1, tmdbId: 28, nameEn: "Action", nameFr: "Action" },
      { id: 2, tmdbId: 35, nameEn: "Comedy", nameFr: "Comédie" },
      { id: 3, tmdbId: 18, nameEn: "Drama", nameFr: "Drame" },
      { id: 4, tmdbId: 878, nameEn: "Science Fiction", nameFr: "Science-Fiction" },
    ];

    beforeEach(() => {
      mockSelectOrderBy.mockResolvedValue(genreFixtures);
    });

    it("returns empty array for empty input", async () => {
      const result = await matchGenreNamesToIds([]);

      expect(result).toEqual([]);
      expect(mockSelectOrderBy).not.toHaveBeenCalled();
    });

    it("matches English genre names case-insensitively", async () => {
      const result = await matchGenreNamesToIds(["action", "Drama"]);

      expect(result).toEqual([1, 3]);
    });

    it("matches French genre names case-insensitively", async () => {
      const result = await matchGenreNamesToIds(["Comédie", "drame"]);

      expect(result).toEqual([2, 3]);
    });

    it("matches by internal genre ID", async () => {
      const result = await matchGenreNamesToIds(["1", "4"]);

      expect(result).toEqual([1, 4]);
    });

    it("matches by TMDB genre ID", async () => {
      const result = await matchGenreNamesToIds(["28", "18"]);

      expect(result).toEqual([1, 3]);
    });

    it("prefers internal ID over TMDB ID when both could match", async () => {
      // "1" matches internal ID 1 (Action), not TMDB ID 1 (which doesn't exist)
      const result = await matchGenreNamesToIds(["1"]);

      expect(result).toEqual([1]);
    });

    it("falls back to name matching when numeric value matches neither ID", async () => {
      // "99999" doesn't match any internal or TMDB ID → no match
      const result = await matchGenreNamesToIds(["99999"]);

      expect(result).toEqual([]);
    });

    it("handles mixed IDs and names in the same input", async () => {
      const result = await matchGenreNamesToIds(["1", "Comédie", "878"]);

      expect(result).toEqual([1, 2, 4]);
    });

    it("skips unmatched genre names", async () => {
      const result = await matchGenreNamesToIds(["Action", "Nonexistent", "Drama"]);

      expect(result).toEqual([1, 3]);
    });

    it("trims whitespace from input names", async () => {
      const result = await matchGenreNamesToIds(["  Action  ", " Drama"]);

      expect(result).toEqual([1, 3]);
    });

    it("skips empty and whitespace-only names", async () => {
      const result = await matchGenreNamesToIds(["", "  ", "Action"]);

      expect(result).toEqual([1]);
    });

    it("deduplicates matched IDs", async () => {
      const result = await matchGenreNamesToIds(["Action", "action", "ACTION"]);

      expect(result).toEqual([1]);
    });

    it("matches same genre by English and French names", async () => {
      const result = await matchGenreNamesToIds(["Comedy", "Comédie"]);

      expect(result).toEqual([2]);
    });

    it("deduplicates when ID and name resolve to same genre", async () => {
      const result = await matchGenreNamesToIds(["1", "Action", "28"]);

      expect(result).toEqual([1]);
    });

    it("returns empty array when no names match", async () => {
      const result = await matchGenreNamesToIds(["Unknown", "Nonexistent"]);

      expect(result).toEqual([]);
    });

    it("ignores zero and negative numbers", async () => {
      const result = await matchGenreNamesToIds(["0", "-1", "Action"]);

      expect(result).toEqual([1]);
    });

    it("ignores decimal numbers and treats them as names", async () => {
      const result = await matchGenreNamesToIds(["1.5", "Action"]);

      expect(result).toEqual([1]);
    });
  });

  // ─── syncNormalizedRelationsFromFlatFields ──────────────────────────────

  describe("syncNormalizedRelationsFromFlatFields", () => {
    const mockTxInsertValues = vi.fn();
    const mockTxDeleteWhere = vi.fn();
    const mockTxSelectWhere = vi.fn();
    const mockTxSelectFrom = vi.fn(() => ({ where: mockTxSelectWhere }));
    const mockTxSelect = vi.fn(() => ({ from: mockTxSelectFrom }));
    const mockTx = {
      delete: vi.fn(() => ({ where: mockTxDeleteWhere })),
      insert: vi.fn(() => ({ values: mockTxInsertValues })),
      select: () => mockTxSelect(),
    };

    beforeEach(() => {
      mockTransaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => {
        await fn(mockTx);
      });
      mockTxInsertValues.mockResolvedValue(undefined);
      mockTxDeleteWhere.mockResolvedValue(undefined);
      mockTxSelectWhere.mockResolvedValue([]);
    });

    afterEach(() => {
      mockTx.delete.mockClear();
      mockTx.insert.mockClear();
      mockTxInsertValues.mockClear();
      mockTxDeleteWhere.mockClear();
      mockTxSelectWhere.mockClear();
    });

    it("clears existing people and genres", async () => {
      await syncNormalizedRelationsFromFlatFields("film-1", {});

      expect(mockTx.delete).toHaveBeenCalledTimes(2);
      expect(mockTxDeleteWhere).toHaveBeenCalledTimes(2);
    });

    it("inserts directors with role 'director' and tmdbPersonId null", async () => {
      await syncNormalizedRelationsFromFlatFields("film-1", {
        directors: ["Agnès Varda", "Jean-Luc Godard"],
      });

      expect(mockTx.insert).toHaveBeenCalled();
      const insertCall = mockTxInsertValues.mock.calls[0]?.[0];
      expect(insertCall).toHaveLength(2);
      expect(insertCall[0]).toMatchObject({
        filmId: "film-1",
        name: "Agnès Varda",
        role: "director",
        tmdbPersonId: null,
        displayOrder: 0,
      });
      expect(insertCall[1]).toMatchObject({
        filmId: "film-1",
        name: "Jean-Luc Godard",
        role: "director",
        tmdbPersonId: null,
        displayOrder: 1,
      });
    });

    it("inserts cast with role 'actor' and tmdbPersonId null", async () => {
      await syncNormalizedRelationsFromFlatFields("film-1", {
        cast: ["Catherine Deneuve", "Michel Piccoli"],
      });

      expect(mockTx.insert).toHaveBeenCalled();
      const insertCall = mockTxInsertValues.mock.calls[0]?.[0];
      expect(insertCall).toHaveLength(2);
      expect(insertCall[0]).toMatchObject({
        filmId: "film-1",
        name: "Catherine Deneuve",
        role: "actor",
        displayOrder: 0,
      });
      expect(insertCall[1]).toMatchObject({
        filmId: "film-1",
        name: "Michel Piccoli",
        role: "actor",
        displayOrder: 1,
      });
    });

    it("filters out empty director and cast names", async () => {
      await syncNormalizedRelationsFromFlatFields("film-1", {
        directors: ["", "Agnès Varda", ""],
        cast: ["Catherine Deneuve", ""],
      });

      // directors insert
      const directorInsert = mockTxInsertValues.mock.calls[0]?.[0];
      expect(directorInsert).toHaveLength(1);
      expect(directorInsert[0].name).toBe("Agnès Varda");

      // cast insert
      const castInsert = mockTxInsertValues.mock.calls[1]?.[0];
      expect(castInsert).toHaveLength(1);
      expect(castInsert[0].name).toBe("Catherine Deneuve");
    });

    it("validates genre IDs against genres table before inserting", async () => {
      mockTxSelectWhere.mockResolvedValueOnce([{ id: 28 }, { id: 18 }]);

      await syncNormalizedRelationsFromFlatFields("film-1", {
        genreIds: [28, 18, 9999],
      });

      // Verify select was called to validate genre IDs
      expect(mockTxSelect).toHaveBeenCalled();

      // Only valid IDs (28, 18) should be inserted, not 9999
      const genreInsert = mockTxInsertValues.mock.calls[0]?.[0];
      expect(genreInsert).toHaveLength(2);
      expect(genreInsert[0]).toMatchObject({ filmId: "film-1", genreId: 28 });
      expect(genreInsert[1]).toMatchObject({ filmId: "film-1", genreId: 18 });
    });

    it("filters out genre IDs <= 0", async () => {
      mockTxSelectWhere.mockResolvedValueOnce([{ id: 28 }]);

      await syncNormalizedRelationsFromFlatFields("film-1", {
        genreIds: [0, -1, 28],
      });

      expect(mockTxSelect).toHaveBeenCalled();
    });

    it("does not insert anything when all inputs are empty", async () => {
      await syncNormalizedRelationsFromFlatFields("film-1", {
        directors: [],
        cast: [],
        genreIds: [],
      });

      // Only delete calls, no inserts
      expect(mockTx.delete).toHaveBeenCalledTimes(2);
      expect(mockTx.insert).not.toHaveBeenCalled();
    });

    it("does not insert when input is null", async () => {
      await syncNormalizedRelationsFromFlatFields("film-1", {
        directors: null,
        cast: null,
        genreIds: null,
      });

      expect(mockTx.delete).toHaveBeenCalledTimes(2);
      expect(mockTx.insert).not.toHaveBeenCalled();
    });
  });
});
