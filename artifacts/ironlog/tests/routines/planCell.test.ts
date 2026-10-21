// Plan screen · numeric cell text/value rules (ironlog-workout-input-fixes T3/T5).

import { describe, expect, it } from "vitest";

import {
  cellTextForValue,
  isCellTextStale,
  normalizeCellText,
  parsePlanCell,
} from "@/domains/schedule/planCell";

describe("parsePlanCell", () => {
  it("returns undefined for blank text (clears the value)", () => {
    expect(parsePlanCell("", "weight")).toBeUndefined();
    expect(parsePlanCell("  ", "reps")).toBeUndefined();
  });

  it("returns null for text that is not a number yet (keep the old value)", () => {
    expect(parsePlanCell(".", "weight")).toBeNull();
    expect(parsePlanCell("abc", "reps")).toBeNull();
  });

  it("parses comma decimals for weight", () => {
    expect(parsePlanCell("22,5", "weight")).toBe(22.5);
  });

  it("parses reps as whole numbers", () => {
    expect(parsePlanCell("8", "reps")).toBe(8);
    expect(parsePlanCell("8,9", "reps")).toBe(8);
  });

  it("clamps weight and reps to >= 0", () => {
    expect(parsePlanCell("-5", "weight")).toBe(0);
    expect(parsePlanCell("-3", "reps")).toBe(0);
  });
});

describe("normalizeCellText", () => {
  it("leaves in-progress and valid text untouched", () => {
    expect(normalizeCellText("22.", "weight")).toBe("22.");
    expect(normalizeCellText("22,5", "weight")).toBe("22,5");
    expect(normalizeCellText("", "reps")).toBe("");
    expect(normalizeCellText(".", "weight")).toBe(".");
  });

  it("rewrites text that was clamped so the cell shows what is stored", () => {
    expect(normalizeCellText("-5", "weight")).toBe("0");
  });
});

describe("isCellTextStale", () => {
  it("is false while the text still means the stored value", () => {
    expect(isCellTextStale("22.", 22, "weight")).toBe(false);
    expect(isCellTextStale("22,5", 22.5, "weight")).toBe(false);
    expect(isCellTextStale("", undefined, "weight")).toBe(false);
  });

  it("is true when the value changed from outside", () => {
    expect(isCellTextStale("22", 25, "weight")).toBe(true);
    expect(isCellTextStale("22", undefined, "weight")).toBe(true);
    expect(isCellTextStale("", 25, "weight")).toBe(true);
  });
});

describe("cellTextForValue", () => {
  it("renders the stored value or an empty string", () => {
    expect(cellTextForValue(22.5)).toBe("22.5");
    expect(cellTextForValue(undefined)).toBe("");
  });
});
