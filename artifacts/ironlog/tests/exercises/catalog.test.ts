import { describe, expect, it } from "vitest";

import { EXERCISES } from "@/constants/exercises";
import { SEED_VERSION } from "@/constants/seed";
import type { ExerciseType, MuscleGroup } from "@/types";

const MUSCLES: MuscleGroup[] = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "abs", "quadriceps", "hamstrings", "glutes", "calves",
];
const TYPES: ExerciseType[] = ["barbell", "dumbbell", "machine", "cable", "bodyweight"];

describe("default exercise catalog", () => {
  it("has at least 20 exercises per muscle group", () => {
    for (const m of MUSCLES) {
      const count = EXERCISES.filter((e) => e.primaryMuscle === m).length;
      expect(count, m).toBeGreaterThanOrEqual(20);
    }
  });

  it("has unique ids", () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique names (case-insensitive, trimmed)", () => {
    const names = EXERCISES.map((e) => e.name.trim().toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("numbers ids sequentially per section", () => {
    for (const m of MUSCLES) {
      const section = EXERCISES.filter((e) => e.primaryMuscle === m);
      const prefix = section[0].id.replace(/-\d+$/, "");
      section.forEach((e, i) => expect(e.id).toBe(`${prefix}-${i + 1}`));
    }
  });

  it("uses valid types and secondary muscles", () => {
    for (const e of EXERCISES) {
      expect(TYPES, e.id).toContain(e.type);
      for (const s of e.secondaryMuscles) {
        expect(MUSCLES, e.id).toContain(s);
        expect(s, e.id).not.toBe(e.primaryMuscle);
      }
      expect(e.description.length, e.id).toBeGreaterThan(0);
    }
  });

  it("bumps the seed version so presets are re-upserted", () => {
    expect(SEED_VERSION).toBe(2);
  });
});
