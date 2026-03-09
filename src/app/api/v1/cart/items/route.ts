import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { addToCart } from "@/lib/services/cart-service";

import type { NextRequest } from "next/server";

const addToCartSchema = z.object({
  filmId: z.string().uuid(),
  cinemaId: z.string().uuid(),
  roomId: z.string().uuid(),
  quantity: z.number().int().min(1).optional(), // Legacy field name
  screeningCount: z.number().int().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * POST /api/v1/cart/items
 * Adds an item to the cart
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
    const parsed = addToCartSchema.safeParse(body);

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

    const result = await addToCart({
      exhibitorAccountId: authResult.accountId,
      filmId: parsed.data.filmId,
      cinemaId: parsed.data.cinemaId,
      roomId: parsed.data.roomId,
      screeningCount,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    });

    if (!result.success) {
      // Map service errors to HTTP status codes
      const statusMap: Record<string, number> = {
        CART_ITEM_NOT_FOUND: 404,
        UNAUTHORIZED: 401,
        FILM_NOT_AVAILABLE: 404,
        INVALID_FILM_TYPE: 400,
        TERRITORY_NOT_AVAILABLE: 403,
        INVALID_CINEMA: 400,
        INVALID_ROOM: 400,
        INVALID_DATE_RANGE: 400,
      };

      const status = statusMap[result.error] || 400;

      return NextResponse.json(
        {
          error: {
            code: result.error,
            message: "Failed to add item to cart",
          },
        },
        { status }
      );
    }

    return NextResponse.json({ data: { success: true } }, { status: 201 });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Server error" } },
      { status: 500 }
    );
  }
}
