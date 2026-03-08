import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockDeleteWhere = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

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
  setFilmStatus,
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
});
