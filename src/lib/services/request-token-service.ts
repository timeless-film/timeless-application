import { SignJWT, jwtVerify, errors } from "jose";

const TOKEN_EXPIRATION = "14d";

type VerifySuccess = { requestId: string; userId: string };
type VerifyError = { error: "TOKEN_EXPIRED" | "TOKEN_INVALID" };

export type VerifyTokenResult = VerifySuccess | VerifyError;

function getSecret(): Uint8Array {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Generate a signed JWT token for request validation (accept/reject from email).
 * Payload: { requestId, userId, action: "validate" }. Expires in 14 days.
 */
export async function generateValidationToken(requestId: string, userId: string): Promise<string> {
  const token = await new SignJWT({ requestId, userId, action: "validate" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRATION)
    .setIssuedAt()
    .sign(getSecret());

  return token;
}

/**
 * Verify and decode a validation token.
 * Returns { requestId, userId } on success, or { error } on failure.
 */
export async function verifyValidationToken(token: string): Promise<VerifyTokenResult> {
  try {
    const { payload } = await jwtVerify(token, getSecret());

    const requestId = payload.requestId;
    const userId = payload.userId;
    const action = payload.action;

    if (typeof requestId !== "string" || typeof userId !== "string" || action !== "validate") {
      return { error: "TOKEN_INVALID" };
    }

    return { requestId, userId };
  } catch (err: unknown) {
    if (err instanceof errors.JWTExpired) {
      return { error: "TOKEN_EXPIRED" };
    }
    return { error: "TOKEN_INVALID" };
  }
}
