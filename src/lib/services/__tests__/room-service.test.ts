import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdateReturning = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockFindMany }));
const mockUpdateSet = vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) }));
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      cinemas: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      rooms: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    select: vi.fn(() => ({ from: mockSelectFrom })),
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
  archiveRoomById,
  createRoomForCinema,
  getRoomById,
  listRoomsForCinema,
  updateRoomById,
} from "../room-service";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("room-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listRoomsForCinema", () => {
    it("returns rooms from DB query", async () => {
      const rooms = [{ id: "r1", name: "Salle 1" }];
      mockFindMany.mockResolvedValue(rooms);

      const result = await listRoomsForCinema("cinema-1");

      expect(result).toEqual(rooms);
    });
  });

  describe("getRoomById", () => {
    it("returns room when found", async () => {
      const room = { id: "r1", name: "Salle 1", capacity: 100 };
      mockFindFirst.mockResolvedValue(room);

      const result = await getRoomById("r1", "cinema-1");

      expect(result).toEqual({ room });
    });

    it("returns NOT_FOUND when room does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getRoomById("r1", "cinema-1");

      expect(result).toEqual({ error: "NOT_FOUND" });
    });
  });

  describe("createRoomForCinema", () => {
    it("returns INVALID_CAPACITY when capacity < 1", async () => {
      const result = await createRoomForCinema("cinema-1", { capacity: 0 });

      expect(result).toEqual({ error: "INVALID_CAPACITY" });
    });

    it("returns INVALID_CAPACITY when capacity is negative", async () => {
      const result = await createRoomForCinema("cinema-1", { capacity: -5 });

      expect(result).toEqual({ error: "INVALID_CAPACITY" });
    });

    it("returns CINEMA_NOT_FOUND when cinema does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await createRoomForCinema("cinema-1", { capacity: 100 });

      expect(result).toEqual({ error: "CINEMA_NOT_FOUND" });
    });

    it("auto-generates room name when not provided", async () => {
      mockFindFirst.mockResolvedValue({ id: "cinema-1" });
      mockFindMany.mockResolvedValue([{ id: "r1" }, { id: "r2" }]);
      const room = { id: "r3", name: "Salle 3", capacity: 50 };
      mockInsertReturning.mockResolvedValue([room]);

      const result = await createRoomForCinema("cinema-1", { capacity: 50 });

      expect(result).toEqual({ room });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ name: "Salle 3" }));
    });

    it("uses provided name when given", async () => {
      mockFindFirst.mockResolvedValue({ id: "cinema-1" });
      const room = { id: "r1", name: "VIP Room", capacity: 30 };
      mockInsertReturning.mockResolvedValue([room]);

      await createRoomForCinema("cinema-1", { name: "VIP Room", capacity: 30 });

      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ name: "VIP Room" }));
    });
  });

  describe("updateRoomById", () => {
    it("returns INVALID_CAPACITY when capacity is 0", async () => {
      const result = await updateRoomById("r1", "cinema-1", { capacity: 0 });

      expect(result).toEqual({ error: "INVALID_CAPACITY" });
    });

    it("returns NOT_FOUND when room does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await updateRoomById("r1", "cinema-1", { name: "New Name" });

      expect(result).toEqual({ error: "NOT_FOUND" });
    });

    it("updates room when found", async () => {
      const room = { id: "r1", name: "Salle 1", cinemaId: "cinema-1" };
      mockFindFirst.mockResolvedValue(room);
      const updated = { ...room, name: "New Name" };
      mockUpdateReturning.mockResolvedValue([updated]);

      const result = await updateRoomById("r1", "cinema-1", { name: "New Name" });

      expect(result).toEqual({ room: updated });
    });
  });

  describe("archiveRoomById", () => {
    it("returns NOT_FOUND when room does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await archiveRoomById("r1", "cinema-1");

      expect(result).toEqual({ error: "NOT_FOUND" });
    });

    it("returns LAST_ROOM when only one room remains", async () => {
      mockFindFirst.mockResolvedValue({ id: "r1", cinemaId: "cinema-1" });
      mockFindMany.mockResolvedValue([{ id: "r1" }]);

      const result = await archiveRoomById("r1", "cinema-1");

      expect(result).toEqual({ error: "LAST_ROOM" });
    });
  });
});
