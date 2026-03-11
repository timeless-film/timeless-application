// @vitest-environment node
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";

import { generateValidationToken, verifyValidationToken } from "../request-token-service";

const TEST_SECRET = "test-secret-for-validation-tokens-minimum-32-chars";

beforeAll(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", TEST_SECRET);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("request-token-service", () => {
  describe("generateValidationToken", () => {
    it("generates a valid JWT string", async () => {
      const token = await generateValidationToken("req-123", "user-456");
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });
  });

  describe("verifyValidationToken", () => {
    it("verifies and decodes a valid token", async () => {
      const token = await generateValidationToken("req-123", "user-456");
      const result = await verifyValidationToken(token);
      expect(result).toEqual({ requestId: "req-123", userId: "user-456" });
    });

    it("returns TOKEN_INVALID for a tampered token", async () => {
      const token = await generateValidationToken("req-123", "user-456");
      const tampered = token.slice(0, -5) + "XXXXX";
      const result = await verifyValidationToken(tampered);
      expect(result).toEqual({ error: "TOKEN_INVALID" });
    });

    it("returns TOKEN_INVALID for a completely invalid string", async () => {
      const result = await verifyValidationToken("not-a-jwt");
      expect(result).toEqual({ error: "TOKEN_INVALID" });
    });

    it("returns TOKEN_EXPIRED for an expired token", async () => {
      // Create a token that expires immediately by using jose directly
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);
      const expiredToken = await new SignJWT({
        requestId: "req-123",
        userId: "user-456",
        action: "validate",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("0s")
        .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
        .sign(secret);

      // Small delay to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = await verifyValidationToken(expiredToken);
      expect(result).toEqual({ error: "TOKEN_EXPIRED" });
    });

    it("returns TOKEN_INVALID for a token with wrong signature", async () => {
      const { SignJWT } = await import("jose");
      const wrongSecret = new TextEncoder().encode("wrong-secret-that-is-definitely-different");
      const token = await new SignJWT({
        requestId: "req-123",
        userId: "user-456",
        action: "validate",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("14d")
        .setIssuedAt()
        .sign(wrongSecret);

      const result = await verifyValidationToken(token);
      expect(result).toEqual({ error: "TOKEN_INVALID" });
    });

    it("returns TOKEN_INVALID for a token with missing payload fields", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);
      const token = await new SignJWT({ requestId: "req-123" })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("14d")
        .setIssuedAt()
        .sign(secret);

      const result = await verifyValidationToken(token);
      expect(result).toEqual({ error: "TOKEN_INVALID" });
    });

    it("returns TOKEN_INVALID for a token with wrong action", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);
      const token = await new SignJWT({
        requestId: "req-123",
        userId: "user-456",
        action: "other",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("14d")
        .setIssuedAt()
        .sign(secret);

      const result = await verifyValidationToken(token);
      expect(result).toEqual({ error: "TOKEN_INVALID" });
    });
  });
});
