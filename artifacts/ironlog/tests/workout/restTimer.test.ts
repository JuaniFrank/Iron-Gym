// Rest timer arithmetic (ironlog-port-minor-issues T6). The countdown is
// derived from absolute timestamps so time spent in background still counts.

import { describe, expect, it } from "vitest";

import {
  adjustEndsAt,
  effectiveNow,
  isFinished,
  planRestStart,
  progress,
  remainingMs,
  remainingSeconds,
  resumeEndsAt,
} from "@/domains/workout/restTimer";

const T0 = 1_700_000_000_000;
const sec = (n: number) => n * 1000;

describe("remainingSeconds", () => {
  it("rounds partial seconds up", () => {
    expect(remainingSeconds(T0 + 90_000, T0)).toBe(90);
    expect(remainingSeconds(T0 + 90_000, T0 + 1)).toBe(90);
    expect(remainingSeconds(T0 + 90_000, T0 + 999)).toBe(90);
    expect(remainingSeconds(T0 + 90_000, T0 + 1000)).toBe(89);
  });

  it("floors at 0 once the end passed", () => {
    expect(remainingSeconds(T0, T0)).toBe(0);
    expect(remainingSeconds(T0, T0 + 5_000)).toBe(0);
  });

  it("survives a jump in time (app was in background)", () => {
    const endsAt = T0 + sec(90);
    expect(remainingSeconds(endsAt, T0 + sec(40))).toBe(50);
    expect(remainingSeconds(endsAt, T0 + sec(200))).toBe(0);
  });
});

describe("remainingMs / effectiveNow", () => {
  it("never goes negative", () => {
    expect(remainingMs(T0, T0 + 10)).toBe(0);
    expect(remainingMs(T0 + 500, T0)).toBe(500);
  });

  it("freezes on the pause snapshot while paused", () => {
    expect(effectiveNow(null, T0 + 5_000)).toBe(T0 + 5_000);
    expect(effectiveNow(T0 + 1_000, T0 + 5_000)).toBe(T0 + 1_000);
  });
});

describe("isFinished", () => {
  it("is true when no whole second is left", () => {
    expect(isFinished(T0, T0)).toBe(true);
    expect(isFinished(T0 + 1, T0)).toBe(false);
  });
});

describe("resumeEndsAt", () => {
  it("shifts the end by the time spent paused", () => {
    const endsAt = T0 + sec(60);
    const pausedAt = T0 + sec(10);
    const resumedAt = T0 + sec(25);
    const next = resumeEndsAt(endsAt, pausedAt, resumedAt);
    expect(next).toBe(T0 + sec(75));
    // 50s were left when pausing and 50s are left right after resuming.
    expect(remainingSeconds(next, resumedAt)).toBe(50);
  });

  it("does not move the end when resumed instantly", () => {
    expect(resumeEndsAt(T0 + 1000, T0, T0)).toBe(T0 + 1000);
  });

  it("never shifts backwards if the clock went back", () => {
    expect(resumeEndsAt(T0 + 1000, T0 + 500, T0)).toBe(T0 + 1000);
  });
});

describe("adjustEndsAt", () => {
  it("adds and removes seconds while running", () => {
    const endsAt = T0 + sec(60);
    expect(adjustEndsAt({ endsAt, deltaSec: 15, pausedAt: null, now: T0 })).toBe(
      T0 + sec(75),
    );
    expect(adjustEndsAt({ endsAt, deltaSec: -15, pausedAt: null, now: T0 })).toBe(
      T0 + sec(45),
    );
  });

  it("-15 floors at now instead of going into the past", () => {
    const now = T0 + sec(55);
    const next = adjustEndsAt({
      endsAt: T0 + sec(60),
      deltaSec: -15,
      pausedAt: null,
      now,
    });
    expect(next).toBe(now);
    expect(remainingSeconds(next, now)).toBe(0);
  });

  it("-15 after the timer finished stays finished", () => {
    const now = T0 + sec(100);
    const next = adjustEndsAt({ endsAt: T0 + sec(60), deltaSec: -15, pausedAt: null, now });
    expect(isFinished(next, now)).toBe(true);
  });

  it("+15 after reaching 0 extends from now, not from the stale end", () => {
    const now = T0 + sec(100);
    const next = adjustEndsAt({ endsAt: T0 + sec(60), deltaSec: 15, pausedAt: null, now });
    expect(next).toBe(now + sec(15));
    // Not finished any more, so completion re-arms.
    expect(isFinished(next, now)).toBe(false);
    expect(remainingSeconds(next, now)).toBe(15);
  });

  it("+15 right after finishing (end == now) re-arms too", () => {
    const next = adjustEndsAt({ endsAt: T0, deltaSec: 15, pausedAt: null, now: T0 });
    expect(next).toBe(T0 + sec(15));
  });

  it("floors at the pause snapshot while paused", () => {
    const pausedAt = T0 + sec(10);
    const now = T0 + sec(40);
    // 5s left at pause time: -15 floors at pausedAt, not at the later `now`.
    const next = adjustEndsAt({
      endsAt: pausedAt + sec(5),
      deltaSec: -15,
      pausedAt,
      now,
    });
    expect(next).toBe(pausedAt);
    // +15 while paused extends relative to the frozen remaining time.
    const plus = adjustEndsAt({
      endsAt: pausedAt + sec(5),
      deltaSec: 15,
      pausedAt,
      now,
    });
    expect(plus).toBe(pausedAt + sec(20));
    expect(remainingSeconds(plus, pausedAt)).toBe(20);
  });
});

describe("progress", () => {
  it("is the remaining fraction of the original duration", () => {
    expect(progress(sec(45), 90)).toBe(0.5);
    expect(progress(sec(90), 90)).toBe(1);
    expect(progress(0, 90)).toBe(0);
  });

  it("clamps to 0..1 (e.g. +15 beyond the original duration)", () => {
    expect(progress(sec(120), 90)).toBe(1);
    expect(progress(-5, 90)).toBe(0);
  });

  it("returns 0 for a zero or negative duration", () => {
    expect(progress(sec(10), 0)).toBe(0);
    expect(progress(sec(10), -1)).toBe(0);
  });
});

describe("planRestStart", () => {
  it("starts a countdown ending `seconds` from now", () => {
    expect(planRestStart(90, T0)).toEqual({
      endsAt: T0 + 90_000,
      durationSeconds: 90,
    });
  });

  it("0 s means no rest: nothing to start", () => {
    expect(planRestStart(0, T0)).toBeNull();
  });

  it("negative or non-finite durations never start a timer", () => {
    expect(planRestStart(-5, T0)).toBeNull();
    expect(planRestStart(Number.NaN, T0)).toBeNull();
    expect(planRestStart(Number.POSITIVE_INFINITY, T0)).toBeNull();
  });
});
