import { describe, expect, it } from "vitest";

import {
  encodeActiveAccountCookie,
  getHomePathForType,
  parseActiveAccountCookie,
} from "@/lib/auth/active-account-cookie";

describe("parseActiveAccountCookie", () => {
  it("parses a valid exhibitor cookie", () => {
    const result = parseActiveAccountCookie("abc-123:exhibitor");
    expect(result).toEqual({ accountId: "abc-123", type: "exhibitor" });
  });

  it("parses a valid rights_holder cookie", () => {
    const result = parseActiveAccountCookie("uuid-456:rights_holder");
    expect(result).toEqual({ accountId: "uuid-456", type: "rights_holder" });
  });

  it("parses a valid admin cookie", () => {
    const result = parseActiveAccountCookie("admin-789:admin");
    expect(result).toEqual({ accountId: "admin-789", type: "admin" });
  });

  it("handles UUID-style account IDs with colons inside the ID", () => {
    // lastIndexOf ensures only the LAST colon is used as separator
    const result = parseActiveAccountCookie("a1b2c3d4-e5f6-7890-abcd-ef1234567890:exhibitor");
    expect(result).toEqual({
      accountId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      type: "exhibitor",
    });
  });

  it("returns null for empty string", () => {
    expect(parseActiveAccountCookie("")).toBeNull();
  });

  it("returns null for string without separator", () => {
    expect(parseActiveAccountCookie("nocolonshere")).toBeNull();
  });

  it("returns null for invalid account type", () => {
    expect(parseActiveAccountCookie("abc-123:viewer")).toBeNull();
  });

  it("returns null for empty account ID", () => {
    expect(parseActiveAccountCookie(":exhibitor")).toBeNull();
  });

  it("returns null for empty type", () => {
    expect(parseActiveAccountCookie("abc-123:")).toBeNull();
  });
});

describe("encodeActiveAccountCookie", () => {
  it("encodes an exhibitor cookie", () => {
    expect(encodeActiveAccountCookie("abc-123", "exhibitor")).toBe("abc-123:exhibitor");
  });

  it("encodes a rights_holder cookie", () => {
    expect(encodeActiveAccountCookie("uuid-456", "rights_holder")).toBe("uuid-456:rights_holder");
  });

  it("encodes an admin cookie", () => {
    expect(encodeActiveAccountCookie("admin-789", "admin")).toBe("admin-789:admin");
  });

  it("roundtrips with parseActiveAccountCookie", () => {
    const accountId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const type = "rights_holder" as const;
    const encoded = encodeActiveAccountCookie(accountId, type);
    const parsed = parseActiveAccountCookie(encoded);
    expect(parsed).toEqual({ accountId, type });
  });
});

describe("getHomePathForType", () => {
  it("returns /home for exhibitor", () => {
    expect(getHomePathForType("exhibitor")).toBe("/home");
  });

  it("returns /home for rights_holder", () => {
    expect(getHomePathForType("rights_holder")).toBe("/home");
  });

  it("returns /admin/dashboard for admin", () => {
    expect(getHomePathForType("admin")).toBe("/admin/dashboard");
  });
});
