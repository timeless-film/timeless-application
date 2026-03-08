"use server";

import { getCurrentMembership } from "@/lib/auth/membership";
import {
  archiveCinemaById,
  createCinemaWithDefaultRoom,
  listCinemasForAccount,
  updateCinemaById,
} from "@/lib/services/cinema-service";
import { archiveRoomById, createRoomForCinema, updateRoomById } from "@/lib/services/room-service";

// ─── List ─────────────────────────────────────────────────────────────────────

export async function getCinemas() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  const cinemas = await listCinemasForAccount(ctx.accountId);
  return { cinemas, currentUserRole: ctx.role };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createCinema(input: {
  name: string;
  country: string;
  city: string;
  address?: string;
  postalCode?: string;
}) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  if (!input.name.trim() || !input.country.trim() || !input.city.trim()) {
    return { error: "INVALID_INPUT" as const };
  }

  const result = await createCinemaWithDefaultRoom(ctx.accountId, input);

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const, cinema: result.cinema };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateCinema(
  cinemaId: string,
  input: {
    name?: string;
    country?: string;
    city?: string;
    address?: string | null;
    postalCode?: string | null;
  }
) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const result = await updateCinemaById(cinemaId, ctx.accountId, input);

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const };
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function archiveCinema(cinemaId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const result = await archiveCinemaById(cinemaId, ctx.accountId);

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const };
}

// ─── Room Create ──────────────────────────────────────────────────────────────

type ProjectionType = "digital" | "film_35mm" | "film_70mm";

export async function createRoom(
  cinemaId: string,
  input: {
    name?: string;
    capacity: number;
    reference?: string;
    projectionType?: ProjectionType;
    hasDcpEquipment?: boolean;
    screenFormat?: string;
    soundSystem?: string;
  }
) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  if (input.capacity < 1) {
    return { error: "INVALID_CAPACITY" as const };
  }

  const result = await createRoomForCinema(cinemaId, input);

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const, room: result.room };
}

// ─── Room Update ──────────────────────────────────────────────────────────────

export async function updateRoom(
  roomId: string,
  cinemaId: string,
  input: {
    name?: string;
    capacity?: number;
    reference?: string | null;
    projectionType?: ProjectionType | null;
    hasDcpEquipment?: boolean;
    screenFormat?: string | null;
    soundSystem?: string | null;
  }
) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  if (input.capacity !== undefined && input.capacity < 1) {
    return { error: "INVALID_CAPACITY" as const };
  }

  const result = await updateRoomById(roomId, cinemaId, input);

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const };
}

// ─── Room Archive ─────────────────────────────────────────────────────────────

export async function archiveRoom(roomId: string, cinemaId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const result = await archiveRoomById(roomId, cinemaId);

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true as const };
}
