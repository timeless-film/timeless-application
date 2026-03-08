import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { verifyCinemaOwnership } from "@/lib/services/cinema-service";
import { createRoomForCinema, listRoomsForCinema } from "@/lib/services/room-service";

import type { NextRequest } from "next/server";

const createRoomSchema = z.object({
  name: z.string().optional(),
  capacity: z.number().int().min(1),
  reference: z.string().optional(),
  projectionType: z.enum(["digital", "film_35mm", "film_70mm"]).optional(),
  hasDcpEquipment: z.boolean().optional(),
  screenFormat: z.string().optional(),
  soundSystem: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ cinemaId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { cinemaId } = await params;
  const isOwner = await verifyCinemaOwnership(cinemaId, authResult.accountId);
  if (!isOwner) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Cinema not found" } },
      { status: 404 }
    );
  }

  const rooms = await listRoomsForCinema(cinemaId);

  return NextResponse.json({ data: rooms });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { cinemaId } = await params;
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

  const parsed = createRoomSchema.safeParse(body);
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

  const result = await createRoomForCinema(cinemaId, parsed.data);

  if ("error" in result) {
    const status = result.error === "CINEMA_NOT_FOUND" ? 404 : 400;
    return NextResponse.json(
      { error: { code: result.error, message: "Failed to create room" } },
      { status }
    );
  }

  return NextResponse.json({ data: result.room }, { status: 201 });
}
