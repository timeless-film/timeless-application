import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { COUNTRY_CODES } from "@/lib/countries";
import { STRIPE_CURRENCY_CODES } from "@/lib/currencies";
import {
  archiveFilmById,
  getFilmById,
  updateFilmById,
  verifyFilmOwnership,
} from "@/lib/services/film-service";

import type { NextRequest } from "next/server";

const priceZoneSchema = z.object({
  countries: z
    .array(z.string().refine((c) => (COUNTRY_CODES as readonly string[]).includes(c)))
    .min(1),
  price: z.number().int().min(0),
  currency: z.string().refine((c) => (STRIPE_CURRENCY_CODES as readonly string[]).includes(c)),
});

const updateFilmSchema = z.object({
  title: z.string().min(1).optional(),
  externalId: z.string().nullable().optional(),
  type: z.enum(["direct", "validation"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  prices: z.array(priceZoneSchema).min(1).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filmId: string }> }
) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { filmId } = await params;

  const isOwner = await verifyFilmOwnership(filmId, authResult.accountId);
  if (!isOwner) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Film not found" } },
      { status: 404 }
    );
  }

  const result = await getFilmById(filmId, authResult.accountId);
  if ("error" in result) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Film not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: result.film });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ filmId: string }> }
) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { filmId } = await params;

  const isOwner = await verifyFilmOwnership(filmId, authResult.accountId);
  if (!isOwner) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Film not found" } },
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

  const parsed = updateFilmSchema.safeParse(body);
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

  const result = await updateFilmById(filmId, authResult.accountId, parsed.data);

  if ("error" in result) {
    return NextResponse.json(
      { error: { code: result.error, message: "Failed to update film" } },
      { status: 400 }
    );
  }

  return NextResponse.json({ data: result.film });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filmId: string }> }
) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { filmId } = await params;

  const result = await archiveFilmById(filmId, authResult.accountId);

  if ("error" in result) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Film not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: result.error, message: "Failed to archive film" } },
      { status: 400 }
    );
  }

  return NextResponse.json({ data: { archived: true } });
}
