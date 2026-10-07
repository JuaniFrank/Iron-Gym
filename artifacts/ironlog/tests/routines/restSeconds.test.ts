// Routines · parseRestSeconds (ironlog-port-minor-issues T10). Pure.

import { describe, expect, it } from "vitest";

import { formatRestSeconds, parseRestSeconds } from "@/domains/routines/restSeconds";

describe("parseRestSeconds", () => {
  it("accepts positive integers (number)", () => {
    expect(parseRestSeconds(90)).toBe(90);
    expect(parseRestSeconds(1)).toBe(1);
    expect(parseRestSeconds(180)).toBe(180);
  });

  it("accepts numeric strings", () => {
    expect(parseRestSeconds("120")).toBe(120);
    expect(parseRestSeconds(" 45 ")).toBe(45);
  });

  it("rejects zero and negatives", () => {
    expect(parseRestSeconds(0)).toBeNull();
    expect(parseRestSeconds(-30)).toBeNull();
    expect(parseRestSeconds("0")).toBeNull();
    expect(parseRestSeconds("-15")).toBeNull();
  });

  it("rejects NaN, infinity and non-integers", () => {
    expect(parseRestSeconds(Number.NaN)).toBeNull();
    expect(parseRestSeconds(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseRestSeconds(90.5)).toBeNull();
    expect(parseRestSeconds("90.5")).toBeNull();
  });

  it("rejects garbage and non-scalar values", () => {
    for (const v of ["abc", "", "  ", "12abc", "1e3", null, undefined, {}, [], true]) {
      expect(parseRestSeconds(v)).toBeNull();
    }
  });
});

describe("formatRestSeconds", () => {
  it("formats seconds, whole minutes and minutes:seconds", () => {
    expect(formatRestSeconds(0)).toBe("0s");
    expect(formatRestSeconds(45)).toBe("45s");
    expect(formatRestSeconds(60)).toBe("1m");
    expect(formatRestSeconds(90)).toBe("1:30");
    expect(formatRestSeconds(180)).toBe("3m");
    expect(formatRestSeconds(125)).toBe("2:05");
    expect(formatRestSeconds(600)).toBe("10m");
  });
});
