// Workout · `finishWorkout` (DDB-12 + DDB-20).
//
// What we care about:
//   1. Detects a weight PR when the current session beats the historical max
//      and inserts a `pr_records` row with snapshot fields.
//   2. Re-running `finishWorkout` is idempotent — UNIQUE(session, exercise,
//      type) prevents duplicate PR rows.
//   3. Achievements unlock based on the loaded snapshot
//      (`first-workout`, `first-pr`).
//   4. `key_value.active_workout_id` is cleared.

import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  achievementsUnlocked,
  completedSets,
  exercises,
  keyValue,
  prRecords,
  workoutSessions,
} from "@workspace/db/schema";

import { finishWorkout } from "@/domains/workout/mutators";
import { uid } from "@/utils/id";

import { createTestDb, type TestDb } from "../helpers/db";

const EX_ID = "ex-bench";
const SESSION_PREV = "session-prev";
const SESSION_CURRENT = "session-current";

async function seedExerciseAndSession(
  db: TestDb,
  sessionId: string,
  endedAt: Date | null,
  sets: { weight: number; reps: number; isWarmup?: boolean }[],
): Promise<void> {
  const now = new Date();
  // Make sure the exercise exists once.
  const existingEx = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, EX_ID))
    .get();
  if (!existingEx) {
    await db.insert(exercises).values({
      id: EX_ID,
      name: "Bench Press",
      description: "",
      primaryMuscle: "chest",
      secondaryMuscles: [],
      type: "barbell",
      isPreset: true,
      updatedAt: now,
    });
  }
  await db.insert(workoutSessions).values({
    id: sessionId,
    routineId: null,
    routineDayId: null,
    routineName: "Free",
    dayName: "Libre",
    startedAt: now,
    endedAt,
    exerciseOrder: [EX_ID],
    skippedExerciseIds: [],
    totalVolumeKg: 0,
    notes: null,
    updatedAt: now,
  });
  for (let i = 0; i < sets.length; i += 1) {
    const s = sets[i];
    await db.insert(completedSets).values({
      id: uid(),
      sessionId,
      exerciseId: EX_ID,
      weight: s.weight,
      reps: s.reps,
      rpe: null,
      isWarmup: s.isWarmup ?? false,
      setIndex: i,
      completedAt: now,
      updatedAt: now,
    });
  }
}

describe("finishWorkout", () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it("detects a weight PR and inserts pr_records with snapshot fields", async () => {
    // Previous finished session at 80kg.
    await seedExerciseAndSession(db, SESSION_PREV, new Date(), [
      { weight: 80, reps: 5 },
    ]);
    // Current session at 100kg, not yet finished.
    await seedExerciseAndSession(db, SESSION_CURRENT, null, [
      { weight: 100, reps: 5 },
    ]);

    const result = await finishWorkout(SESSION_CURRENT, "felt strong");

    expect(result.prs).toHaveLength(1);
    expect(result.prs[0]).toMatchObject({
      exerciseId: EX_ID,
      exerciseName: "Bench Press",
      type: "weight",
      value: 100,
      previousValue: 80,
    });

    const dbPrs = await db
      .select()
      .from(prRecords)
      .where(eq(prRecords.sessionId, SESSION_CURRENT))
      .all();
    expect(dbPrs).toHaveLength(1);
    expect(dbPrs[0].exerciseName).toBe("Bench Press");
    expect(dbPrs[0].previousValue).toBe(80);
  });

  it("does NOT create duplicate PR rows on re-run (idempotent via UNIQUE)", async () => {
    await seedExerciseAndSession(db, SESSION_PREV, new Date(), [
      { weight: 80, reps: 5 },
    ]);
    await seedExerciseAndSession(db, SESSION_CURRENT, null, [
      { weight: 100, reps: 5 },
    ]);

    await finishWorkout(SESSION_CURRENT);
    // Second call (e.g. screen retry).
    await finishWorkout(SESSION_CURRENT);

    const dbPrs = await db
      .select()
      .from(prRecords)
      .where(eq(prRecords.sessionId, SESSION_CURRENT))
      .all();
    expect(dbPrs).toHaveLength(1);
  });

  it("does NOT detect a PR when current max ties or loses to history", async () => {
    await seedExerciseAndSession(db, SESSION_PREV, new Date(), [
      { weight: 100, reps: 5 },
    ]);
    await seedExerciseAndSession(db, SESSION_CURRENT, null, [
      { weight: 100, reps: 5 }, // ties — not a PR
    ]);
    const result = await finishWorkout(SESSION_CURRENT);
    expect(result.prs).toHaveLength(0);
  });

  it("ignores warmup sets when computing the current-session max", async () => {
    await seedExerciseAndSession(db, SESSION_PREV, new Date(), [
      { weight: 80, reps: 5 },
    ]);
    await seedExerciseAndSession(db, SESSION_CURRENT, null, [
      { weight: 200, reps: 10, isWarmup: true }, // warmup — ignored
      { weight: 90, reps: 5 },
    ]);
    const result = await finishWorkout(SESSION_CURRENT);
    expect(result.prs).toHaveLength(1);
    expect(result.prs[0].value).toBe(90);
  });

  it("unlocks first-workout and first-pr achievements on the first PR session", async () => {
    // No previous session — current session is the first.
    await seedExerciseAndSession(db, SESSION_CURRENT, null, [
      { weight: 100, reps: 5 },
    ]);
    const result = await finishWorkout(SESSION_CURRENT);
    const ids = result.newAchievements.map((a) => a.id).sort();
    expect(ids).toContain("first-workout");
    expect(ids).toContain("first-pr");

    const dbAchievements = await db
      .select()
      .from(achievementsUnlocked)
      .all();
    const dbIds = dbAchievements.map((a) => a.id).sort();
    expect(dbIds).toContain("first-workout");
    expect(dbIds).toContain("first-pr");
  });

  it("does NOT re-insert already-unlocked achievements", async () => {
    await db
      .insert(achievementsUnlocked)
      .values({ id: "first-workout", unlockedAt: new Date() });

    await seedExerciseAndSession(db, SESSION_CURRENT, null, [
      { weight: 100, reps: 5 },
    ]);
    const result = await finishWorkout(SESSION_CURRENT);
    const ids = result.newAchievements.map((a) => a.id);
    expect(ids).not.toContain("first-workout");
  });

  it("clears key_value.active_workout_id", async () => {
    const now = new Date();
    await db
      .insert(keyValue)
      .values({
        key: "active_workout_id",
        value: SESSION_CURRENT,
        updatedAt: now,
      });
    await seedExerciseAndSession(db, SESSION_CURRENT, null, [
      { weight: 50, reps: 5 },
    ]);

    await finishWorkout(SESSION_CURRENT);

    const remaining = await db
      .select()
      .from(keyValue)
      .where(eq(keyValue.key, "active_workout_id"))
      .get();
    expect(remaining).toBeUndefined();
  });

  it("stamps endedAt + notes + totalVolumeKg on the session row", async () => {
    await seedExerciseAndSession(db, SESSION_CURRENT, null, [
      { weight: 100, reps: 5 }, // 500
      { weight: 100, reps: 5 }, // 500
      { weight: 50, reps: 10, isWarmup: true }, // ignored
    ]);

    await finishWorkout(SESSION_CURRENT, "great day");

    const session = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, SESSION_CURRENT))
      .get();
    expect(session?.endedAt).not.toBeNull();
    expect(session?.notes).toBe("great day");
    expect(session?.totalVolumeKg).toBe(1000);
  });
});
