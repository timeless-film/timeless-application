import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { cinemas, rooms } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateCinemaInput {
  name: string;
  country: string;
  city: string;
  address?: string;
  postalCode?: string;
}

interface UpdateCinemaInput {
  name?: string;
  country?: string;
  city?: string;
  address?: string | null;
  postalCode?: string | null;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listCinemasForAccount(accountId: string) {
  return db.query.cinemas.findMany({
    where: and(eq(cinemas.accountId, accountId), isNull(cinemas.archivedAt)),
    with: {
      rooms: {
        where: isNull(rooms.archivedAt),
        orderBy: (r, { asc }) => asc(r.createdAt),
      },
    },
    orderBy: (c, { asc }) => asc(c.createdAt),
  });
}

// ─── Verify ownership ─────────────────────────────────────────────────────────

export async function verifyCinemaOwnership(cinemaId: string, accountId: string) {
  const cinema = await db.query.cinemas.findFirst({
    where: and(
      eq(cinemas.id, cinemaId),
      eq(cinemas.accountId, accountId),
      isNull(cinemas.archivedAt)
    ),
  });
  return !!cinema;
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getCinemaById(cinemaId: string, accountId: string) {
  const cinema = await db.query.cinemas.findFirst({
    where: and(
      eq(cinemas.id, cinemaId),
      eq(cinemas.accountId, accountId),
      isNull(cinemas.archivedAt)
    ),
    with: {
      rooms: {
        where: isNull(rooms.archivedAt),
        orderBy: (r, { asc }) => asc(r.createdAt),
      },
    },
  });

  if (!cinema) {
    return { error: "NOT_FOUND" as const };
  }

  return { cinema };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createCinemaWithDefaultRoom(accountId: string, input: CreateCinemaInput) {
  const [cinema] = await db
    .insert(cinemas)
    .values({
      accountId,
      name: input.name.trim(),
      country: input.country,
      city: input.city.trim(),
      address: input.address?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
    })
    .returning();

  if (!cinema) {
    return { error: "CREATION_FAILED" as const };
  }

  const [room] = await db
    .insert(rooms)
    .values({
      cinemaId: cinema.id,
      name: "Salle 1",
      capacity: 100,
    })
    .returning();

  return { cinema, room };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateCinemaById(
  cinemaId: string,
  accountId: string,
  input: UpdateCinemaInput
) {
  const cinema = await db.query.cinemas.findFirst({
    where: and(
      eq(cinemas.id, cinemaId),
      eq(cinemas.accountId, accountId),
      isNull(cinemas.archivedAt)
    ),
  });

  if (!cinema) {
    return { error: "NOT_FOUND" as const };
  }

  const [updated] = await db
    .update(cinemas)
    .set({
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.country !== undefined && { country: input.country }),
      ...(input.city !== undefined && { city: input.city.trim() }),
      ...(input.address !== undefined && { address: input.address?.trim() || null }),
      ...(input.postalCode !== undefined && { postalCode: input.postalCode?.trim() || null }),
      updatedAt: new Date(),
    })
    .where(eq(cinemas.id, cinemaId))
    .returning();

  return { cinema: updated };
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function archiveCinemaById(cinemaId: string, accountId: string) {
  const cinema = await db.query.cinemas.findFirst({
    where: and(
      eq(cinemas.id, cinemaId),
      eq(cinemas.accountId, accountId),
      isNull(cinemas.archivedAt)
    ),
  });

  if (!cinema) {
    return { error: "NOT_FOUND" as const };
  }

  // Cannot archive the last cinema
  const activeCinemaCount = await db
    .select({ id: cinemas.id })
    .from(cinemas)
    .where(and(eq(cinemas.accountId, accountId), isNull(cinemas.archivedAt)));

  if (activeCinemaCount.length <= 1) {
    return { error: "LAST_CINEMA" as const };
  }

  const archivedAt = new Date();
  await db
    .update(cinemas)
    .set({ archivedAt, updatedAt: archivedAt })
    .where(eq(cinemas.id, cinemaId));

  return { data: { id: cinemaId, archivedAt } };
}
