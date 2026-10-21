// Active workout · save-then-rest sequencing (ironlog-workout-input-fixes T4).

import { describe, expect, it, vi } from "vitest";

import { saveSetThenRest } from "@/domains/workout/completeSet";

describe("saveSetThenRest", () => {
  it("starts the rest timer only after the set was saved", async () => {
    const order: string[] = [];
    const result = await saveSetThenRest({
      save: async () => {
        await Promise.resolve();
        order.push("saved");
      },
      isWarmup: false,
      startRest: () => order.push("rest"),
    });
    expect(result).toEqual({ ok: true });
    expect(order).toEqual(["saved", "rest"]);
  });

  it("does not start the rest timer for warm-ups", async () => {
    const startRest = vi.fn();
    const result = await saveSetThenRest({
      save: async () => {},
      isWarmup: true,
      startRest,
    });
    expect(result).toEqual({ ok: true });
    expect(startRest).not.toHaveBeenCalled();
  });

  it("never starts the rest timer when the save fails, and reports the error", async () => {
    const startRest = vi.fn();
    const error = new Error("validation failed");
    const result = await saveSetThenRest({
      save: async () => {
        throw error;
      },
      isWarmup: false,
      startRest,
    });
    expect(result).toEqual({ ok: false, error });
    expect(startRest).not.toHaveBeenCalled();
  });
});

describe("saveSetThenRest · in-flight guard", () => {
  it("two concurrent taps on the same slot save and start rest once", async () => {
    const inFlight = new Set<string>();
    const save = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    const startRest = vi.fn();
    const args = { save, isWarmup: false, startRest, inFlight, key: "ex:0:1" };
    const [a, b] = await Promise.all([saveSetThenRest(args), saveSetThenRest(args)]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(startRest).toHaveBeenCalledTimes(1);
    expect([a, b]).toContainEqual({ ok: true });
    expect([a, b]).toContainEqual({ ok: false, skipped: true });
    expect(inFlight.size).toBe(0);
  });

  it("releases the slot after a failure so the user can retry", async () => {
    const inFlight = new Set<string>();
    const failing = { save: async () => { throw new Error("x"); }, isWarmup: false, startRest: vi.fn(), inFlight, key: "k" };
    expect((await saveSetThenRest(failing)).ok).toBe(false);
    expect(inFlight.size).toBe(0);
    const startRest = vi.fn();
    expect(await saveSetThenRest({ ...failing, save: async () => {}, startRest })).toEqual({ ok: true });
    expect(startRest).toHaveBeenCalledTimes(1);
  });

  it("different slots do not block each other", async () => {
    const inFlight = new Set<string>();
    const mk = (key: string) => saveSetThenRest({ save: async () => {}, isWarmup: true, startRest: () => {}, inFlight, key });
    expect(await Promise.all([mk("a"), mk("b")])).toEqual([{ ok: true }, { ok: true }]);
  });
});
