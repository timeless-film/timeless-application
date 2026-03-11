import { describe, expect, it } from "vitest";

import {
  extractLocale,
  getRequiredAccountType,
  isAccountOptionalPath,
  isPublicAuthPath,
  isUnprotectedApiPath,
  stripLocale,
} from "@/lib/auth/proxy-helpers";

describe("stripLocale", () => {
  it("strips /en prefix", () => {
    expect(stripLocale("/en/catalog")).toBe("/catalog");
  });

  it("strips /fr prefix", () => {
    expect(stripLocale("/fr/login")).toBe("/login");
  });

  it("leaves paths without locale unchanged", () => {
    expect(stripLocale("/api/auth")).toBe("/api/auth");
  });

  it("strips only the leading locale", () => {
    expect(stripLocale("/en/en/something")).toBe("/en/something");
  });

  it("handles root locale path", () => {
    expect(stripLocale("/en")).toBe("");
  });
});

describe("extractLocale", () => {
  it("extracts 'en' from /en/catalog", () => {
    expect(extractLocale("/en/catalog")).toBe("en");
  });

  it("extracts 'fr' from /fr/login", () => {
    expect(extractLocale("/fr/login")).toBe("fr");
  });

  it("returns default 'en' for unknown locale", () => {
    expect(extractLocale("/de/something")).toBe("en");
  });

  it("returns default 'en' for root path", () => {
    expect(extractLocale("/")).toBe("en");
  });

  it("returns default 'en' for empty path", () => {
    expect(extractLocale("")).toBe("en");
  });
});

describe("isPublicAuthPath", () => {
  it("returns true for root path /", () => {
    expect(isPublicAuthPath("/")).toBe(true);
  });

  it("returns false for /en (locale root — handled by isAccountOptionalPath)", () => {
    expect(isPublicAuthPath("/en")).toBe(false);
  });

  it("returns true for /en/login", () => {
    expect(isPublicAuthPath("/en/login")).toBe(true);
  });

  it("returns true for /fr/register", () => {
    expect(isPublicAuthPath("/fr/register")).toBe(true);
  });

  it("returns true for /en/forgot-password", () => {
    expect(isPublicAuthPath("/en/forgot-password")).toBe(true);
  });

  it("returns true for /en/reset-password", () => {
    expect(isPublicAuthPath("/en/reset-password")).toBe(true);
  });

  it("returns true for /en/request-action", () => {
    expect(isPublicAuthPath("/en/request-action")).toBe(true);
  });

  it("returns true for /fr/request-action with query params", () => {
    expect(isPublicAuthPath("/fr/request-action?token=abc&action=approve")).toBe(true);
  });

  it("returns false for /en/catalog", () => {
    expect(isPublicAuthPath("/en/catalog")).toBe(false);
  });

  it("returns false for /en/account/profile", () => {
    expect(isPublicAuthPath("/en/account/profile")).toBe(false);
  });
});

describe("isAccountOptionalPath", () => {
  it("returns true for /en (root locale)", () => {
    expect(isAccountOptionalPath("/en")).toBe(true);
  });

  it("returns true for /en/accounts", () => {
    expect(isAccountOptionalPath("/en/accounts")).toBe(true);
  });

  it("returns true for /en/no-account", () => {
    expect(isAccountOptionalPath("/en/no-account")).toBe(true);
  });

  it("returns true for /en/onboarding", () => {
    expect(isAccountOptionalPath("/en/onboarding")).toBe(true);
  });

  it("returns true for /en/accounts", () => {
    expect(isAccountOptionalPath("/en/accounts")).toBe(true);
  });

  it("returns true for /en/onboarding/step-2", () => {
    expect(isAccountOptionalPath("/en/onboarding/step-2")).toBe(true);
  });

  it("returns false for /en/catalog", () => {
    expect(isAccountOptionalPath("/en/catalog")).toBe(false);
  });

  it("returns false for /en/films", () => {
    expect(isAccountOptionalPath("/en/films")).toBe(false);
  });
});

describe("isUnprotectedApiPath", () => {
  it("returns true for /api/auth", () => {
    expect(isUnprotectedApiPath("/api/auth")).toBe(true);
  });

  it("returns true for /api/auth/session", () => {
    expect(isUnprotectedApiPath("/api/auth/session")).toBe(true);
  });

  it("returns true for /api/webhooks", () => {
    expect(isUnprotectedApiPath("/api/webhooks")).toBe(true);
  });

  it("returns true for /api/webhooks/stripe", () => {
    expect(isUnprotectedApiPath("/api/webhooks/stripe")).toBe(true);
  });

  it("returns false for /api/something-else", () => {
    expect(isUnprotectedApiPath("/api/something-else")).toBe(false);
  });

  it("returns true for /api/v1", () => {
    expect(isUnprotectedApiPath("/api/v1")).toBe(true);
  });

  it("returns true for /api/v1/cinemas", () => {
    expect(isUnprotectedApiPath("/api/v1/cinemas")).toBe(true);
  });

  it("returns true for /api/v1/cinemas/123/rooms", () => {
    expect(isUnprotectedApiPath("/api/v1/cinemas/123/rooms")).toBe(true);
  });
});

describe("getRequiredAccountType", () => {
  // Exhibitor paths
  it("returns 'exhibitor' for /en/catalog", () => {
    expect(getRequiredAccountType("/en/catalog")).toBe("exhibitor");
  });

  it("returns 'exhibitor' for /en/catalog/film-123", () => {
    expect(getRequiredAccountType("/en/catalog/film-123")).toBe("exhibitor");
  });

  it("returns 'exhibitor' for /en/cart", () => {
    expect(getRequiredAccountType("/en/cart")).toBe("exhibitor");
  });

  it("returns 'exhibitor' for /en/orders", () => {
    expect(getRequiredAccountType("/en/orders")).toBe("exhibitor");
  });

  it("returns 'exhibitor' for /en/requests", () => {
    expect(getRequiredAccountType("/en/requests")).toBe("exhibitor");
  });

  it("returns 'exhibitor' for /en/accept-invitation", () => {
    expect(getRequiredAccountType("/en/accept-invitation")).toBe("exhibitor");
  });

  it("returns null for /en/home (shared path)", () => {
    expect(getRequiredAccountType("/en/home")).toBeNull();
  });

  it("returns null for /en/home/sub-page (shared path)", () => {
    expect(getRequiredAccountType("/en/home/sub-page")).toBeNull();
  });

  // Rights holder paths
  it("returns 'rights_holder' for /en/films", () => {
    expect(getRequiredAccountType("/en/films")).toBe("rights_holder");
  });

  it("returns 'rights_holder' for /en/films/film-123", () => {
    expect(getRequiredAccountType("/en/films/film-123")).toBe("rights_holder");
  });

  it("returns 'rights_holder' for /en/validation-requests", () => {
    expect(getRequiredAccountType("/en/validation-requests")).toBe("rights_holder");
  });

  it("returns 'rights_holder' for /en/wallet", () => {
    expect(getRequiredAccountType("/en/wallet")).toBe("rights_holder");
  });

  // Admin paths
  it("returns 'admin' for /en/dashboard", () => {
    expect(getRequiredAccountType("/en/dashboard")).toBe("admin");
  });

  it("returns 'admin' for /en/exhibitors", () => {
    expect(getRequiredAccountType("/en/exhibitors")).toBe("admin");
  });

  it("returns 'admin' for /en/rights-holders", () => {
    expect(getRequiredAccountType("/en/rights-holders")).toBe("admin");
  });

  it("returns 'admin' for /en/deliveries", () => {
    expect(getRequiredAccountType("/en/deliveries")).toBe("admin");
  });

  it("returns 'admin' for /en/settings", () => {
    expect(getRequiredAccountType("/en/settings")).toBe("admin");
  });

  it("returns 'admin' for /en/logs", () => {
    expect(getRequiredAccountType("/en/logs")).toBe("admin");
  });

  // Shared paths
  it("returns null for /en/account/profile", () => {
    expect(getRequiredAccountType("/en/account/profile")).toBeNull();
  });

  it("returns null for /en/account/information", () => {
    expect(getRequiredAccountType("/en/account/information")).toBeNull();
  });

  // Without locale
  it("handles paths without locale prefix", () => {
    expect(getRequiredAccountType("/catalog")).toBe("exhibitor");
  });
});
