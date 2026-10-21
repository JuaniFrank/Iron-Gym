// Locale-safe numeric input parsing (ironlog-workout-input-fixes T1).

import { describe, expect, it } from "vitest";

import {
  clampNumber,
  parseDecimal,
  parseNonNegativeDecimal,
  parseNonNegativeWhole,
  parseWholeNumber,
} from "@/utils/parseNumber";

describe("parseDecimal", () => {
  it("parses dot decimals", () => {
    expect(parseDecimal("22.5")).toBe(22.5);
  });

  it("treats a comma as the decimal separator (es-AR keyboards)", () => {
    expect(parseDecimal("22,5")).toBe(22.5);
    expect(parseDecimal("0,25")).toBe(0.25);
  });

  it("trims whitespace and accepts a trailing separator", () => {
    expect(parseDecimal("  62,5 ")).toBe(62.5);
    expect(parseDecimal("22.")).toBe(22);
    expect(parseDecimal("22,")).toBe(22);
  });

  it("returns null for blank or non-numeric text", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("   ")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal(".")).toBeNull();
    expect(parseDecimal(",")).toBeNull();
    expect(parseDecimal("-")).toBeNull();
  });

  it("returns null for non-finite results", () => {
    expect(parseDecimal("1e999")).toBeNull();
    expect(parseDecimal("NaN")).toBeNull();
  });
});

describe("parseWholeNumber", () => {
  it("parses integers and truncates a fractional part", () => {
    expect(parseWholeNumber("8")).toBe(8);
    expect(parseWholeNumber("7.9")).toBe(7);
    expect(parseWholeNumber("7,9")).toBe(7);
  });

  it("returns null for blank or non-numeric text", () => {
    expect(parseWholeNumber("")).toBeNull();
    expect(parseWholeNumber("abc")).toBeNull();
    expect(parseWholeNumber("-")).toBeNull();
  });
});

describe("clampNumber", () => {
  it("keeps values inside the range and clamps the rest", () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(11, 0, 10)).toBe(10);
    expect(clampNumber(-1, 0, 10)).toBe(0);
  });
});

describe("parseNonNegativeDecimal", () => {
  it("parses like parseDecimal but never returns a negative", () => {
    expect(parseNonNegativeDecimal("72,5")).toBe(72.5);
    expect(parseNonNegativeDecimal("-3")).toBe(0);
    expect(parseNonNegativeDecimal("")).toBeNull();
  });
});

describe("parseNonNegativeWhole", () => {
  it("never returns a negative whole number", () => {
    expect(parseNonNegativeWhole("30")).toBe(30);
    expect(parseNonNegativeWhole("-4")).toBe(0);
    expect(parseNonNegativeWhole("x")).toBeNull();
  });
});
