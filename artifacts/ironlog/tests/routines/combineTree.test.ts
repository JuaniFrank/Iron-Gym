// Routines · tree combine (ironlog-async-sqlite T8).
// The three live queries (routines, days, exercises) resolve independently;
// the tree must only be built once all of them have loaded.

import { describe, expect, it } from "vitest";

import { combineRoutineTree } from "@/domains/routines/tree";

const routineRow = {
  id: "r1",
  name: "Push",
  description: null,
  isPreset: false,
  goal: null,
  createdAt: new Date(1000),
} as never;
const dayRow = { id: "d1", routineId: "r1", name: "Día 1" } as never;
const exRow = {
  id: "x1",
  routineDayId: "d1",
  exerciseId: "bench",
  targetSets: 3,
  targetReps: 8,
  warmupSets: 0,
  supersetWith: null,
  restSeconds: 90,
  notes: null,
} as never;

describe("combineRoutineTree", () => {
  it("returns undefined until every subscription has loaded", () => {
    expect(combineRoutineTree([routineRow], undefined, undefined)).toBeUndefined();
    expect(combineRoutineTree([routineRow], [dayRow], undefined)).toBeUndefined();
    expect(combineRoutineTree(undefined, [dayRow], [exRow])).toBeUndefined();
  });

  it("builds the full tree once all three have loaded", () => {
    const tree = combineRoutineTree([routineRow], [dayRow], [exRow]);
    expect(tree).toHaveLength(1);
    expect(tree![0]!.days).toHaveLength(1);
    expect(tree![0]!.days[0]!.exercises.map((e) => e.exerciseId)).toEqual([
      "bench",
    ]);
    expect(tree![0]!.createdAt).toBe(1000);
  });

  it("returns an empty list (loaded, no routines) for empty results", () => {
    expect(combineRoutineTree([], [], [])).toEqual([]);
  });
});
