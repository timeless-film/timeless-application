import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stripe", () => ({
  stripe: {},
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    query: {},
  },
}));

import { formatAmountForDisplay } from "../wallet-service";

describe("formatAmountForDisplay", () => {
  it("converts cents to decimal string with 2 decimal places", () => {
    expect(formatAmountForDisplay(15000)).toBe("150.00");
  });

  it("handles zero", () => {
    expect(formatAmountForDisplay(0)).toBe("0.00");
  });

  it("handles small amounts", () => {
    expect(formatAmountForDisplay(1)).toBe("0.01");
    expect(formatAmountForDisplay(99)).toBe("0.99");
  });

  it("handles amounts with cents", () => {
    expect(formatAmountForDisplay(12345)).toBe("123.45");
  });

  it("handles large amounts", () => {
    expect(formatAmountForDisplay(1000000)).toBe("10000.00");
  });
});
