// Routines · new exercises take the user's default rest
// (ironlog-port-minor-issues T10). Real DB (createTestDb).

import { eq } from "drizzle-orm";
import { exercises, keyValue, routineExercises } from "@workspace/db/schema";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addExerciseToDay,
  readDefaultRestSeconds,
  saveRoutineDraft,
} from "@/domains/routines/mutators";

import { createTestDb, type TestDb } from "../helpers/db";

let db: TestDb;

beforeEach(async () => {
  ({ db } = createTestDb());
  const now = new Date();
  await db.insert(exercises)
    .values({
      id: "bench",
      name: "bench",
      description: "",
      primaryMuscle: "chest",
      secondaryMuscles: [],
      type: "barbell",
      isPreset: true,
      updatedAt: now,
    })
    .run();
  await saveRoutineDraft(
    { id: "r1", name: "R", days: [{ id: "d1", name: "A", exercises: [] }] },
    null,
  );
});

async function setDefault(value: unknown) {
  await db
    .insert(keyValue)
    .values({ key: "default_rest_seconds", value: value as never, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: keyValue.key,
      set: { value: value as never, updatedAt: new Date() },
    })
    .run();
}

async function storedRest(id: string): Promise<number | undefined> {
  const row = await db
    .select({ r: routineExercises.restSeconds })
    .from(routineExercises)
    .where(eq(routineExercises.id, id))
    .get();
  return row?.r;
}

describe("addExerciseToDay default rest", () => {
  it("falls back to 90 when no setting row exists", async () => {
    const ex = await addExerciseToDay("r1", "d1", "bench");
    expect(ex.restSeconds).toBe(90);
    expect(await storedRest(ex.id)).toBe(90);
  });

  it("reads a numeric setting", async () => {
    await setDefault(180);
    const ex = await addExerciseToDay("r1", "d1", "bench");
    expect(ex.restSeconds).toBe(180);
    expect(await storedRest(ex.id)).toBe(180);
  });

  it("reads a numeric-string setting (legacy)", async () => {
    await setDefault("120");
    const ex = await addExerciseToDay("r1", "d1", "bench");
    expect(ex.restSeconds).toBe(120);
    expect(await storedRest(ex.id)).toBe(120);
  });

  it("ignores zero, negative and garbage settings", async () => {
    for (const bad of [0, -5, "abc", "", "-20"]) {
      await setDefault(bad);
      const ex = await addExerciseToDay("r1", "d1", "bench");
      expect(ex.restSeconds).toBe(90);
      expect(await storedRest(ex.id)).toBe(90);
    }
  });
});

describe("readDefaultRestSeconds (used by the draft picker)", () => {
  it("returns the stored setting, else 90", async () => {
    expect(await readDefaultRestSeconds()).toBe(90);
    await setDefault(150);
    expect(await readDefaultRestSeconds()).toBe(150);
    await setDefault("nope");
    expect(await readDefaultRestSeconds()).toBe(90);
  });
});
