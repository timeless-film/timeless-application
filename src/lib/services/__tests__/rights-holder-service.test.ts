import { describe, expect, it } from "vitest";

import { isStripeConnectComplete } from "@/lib/services/rights-holder-service";

describe("isStripeConnectComplete", () => {
  it("returns true when both details_submitted and charges_enabled are true", () => {
    expect(isStripeConnectComplete({ details_submitted: true, charges_enabled: true })).toBe(true);
  });

  it("returns false when details_submitted is true but charges_enabled is false", () => {
    expect(isStripeConnectComplete({ details_submitted: true, charges_enabled: false })).toBe(
      false
    );
  });

  it("returns false when both are false", () => {
    expect(isStripeConnectComplete({ details_submitted: false, charges_enabled: false })).toBe(
      false
    );
  });

  it("returns false when details_submitted is false and charges_enabled is true", () => {
    expect(isStripeConnectComplete({ details_submitted: false, charges_enabled: true })).toBe(
      false
    );
  });
});
