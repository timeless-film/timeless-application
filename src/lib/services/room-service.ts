import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { cinemas, rooms } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectionType = "digital" | "film_35mm" | "film_70mm";

interface CreateRoomInput {
  name?: string;
  capacity: number;
  reference?: string;
  projectionType?: ProjectionType;
  hasDcpEquipment?: boolean;
  screenFormat?: string;
  soundSystem?: string;
}

interface UpdateRoomInput {
  name?: string;
  capacity?: number;
  reference?: string | null;
  projectionType?: ProjectionType | null;
  hasDcpEquipment?: boolean;
  screenFormat?: string | null;
  soundSystem?: string | null;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listRoomsForCinema(cinemaId: string) {
  return db.query.rooms.findMany({
    where: and(eq(rooms.cinemaId, cinemaId), isNull(rooms.archivedAt)),
    orderBy: (r, { asc }) => asc(r.createdAt),
  });
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getRoomById(roomId: string, cinemaId: string) {
  const room = await db.query.rooms.findFirst({
    where: and(eq(rooms.id, roomId), eq(rooms.cinemaId, cinemaId), isNull(rooms.archivedAt)),
  });

  if (!room) {
    return { error: "NOT_FOUND" as const };
  }

  return { room };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createRoomForCinema(cinemaId: string, input: CreateRoomInput) {
  if (input.capacity < 1) {
    return { error: "INVALID_CAPACITY" as const };
  }

  // Verify cinema exists
  const cinema = await db.query.cinemas.findFirst({
    where: and(eq(cinemas.id, cinemaId), isNull(cinemas.archivedAt)),
  });

  if (!cinema) {
    return { error: "CINEMA_NOT_FOUND" as const };
  }

  // Auto-generate name if not provided: count ALL rooms (including archived) for unique naming
  let roomName = input.name?.trim();
  if (!roomName) {
    const allRooms = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.cinemaId, cinemaId));
    roomName = `Salle ${allRooms.length + 1}`;
  }

  const [room] = await db
    .insert(rooms)
    .values({
      cinemaId,
      name: roomName,
      capacity: input.capacity,
      reference: input.reference?.trim() || null,
      projectionType: input.projectionType || null,
      hasDcpEquipment: input.hasDcpEquipment ?? false,
      screenFormat: input.screenFormat?.trim() || null,
      soundSystem: input.soundSystem?.trim() || null,
    })
    .returning();

  return { room };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateRoomById(roomId: string, cinemaId: string, input: UpdateRoomInput) {
  if (input.capacity !== undefined && input.capacity < 1) {
    return { error: "INVALID_CAPACITY" as const };
  }

  const room = await db.query.rooms.findFirst({
    where: and(eq(rooms.id, roomId), eq(rooms.cinemaId, cinemaId), isNull(rooms.archivedAt)),
  });

  if (!room) {
    return { error: "NOT_FOUND" as const };
  }

  const [updated] = await db
    .update(rooms)
    .set({
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.capacity !== undefined && { capacity: input.capacity }),
      ...(input.reference !== undefined && { reference: input.reference?.trim() || null }),
      ...(input.projectionType !== undefined && { projectionType: input.projectionType || null }),
      ...(input.hasDcpEquipment !== undefined && { hasDcpEquipment: input.hasDcpEquipment }),
      ...(input.screenFormat !== undefined && { screenFormat: input.screenFormat?.trim() || null }),
      ...(input.soundSystem !== undefined && { soundSystem: input.soundSystem?.trim() || null }),
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, roomId))
    .returning();

  return { room: updated };
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function archiveRoomById(roomId: string, cinemaId: string) {
  const room = await db.query.rooms.findFirst({
    where: and(eq(rooms.id, roomId), eq(rooms.cinemaId, cinemaId), isNull(rooms.archivedAt)),
  });

  if (!room) {
    return { error: "NOT_FOUND" as const };
  }

  // Cannot archive the last room of a cinema
  const activeRoomCount = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.cinemaId, cinemaId), isNull(rooms.archivedAt)));

  if (activeRoomCount.length <= 1) {
    return { error: "LAST_ROOM" as const };
  }

  const archivedAt = new Date();
  await db.update(rooms).set({ archivedAt, updatedAt: archivedAt }).where(eq(rooms.id, roomId));

  return { data: { id: roomId, archivedAt } };
}
