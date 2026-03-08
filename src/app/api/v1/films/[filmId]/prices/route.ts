import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { COUNTRY_CODES } from "@/lib/countries";
import { STRIPE_CURRENCY_CODES } from "@/lib/currencies";
import { db } from "@/lib/db";
import { filmPrices, films } from "@/lib/db/schema";
import { verifyFilmOwnership } from "@/lib/services/film-service";

import type { NextRequest } from "next/server";

const priceZoneSchema = z.object({
  countries: z
    .array(z.string().refine((country) => (COUNTRY_CODES as readonly string[]).includes(country)))
    .min(1),
  price: z.number().int().min(1),
  currency: z
    .string()
    .refine((currency) =>
      (STRIPE_CURRENCY_CODES as readonly string[]).includes(currency.toUpperCase())
    ),
});

interface RouteParams {
  params: Promise<{ filmId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

  const prices = await db.query.filmPrices.findMany({
    where: eq(filmPrices.filmId, filmId),
    orderBy: (table, { desc }) => desc(table.createdAt),
  });

  return NextResponse.json({ data: prices });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

  const parsed = priceZoneSchema.safeParse(body);
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

  const normalizedCurrency = parsed.data.currency.toUpperCase();

  const otherZones = await db.query.filmPrices.findMany({
    where: eq(filmPrices.filmId, filmId),
    columns: { id: true, countries: true },
  });

  const usedCountries = new Set<string>();
  for (const zone of otherZones) {
    for (const country of zone.countries) {
      usedCountries.add(country);
    }
  }

  for (const country of parsed.data.countries) {
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

  const [createdZone] = await db
    .insert(filmPrices)
    .values({
      filmId,
      countries: parsed.data.countries,
      price: parsed.data.price,
      currency: normalizedCurrency,
    })
    .returning();

  if (!createdZone) {
    return NextResponse.json(
      { error: { code: "CREATION_FAILED", message: "Failed to create price zone" } },
      { status: 500 }
    );
  }

  const [updatedFilm] = await db
    .update(films)
    .set({ updatedAt: new Date() })
    .where(and(eq(films.id, filmId), eq(films.accountId, authResult.accountId)))
    .returning({ id: films.id });

  if (!updatedFilm) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Film not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: createdZone }, { status: 201 });
}
