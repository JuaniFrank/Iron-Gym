// Active session · elapsed time (ironlog-async-sqlite T11).

import { describe, expect, it } from "vitest";

import { elapsedMs, formatDuration } from "@/utils/date";

describe("elapsedMs", () => {
  it("is the difference when the clock is ahead of the start", () => {
    expect(elapsedMs(5000, 2000)).toBe(3000);
  });

  it("never goes negative when startedAt is ahead of the render clock", () => {
    expect(elapsedMs(1000, 1300)).toBe(0);
    expect(formatDuration(elapsedMs(1000, 1300))).toBe("0s");
  });
});
