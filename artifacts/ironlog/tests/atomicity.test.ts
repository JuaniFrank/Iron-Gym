// Transaction atomicity (ironlog-web-compat T4 / C1).
//
// drizzle's expo-sqlite session is synchronous: it commits as soon as the
// transaction callback RETURNS. An `async` callback therefore commits at its
// first `await`, and later statements run outside the transaction with no
// rollback. The test DB helper reproduces that lifecycle exactly, so these
// tests fail if any mutator regresses to an async transaction callback.
//
// Failure injection: a SQLite trigger that aborts inserts/updates on
// `routine_days`, so the FIRST statement of each mutator succeeds and a LATER
// one throws.

import { eq } from "drizzle-orm";
import { runSeedIfNeeded, type SeedPayload } from "@workspace/db";
import {
  exercises,
  routineDays,
  routineExercises,
  routines,
} from "@workspace/db/schema";
import { beforeEach, describe, expect, it } from "vitest";

import { cloneRoutine, createRoutine, deleteRoutine } from "@/domains/routines/mutators";

import { createTestDb, type TestDb } from "./helpers/db";

let db: TestDb;
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
});

function abortOn(op: "INSERT" | "UPDATE") {
  sqlite.exec(
    `CREATE TRIGGER boom_${op.toLowerCase()} BEFORE ${op} ON routine_days
     BEGIN SELECT RAISE(ABORT, 'boom'); END;`,
  );
}

function seedRoutine(withDay: boolean) {
  const now = new Date();
  db.insert(routines)
    .values({ id: "r1", name: "Mine", isPreset: false, createdAt: now, updatedAt: now })
    .run();
  if (withDay) {
    db.insert(routineDays)
      .values({ id: "d1", routineId: "r1", name: "Dia 1", position: 0, updatedAt: now })
      .run();
    db.insert(exercises)
      .values({
        id: "ex-1",
        name: "Bench",
        description: "",
        primaryMuscle: "chest",
        secondaryMuscles: [],
        type: "barbell",
        isPreset: true,
        updatedAt: now,
      })
      .run();
    db.insert(routineExercises)
      .values({
        id: "re1",
        routineDayId: "d1",
        exerciseId: "ex-1",
        position: 0,
        targetSets: 3,
        targetReps: 8,
        warmupSets: 0,
        restSeconds: 90,
        updatedAt: now,
      })
      .run();
  }
}

describe("transaction atomicity", () => {
  it("createRoutine persists nothing when the day insert fails", async () => {
    abortOn("INSERT");
    await expect(createRoutine({ name: "Nueva" })).rejects.toThrow();
    expect(db.select().from(routines).all()).toHaveLength(0);
  });

  it("deleteRoutine deletes nothing when a later step fails", async () => {
    seedRoutine(true);
    abortOn("UPDATE");
    await expect(deleteRoutine("r1")).rejects.toThrow();
    const row = db.select().from(routines).where(eq(routines.id, "r1")).get();
    expect(row?.deletedAt).toBeNull();
    const ex = db.select().from(routineExercises).where(eq(routineExercises.id, "re1")).get();
    expect(ex?.deletedAt).toBeNull();
  });

  it("cloneRoutine persists nothing when a day insert fails", async () => {
    seedRoutine(true);
    abortOn("INSERT");
    await expect(cloneRoutine("r1")).rejects.toThrow();
    expect(db.select().from(routines).all()).toHaveLength(1);
  });

  it("runSeedIfNeeded persists nothing when a later step fails", async () => {
    abortOn("INSERT");
    const payload: SeedPayload = {
      version: 1,
      exercises: [
        {
          id: "ex-1",
          name: "Bench",
          description: "",
          primaryMuscle: "chest",
          secondaryMuscles: [],
          type: "barbell",
        },
      ],
      foods: [],
      routines: [
        {
          id: "routine-1",
          name: "PPL",
          days: [{ id: "day-A", name: "Push", exercises: [] }],
        },
      ],
      profileDefaults: {
        name: "Atleta",
        age: 28,
        weightKg: 75,
        heightCm: 175,
        sex: "male",
        activityLevel: "moderate",
        goal: "maintain",
        units: "metric",
        theme: "dark",
        caloriesGoal: 2500,
        proteinGoalG: 150,
        carbsGoalG: 250,
        fatGoalG: 70,
      },
    } as SeedPayload;
    await expect(runSeedIfNeeded(db, payload)).rejects.toThrow();
    expect(db.select().from(exercises).all()).toHaveLength(0);
    expect(db.select().from(routines).all()).toHaveLength(0);
  });
});
