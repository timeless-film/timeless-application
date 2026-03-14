import { describe, expect, it } from "vitest";

import { isValidTransition } from "../admin-delivery-service";

describe("isValidTransition", () => {
  it("allows pending → in_progress", () => {
    expect(isValidTransition("pending", "in_progress")).toBe(true);
  });

  it("allows pending → delivered", () => {
    expect(isValidTransition("pending", "delivered")).toBe(true);
  });

  it("allows in_progress → delivered", () => {
    expect(isValidTransition("in_progress", "delivered")).toBe(true);
  });

  it("allows in_progress → pending (rollback)", () => {
    expect(isValidTransition("in_progress", "pending")).toBe(true);
  });

  it("does not allow delivered → pending", () => {
    expect(isValidTransition("delivered", "pending")).toBe(false);
  });

  it("does not allow delivered → in_progress", () => {
    expect(isValidTransition("delivered", "in_progress")).toBe(false);
  });

  it("does not allow same-status transitions", () => {
    expect(isValidTransition("pending", "pending")).toBe(false);
    expect(isValidTransition("in_progress", "in_progress")).toBe(false);
    expect(isValidTransition("delivered", "delivered")).toBe(false);
  });
});
