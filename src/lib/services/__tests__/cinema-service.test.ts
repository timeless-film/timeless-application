import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdateReturning = vi.fn();
const mockUpdateSet = vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) }));
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      cinemas: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
      rooms: { findMany: vi.fn() },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: mockFindMany })) })),
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  isNull: (a: unknown) => a,
}));

vi.mock("@/lib/db/schema", () => ({
  cinemas: { id: "cinemas.id", accountId: "cinemas.accountId", archivedAt: "cinemas.archivedAt" },
  rooms: { id: "rooms.id", cinemaId: "rooms.cinemaId", archivedAt: "rooms.archivedAt" },
}));

// Import after mocks
import {
  archiveCinemaById,
  createCinemaWithDefaultRoom,
  getCinemaById,
  listCinemasForAccount,
  updateCinemaById,
  verifyCinemaOwnership,
} from "../cinema-service";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("cinema-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listCinemasForAccount", () => {
    it("returns cinemas from DB query", async () => {
      const cinemas = [
        { id: "c1", name: "Cinema 1", rooms: [] },
        { id: "c2", name: "Cinema 2", rooms: [{ id: "r1" }] },
      ];
      mockFindMany.mockResolvedValue(cinemas);

      const result = await listCinemasForAccount("account-1");

      expect(result).toEqual(cinemas);
      expect(mockFindMany).toHaveBeenCalled();
    });

    it("returns empty array when no cinemas", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await listCinemasForAccount("account-1");

      expect(result).toEqual([]);
    });
  });

  describe("getCinemaById", () => {
    it("returns cinema with rooms when found", async () => {
      const cinema = { id: "c1", name: "Le Rex", rooms: [{ id: "r1" }] };
      mockFindFirst.mockResolvedValue(cinema);

      const result = await getCinemaById("c1", "account-1");

      expect(result).toEqual({ cinema });
    });

    it("returns NOT_FOUND when cinema does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getCinemaById("c1", "account-1");

      expect(result).toEqual({ error: "NOT_FOUND" });
    });
  });

  describe("verifyCinemaOwnership", () => {
    it("returns true when cinema belongs to account", async () => {
      mockFindFirst.mockResolvedValue({ id: "c1", accountId: "account-1" });

      const result = await verifyCinemaOwnership("c1", "account-1");

      expect(result).toBe(true);
    });

    it("returns false when cinema does not belong to account", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await verifyCinemaOwnership("c1", "account-1");

      expect(result).toBe(false);
    });
  });

  describe("createCinemaWithDefaultRoom", () => {
    it("creates cinema and default room", async () => {
      const cinema = { id: "c1", name: "Le Rex", country: "FR", city: "Paris" };
      const room = { id: "r1", name: "Salle 1", capacity: 100 };
      mockInsertReturning.mockResolvedValueOnce([cinema]).mockResolvedValueOnce([room]);

      const result = await createCinemaWithDefaultRoom("account-1", {
        name: "Le Rex",
        country: "FR",
        city: "Paris",
      });

      expect(result).toEqual({ cinema, room });
    });

    it("returns error when cinema creation fails", async () => {
      mockInsertReturning.mockResolvedValueOnce([]);

      const result = await createCinemaWithDefaultRoom("account-1", {
        name: "Le Rex",
        country: "FR",
        city: "Paris",
      });

      expect(result).toEqual({ error: "CREATION_FAILED" });
    });

    it("trims input strings", async () => {
      const cinema = { id: "c1", name: "Le Rex", country: "FR", city: "Paris" };
      const room = { id: "r1", name: "Salle 1", capacity: 100 };
      mockInsertReturning.mockResolvedValueOnce([cinema]).mockResolvedValueOnce([room]);

      await createCinemaWithDefaultRoom("account-1", {
        name: "  Le Rex  ",
        country: "FR",
        city: "  Paris  ",
        address: "  123 Rue  ",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Le Rex",
          city: "Paris",
          address: "123 Rue",
        })
      );
    });
  });

  describe("updateCinemaById", () => {
    it("returns NOT_FOUND when cinema does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await updateCinemaById("c1", "account-1", { name: "New Name" });

      expect(result).toEqual({ error: "NOT_FOUND" });
    });

    it("updates cinema when found", async () => {
      const cinema = { id: "c1", name: "Old Name", accountId: "account-1" };
      mockFindFirst.mockResolvedValue(cinema);
      const updated = { ...cinema, name: "New Name" };
      mockUpdateReturning.mockResolvedValue([updated]);

      const result = await updateCinemaById("c1", "account-1", { name: "New Name" });

      expect(result).toEqual({ cinema: updated });
    });
  });

  describe("archiveCinemaById", () => {
    it("returns NOT_FOUND when cinema does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await archiveCinemaById("c1", "account-1");

      expect(result).toEqual({ error: "NOT_FOUND" });
    });

    it("returns LAST_CINEMA when only one cinema remains", async () => {
      mockFindFirst.mockResolvedValue({ id: "c1", accountId: "account-1" });
      mockFindMany.mockResolvedValue([{ id: "c1" }]);

      const result = await archiveCinemaById("c1", "account-1");

      expect(result).toEqual({ error: "LAST_CINEMA" });
    });
  });
});
