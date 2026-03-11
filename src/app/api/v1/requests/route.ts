import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { listRequestsForAccount } from "@/lib/services/booking-service";
import { createRequest } from "@/lib/services/request-service";

import type { NextRequest } from "next/server";

const createRequestSchema = z.object({
  filmId: z.string().uuid(),
  cinemaId: z.string().uuid(),
  roomId: z.string().uuid(),
  quantity: z.number().int().min(1).optional(), // Legacy field name
  screeningCount: z.number().int().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  note: z.string().optional(),
});

/**
 * GET /api/v1/requests
 * List requests for the authenticated exhibitor account.
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const statusParam = searchParams.get("status") as
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled"
    | "paid"
    | null;

  const result = await listRequestsForAccount({
    exhibitorAccountId: authResult.accountId,
    status: statusParam ?? undefined,
    page,
    limit,
  });

  return NextResponse.json(result);
}

/**
 * POST /api/v1/requests
 * Creates a new validation request
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Invalid request payload",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    // Support both 'quantity' (legacy) and 'screeningCount' (current)
    const screeningCount = parsed.data.screeningCount || parsed.data.quantity || 1;

    const result = await createRequest({
      exhibitorAccountId: authResult.accountId,
      filmId: parsed.data.filmId,
      cinemaId: parsed.data.cinemaId,
      roomId: parsed.data.roomId,
      screeningCount,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      note: parsed.data.note,
    });

    if (!result.success) {
      // Map service errors to HTTP status codes
      const statusMap: Record<string, number> = {
        FILM_NOT_FOUND: 404,
        INVALID_FILM_TYPE: 400,
        TERRITORY_NOT_AVAILABLE: 403,
        INVALID_CINEMA: 400,
        INVALID_ROOM: 400,
        INVALID_DATE_RANGE: 400,
        UNAUTHORIZED: 401,
      };

      const status = statusMap[result.error] || 400;

      return NextResponse.json(
        {
          error: {
            code: result.error,
            message: "Failed to create request",
          },
        },
        { status }
      );
    }

    return NextResponse.json({ data: { id: result.requestId } }, { status: 201 });
  } catch (error) {
    console.error("Error creating request:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Server error" } },
      { status: 500 }
    );
  }
}
