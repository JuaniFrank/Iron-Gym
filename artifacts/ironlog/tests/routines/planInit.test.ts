// Plan screen · initialization (ironlog-async-sqlite T9).

import { describe, expect, it } from "vitest";

import {
  initialPlanExercises,
  isPlanDataLoaded,
  shouldAutoSavePlan,
} from "@/domains/schedule/planInit";
import type { PlannedExercise, RoutineDay, SessionPlan } from "@/types";

const day: RoutineDay = {
  id: "d1",
  name: "Día 1",
  exercises: [
    {
      id: "x1",
      exerciseId: "bench",
      targetSets: 2,
      targetReps: 8,
      warmupSets: 1,
      restSeconds: 90,
    },
  ],
};

describe("isPlanDataLoaded", () => {
  it("requires both the routine and the existing plan to have loaded", () => {
    expect(isPlanDataLoaded(undefined, null)).toBe(false);
    expect(isPlanDataLoaded(null, undefined)).toBe(false);
    expect(isPlanDataLoaded(null, null)).toBe(true);
  });
});

describe("initialPlanExercises", () => {
  it("prefers the persisted plan", () => {
    const existing = {
      exercises: [{ exerciseId: "squat", sets: [] }],
    } as unknown as SessionPlan;
    expect(initialPlanExercises(day, existing, [])).toEqual(existing.exercises);
  });

  it("builds from the routine day: warmups first, then work sets", () => {
    const out = initialPlanExercises(day, null, []);
    expect(out).toHaveLength(1);
    expect(out[0]!.sets.map((s) => s.isWarmup)).toEqual([true, false, false]);
    expect(out[0]!.sets[1]!.reps).toBe(8);
  });

  it("is empty without a day", () => {
    expect(initialPlanExercises(undefined, null, [])).toEqual([]);
  });
});

describe("shouldAutoSavePlan", () => {
  const baseline: PlannedExercise[] = [];

  it("never saves the freshly initialized state (look and leave)", () => {
    expect(shouldAutoSavePlan(baseline, baseline)).toBe(false);
  });

  it("never saves before initialization", () => {
    expect(shouldAutoSavePlan(null, null)).toBe(false);
  });

  it("saves once the user edited (new array identity)", () => {
    expect(shouldAutoSavePlan([], baseline)).toBe(true);
  });
});
