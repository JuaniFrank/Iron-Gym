import { describe, expect, it } from "vitest";

import {
  filterExercises,
  hasActiveFilters,
  normalizeText,
  toggleValue,
  type ExerciseFilters,
} from "@/domains/exercises/filter";
import type { Exercise, ExerciseType, MuscleGroup } from "@/types";

const ex = (
  id: string,
  name: string,
  primaryMuscle: MuscleGroup,
  type: ExerciseType,
): Exercise => ({ id, name, description: "", primaryMuscle, secondaryMuscles: [], type });

const LIST: Exercise[] = [
  ex("1", "Jalón al pecho", "back", "cable"),
  ex("2", "Press banca", "chest", "barbell"),
  ex("3", "Press inclinado con mancuernas", "chest", "dumbbell"),
  ex("4", "Remo con barra", "back", "barbell"),
  ex("5", "Curl de bíceps", "biceps", "dumbbell"),
];

const none: ExerciseFilters = { muscles: [], types: [], search: "" };
const ids = (l: Exercise[]) => l.map((e) => e.id);

describe("normalizeText", () => {
  it("lowercases, trims and strips diacritics", () => {
    expect(normalizeText("  Jalón BÍCEPS ")).toBe("jalon biceps");
  });
});

describe("filterExercises", () => {
  it("returns everything with empty filters", () => {
    expect(ids(filterExercises(LIST, none))).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("matches ignoring diacritics", () => {
    expect(ids(filterExercises(LIST, { ...none, search: "jalon" }))).toEqual(["1"]);
    expect(ids(filterExercises(LIST, { ...none, search: "BICEPS" }))).toEqual(["5"]);
  });

  it("requires all tokens in any order", () => {
    expect(ids(filterExercises(LIST, { ...none, search: "mancuernas press" }))).toEqual(["3"]);
    expect(ids(filterExercises(LIST, { ...none, search: "press remo" }))).toEqual([]);
  });

  it("treats whitespace-only search as no constraint", () => {
    expect(filterExercises(LIST, { ...none, search: "   " })).toHaveLength(5);
  });

  it("ORs within the muscle group", () => {
    expect(ids(filterExercises(LIST, { ...none, muscles: ["chest", "biceps"] }))).toEqual([
      "2",
      "3",
      "5",
    ]);
  });

  it("ORs within the type group", () => {
    expect(ids(filterExercises(LIST, { ...none, types: ["cable", "dumbbell"] }))).toEqual([
      "1",
      "3",
      "5",
    ]);
  });

  it("ANDs across groups", () => {
    const f: ExerciseFilters = {
      muscles: ["chest", "back"],
      types: ["barbell"],
      search: "press",
    };
    expect(ids(filterExercises(LIST, f))).toEqual(["2"]);
  });

  it("empty group is no constraint", () => {
    expect(ids(filterExercises(LIST, { ...none, muscles: ["back"] }))).toEqual(["1", "4"]);
  });
});

describe("toggleValue", () => {
  it("adds a missing value without mutating", () => {
    const list = ["a"];
    expect(toggleValue(list, "b")).toEqual(["a", "b"]);
    expect(list).toEqual(["a"]);
  });
  it("removes a present value", () => {
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("hasActiveFilters", () => {
  it("is false when nothing is set", () => {
    expect(hasActiveFilters(none)).toBe(false);
    expect(hasActiveFilters({ ...none, search: "  " })).toBe(false);
  });
  it("is true for any active group or search", () => {
    expect(hasActiveFilters({ ...none, muscles: ["chest"] })).toBe(true);
    expect(hasActiveFilters({ ...none, types: ["cable"] })).toBe(true);
    expect(hasActiveFilters({ ...none, search: "x" })).toBe(true);
  });
});
