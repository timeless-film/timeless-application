import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { COUNTRY_CODES } from "@/lib/countries";
import { STRIPE_CURRENCY_CODES } from "@/lib/currencies";
import { createFilm, listFilmsForAccountPaginated } from "@/lib/services/film-service";

import type { NextRequest } from "next/server";

const priceZoneSchema = z.object({
  countries: z
    .array(z.string().refine((c) => (COUNTRY_CODES as readonly string[]).includes(c)))
    .min(1),
  price: z.number().int().min(0),
  currency: z.string().refine((c) => (STRIPE_CURRENCY_CODES as readonly string[]).includes(c)),
});

const createFilmSchema = z.object({
  title: z.string().min(1),
  externalId: z.string().optional(),
  type: z.enum(["direct", "validation"]).default("direct"),
  status: z.enum(["active", "inactive"]).default("active"),
  prices: z.array(priceZoneSchema).min(1),
});

export async function GET(request: NextRequest) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 20;

  const result = await listFilmsForAccountPaginated(authResult.accountId, {
    page: safePage,
    limit: safeLimit,
  });

  return NextResponse.json({
    data: result.films,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: result.total,
    },
  });
}

export async function POST(request: NextRequest) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
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

  const parsed = createFilmSchema.safeParse(body);
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

  const result = await createFilm(authResult.accountId, parsed.data);

  if ("error" in result) {
    return NextResponse.json(
      { error: { code: result.error, message: "Failed to create film" } },
      { status: 400 }
    );
  }

  return NextResponse.json({ data: result.film }, { status: 201 });
}
