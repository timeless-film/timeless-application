import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { verifyCinemaOwnership } from "@/lib/services/cinema-service";
import { archiveRoomById, getRoomById, updateRoomById } from "@/lib/services/room-service";

import type { NextRequest } from "next/server";

const updateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().int().min(1).optional(),
  reference: z.string().nullable().optional(),
  projectionType: z.enum(["digital", "film_35mm", "film_70mm"]).nullable().optional(),
  hasDcpEquipment: z.boolean().optional(),
  screenFormat: z.string().nullable().optional(),
  soundSystem: z.string().nullable().optional(),
});

interface RouteParams {
  params: Promise<{ cinemaId: string; roomId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { cinemaId, roomId } = await params;
  const isOwner = await verifyCinemaOwnership(cinemaId, authResult.accountId);
  if (!isOwner) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Cinema not found" } },
      { status: 404 }
    );
  }

  const result = await getRoomById(roomId, cinemaId);
  if ("error" in result) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Room not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: result.room });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { cinemaId, roomId } = await params;
  const isOwner = await verifyCinemaOwnership(cinemaId, authResult.accountId);
  if (!isOwner) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Cinema not found" } },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = updateRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  const result = await updateRoomById(roomId, cinemaId, parsed.data);
  if ("error" in result) {
    const status = result.error === "INVALID_CAPACITY" ? 400 : 404;
    return NextResponse.json(
      {
        error: {
          code: result.error,
          message:
            result.error === "INVALID_CAPACITY" ? "Capacity must be at least 1" : "Room not found",
        },
      },
      { status }
    );
  }

  return NextResponse.json({ data: result.room });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { cinemaId, roomId } = await params;
  const isOwner = await verifyCinemaOwnership(cinemaId, authResult.accountId);
  if (!isOwner) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Cinema not found" } },
      { status: 404 }
    );
  }

  const result = await archiveRoomById(roomId, cinemaId);
  if ("error" in result) {
    const status = result.error === "NOT_FOUND" ? 404 : result.error === "LAST_ROOM" ? 409 : 500;
    const message =
      result.error === "LAST_ROOM" ? "Cannot archive the last room" : "Room not found";
    return NextResponse.json({ error: { code: result.error, message } }, { status });
  }

  return NextResponse.json({ data: result.data });
}
