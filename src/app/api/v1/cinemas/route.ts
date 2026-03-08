import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { createCinemaWithDefaultRoom, listCinemasForAccount } from "@/lib/services/cinema-service";

import type { NextRequest } from "next/server";

const createCinemaSchema = z.object({
  name: z.string().min(1),
  country: z.string().min(2).max(2),
  city: z.string().min(1),
  address: z.string().optional(),
  postalCode: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const cinemas = await listCinemasForAccount(authResult.accountId);

  return NextResponse.json({ data: cinemas });
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

  const parsed = createCinemaSchema.safeParse(body);
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

  const result = await createCinemaWithDefaultRoom(authResult.accountId, parsed.data);

  if ("error" in result) {
    return NextResponse.json(
      { error: { code: result.error, message: "Failed to create cinema" } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: result.cinema }, { status: 201 });
}
