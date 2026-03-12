import { describe, expect, it } from "vitest";

import { escapeCsvField } from "../csv";

describe("escapeCsvField", () => {
  it("returns plain text as-is", () => {
    expect(escapeCsvField("Hello")).toBe("Hello");
  });

  it("wraps value in double quotes if it contains a comma", () => {
    expect(escapeCsvField("Le Rex, Paris")).toBe('"Le Rex, Paris"');
  });

  it("wraps and escapes double quotes inside the value", () => {
    expect(escapeCsvField('He said "hello"')).toBe('"He said ""hello"""');
  });

  it("wraps value if it contains a newline", () => {
    expect(escapeCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
  });

  it("handles empty string", () => {
    expect(escapeCsvField("")).toBe("");
  });

  it("handles value with both commas and quotes", () => {
    expect(escapeCsvField('"A", "B"')).toBe('"""A"", ""B"""');
  });
});
