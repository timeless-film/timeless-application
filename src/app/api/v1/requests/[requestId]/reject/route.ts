import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { sendExhibitorRequestNotification } from "@/lib/services/booking-service";
import { transitionRequestStatus } from "@/lib/services/request-service";

import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{ requestId: string }>;
}

const rejectSchema = z.object({
  reason: z.string().max(1000).optional(),
});

/**
 * POST /api/v1/requests/:requestId/reject
 * Reject a pending request (rights holder action).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { requestId } = await params;
  const idResult = z.string().uuid().safeParse(requestId);
  if (!idResult.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Invalid request ID" } },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Invalid request body" } },
        { status: 400 }
      );
    }

    const result = await transitionRequestStatus({
      requestId: idResult.data,
      fromStatus: "pending",
      toStatus: "rejected",
      rightsHolderAccountId: authResult.accountId,
      reason: parsed.data.reason,
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        REQUEST_NOT_FOUND: 404,
        INVALID_TRANSITION: 409,
        UNAUTHORIZED: 403,
      };
      return NextResponse.json(
        { error: { code: result.error, message: `Cannot reject request: ${result.error}` } },
        { status: statusMap[result.error] ?? 400 }
      );
    }

    // Send notification emails to exhibitor (fire-and-forget)
    sendExhibitorRequestNotification({
      requestId: idResult.data,
      action: "reject",
      note: parsed.data.reason,
    }).catch((err) => {
      console.error("Failed to send rejection notification:", err);
    });

    return NextResponse.json({ data: { id: requestId, status: "rejected" } });
  } catch (error) {
    console.error("Error rejecting request:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Server error" } },
      { status: 500 }
    );
  }
}
