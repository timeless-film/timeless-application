import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { COUNTRY_CODES } from "@/lib/countries";
import { STRIPE_CURRENCY_CODES } from "@/lib/currencies";
import { db } from "@/lib/db";
import { filmPrices, films } from "@/lib/db/schema";
import { verifyFilmOwnership } from "@/lib/services/film-service";

import type { NextRequest } from "next/server";

const updatePriceZoneSchema = z.object({
  countries: z
    .array(z.string().refine((country) => (COUNTRY_CODES as readonly string[]).includes(country)))
    .min(1)
    .optional(),
  price: z.number().int().min(1).optional(),
  currency: z
    .string()
    .refine((currency) =>
      (STRIPE_CURRENCY_CODES as readonly string[]).includes(currency.toUpperCase())
    )
    .optional(),
});

interface RouteParams {
  params: Promise<{ filmId: string; priceId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { filmId, priceId } = await params;
  const isOwner = await verifyFilmOwnership(filmId, authResult.accountId);
  if (!isOwner) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Film not found" } },
      { status: 404 }
    );
  }

  const existingZone = await db.query.filmPrices.findFirst({
    where: and(eq(filmPrices.id, priceId), eq(filmPrices.filmId, filmId)),
  });

  if (!existingZone) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Price zone not found" } },
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

  const parsed = updatePriceZoneSchema.safeParse(body);
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

  const updatedCountries = parsed.data.countries ?? existingZone.countries;

  const siblingZones = await db.query.filmPrices.findMany({
    where: and(eq(filmPrices.filmId, filmId), ne(filmPrices.id, priceId)),
    columns: { countries: true },
  });

  const usedCountries = new Set<string>();
  for (const zone of siblingZones) {
    for (const country of zone.countries) {
      usedCountries.add(country);
    }
  }

  for (const country of updatedCountries) {
    if (usedCountries.has(country)) {
      return NextResponse.json(
        {
          error: {
            code: "DUPLICATE_COUNTRY",
            message: `Country ${country} already exists in another zone`,
          },
        },
        { status: 409 }
      );
    }
  }

  const [updatedZone] = await db
    .update(filmPrices)
    .set({
      ...(parsed.data.countries ? { countries: parsed.data.countries } : {}),
      ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
      ...(parsed.data.currency ? { currency: parsed.data.currency.toUpperCase() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(filmPrices.id, priceId), eq(filmPrices.filmId, filmId)))
    .returning();

  if (!updatedZone) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Price zone not found" } },
      { status: 404 }
    );
  }

  await db
    .update(films)
    .set({ updatedAt: new Date() })
    .where(and(eq(films.id, filmId), eq(films.accountId, authResult.accountId)));

  return NextResponse.json({ data: updatedZone });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { filmId, priceId } = await params;
  const isOwner = await verifyFilmOwnership(filmId, authResult.accountId);
  if (!isOwner) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Film not found" } },
      { status: 404 }
    );
  }

  const currentZones = await db.query.filmPrices.findMany({
    where: eq(filmPrices.filmId, filmId),
    columns: { id: true },
  });

  if (currentZones.length <= 1) {
    return NextResponse.json(
      {
        error: {
          code: "LAST_PRICE_ZONE",
          message: "Cannot delete the last price zone",
        },
      },
      { status: 409 }
    );
  }

  const [deletedZone] = await db
    .delete(filmPrices)
    .where(and(eq(filmPrices.id, priceId), eq(filmPrices.filmId, filmId)))
    .returning();

  if (!deletedZone) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Price zone not found" } },
      { status: 404 }
    );
  }

  await db
    .update(films)
    .set({ updatedAt: new Date() })
    .where(and(eq(films.id, filmId), eq(films.accountId, authResult.accountId)));

  return NextResponse.json({ data: { deleted: true } });
}
