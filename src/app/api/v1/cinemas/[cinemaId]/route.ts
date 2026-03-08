import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { archiveCinemaById, getCinemaById, updateCinemaById } from "@/lib/services/cinema-service";

import type { NextRequest } from "next/server";

const updateCinemaSchema = z.object({
  name: z.string().min(1).optional(),
  country: z.string().min(2).max(2).optional(),
  city: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
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
  const result = await getCinemaById(cinemaId, authResult.accountId);

  if ("error" in result) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Cinema not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: result.cinema });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { cinemaId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = updateCinemaSchema.safeParse(body);
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

  const result = await updateCinemaById(cinemaId, authResult.accountId, parsed.data);

  if ("error" in result) {
    return NextResponse.json(
      { error: { code: result.error, message: "Cinema not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: result.cinema });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { cinemaId } = await params;
  const result = await archiveCinemaById(cinemaId, authResult.accountId);

  if ("error" in result) {
    const errorCode = result.error;
    const status = errorCode === "NOT_FOUND" ? 404 : errorCode === "LAST_CINEMA" ? 409 : 500;
    const message =
      errorCode === "LAST_CINEMA" ? "Cannot archive the last cinema" : "Cinema not found";
    return NextResponse.json({ error: { code: errorCode, message } }, { status });
  }

  return NextResponse.json({ data: result.data });
}
