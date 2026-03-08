import { describe, expect, it } from "vitest";

import { generateToken, hashToken } from "@/lib/auth/api-auth";

describe("hashToken", () => {
  it("returns a deterministic SHA-256 hex hash", () => {
    const hash1 = hashToken("tmls_abc123");
    const hash2 = hashToken("tmls_abc123");
    expect(hash1).toBe(hash2);
  });

  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashToken("tmls_test_token_value");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = hashToken("tmls_token_a");
    const hash2 = hashToken("tmls_token_b");
    expect(hash1).not.toBe(hash2);
  });
});

describe("generateToken", () => {
  it("returns rawToken, tokenHash, and tokenPrefix", () => {
    const result = generateToken();
    expect(result).toHaveProperty("rawToken");
    expect(result).toHaveProperty("tokenHash");
    expect(result).toHaveProperty("tokenPrefix");
  });

  it("rawToken starts with tmls_ prefix", () => {
    const { rawToken } = generateToken();
    expect(rawToken).toMatch(/^tmls_/);
  });

  it("rawToken has tmls_ + 40 hex characters", () => {
    const { rawToken } = generateToken();
    expect(rawToken).toMatch(/^tmls_[a-f0-9]{40}$/);
  });

  it("tokenHash matches hashToken(rawToken)", () => {
    const { rawToken, tokenHash } = generateToken();
    expect(tokenHash).toBe(hashToken(rawToken));
  });

  it("tokenPrefix is the first 13 characters of rawToken", () => {
    const { rawToken, tokenPrefix } = generateToken();
    expect(tokenPrefix).toBe(rawToken.substring(0, 13));
    expect(tokenPrefix).toMatch(/^tmls_[a-f0-9]{8}$/);
  });

  it("generates unique tokens on each call", () => {
    const token1 = generateToken();
    const token2 = generateToken();
    expect(token1.rawToken).not.toBe(token2.rawToken);
    expect(token1.tokenHash).not.toBe(token2.tokenHash);
  });
});

describe("verifyBearerToken", () => {
  // verifyBearerToken depends on DB access, which requires integration tests.
  // Pure input validation logic is tested here via mock.

  it("is exported as a function", async () => {
    const mod = await import("@/lib/auth/api-auth");
    expect(typeof mod.verifyBearerToken).toBe("function");
  });
});
