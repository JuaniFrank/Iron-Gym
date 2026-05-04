// Workout · `replaceSessionExercise`.
//
// What we care about:
//   - Sets logged for the OLD exercise are UPDATED in place to point at
//     the NEW exerciseId. The set `id` and `completedAt` MUST be
//     preserved (so the user's recap timeline stays intact). This is a
//     plain UPDATE — NOT delete+insert.
//   - `exerciseOrder` swaps the old id for the new id at the same
//     position.
//   - If the new id was already elsewhere in the order, the duplicate
//     is dropped.

import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { completedSets, exercises, workoutSessions } from "@workspace/db/schema";

import { replaceSessionExercise } from "@/domains/workout/mutators";
import { uid } from "@/utils/id";

import { createTestDb, type TestDb } from "../helpers/db";

const SESSION_ID = "session-1";
const FROM = "ex-bench";
const TO = "ex-incline";

async function seed(db: TestDb): Promise<{ setId: string; completedAt: Date }> {
  const now = new Date();
  await db.insert(exercises).values({
    id: FROM,
    name: "Bench Press",
    description: "",
    primaryMuscle: "chest",
    secondaryMuscles: [],
    type: "barbell",
    isPreset: true,
    updatedAt: now,
  });
  await db.insert(exercises).values({
    id: TO,
    name: "Incline Press",
    description: "",
    primaryMuscle: "chest",
    secondaryMuscles: [],
    type: "barbell",
    isPreset: true,
    updatedAt: now,
  });
  await db.insert(workoutSessions).values({
    id: SESSION_ID,
    routineId: null,
    routineDayId: null,
    routineName: "Free",
    dayName: "Libre",
    startedAt: now,
    endedAt: null,
    exerciseOrder: [FROM],
    skippedExerciseIds: [],
    totalVolumeKg: 0,
    notes: null,
    updatedAt: now,
  });
  const setId = uid();
  await db.insert(completedSets).values({
    id: setId,
    sessionId: SESSION_ID,
    exerciseId: FROM,
    weight: 80,
    reps: 5,
    rpe: null,
    isWarmup: false,
    setIndex: 0,
    completedAt: now,
    updatedAt: now,
  });
  return { setId, completedAt: now };
}

describe("replaceSessionExercise", () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it("UPDATES sets in place — id + completedAt preserved", async () => {
    const { setId, completedAt } = await seed(db);

    await replaceSessionExercise(SESSION_ID, FROM, TO);

    const setAfter = await db
      .select()
      .from(completedSets)
      .where(eq(completedSets.id, setId))
      .get();
    expect(setAfter).toBeDefined();
    // id stays the same — same row.
    expect(setAfter?.id).toBe(setId);
    // exerciseId switched.
    expect(setAfter?.exerciseId).toBe(TO);
    // completedAt preserved.
    const ms =
      setAfter?.completedAt instanceof Date
        ? setAfter.completedAt.getTime()
        : (setAfter?.completedAt as unknown as number);
    expect(ms).toBe(completedAt.getTime());
  });

  it("swaps the id in exerciseOrder at the same position", async () => {
    await seed(db);
    await replaceSessionExercise(SESSION_ID, FROM, TO);
    const session = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, SESSION_ID))
      .get();
    expect(session?.exerciseOrder).toEqual([TO]);
  });

  it("is a no-op when fromExerciseId === toExerciseId", async () => {
    const { setId } = await seed(db);
    await replaceSessionExercise(SESSION_ID, FROM, FROM);
    const setAfter = await db
      .select()
      .from(completedSets)
      .where(eq(completedSets.id, setId))
      .get();
    expect(setAfter?.exerciseId).toBe(FROM);
  });

  it("drops the duplicate when the target exercise was already in the order", async () => {
    await seed(db);
    // Add the target id elsewhere in the order.
    const session = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, SESSION_ID))
      .get();
    await db
      .update(workoutSessions)
      .set({
        exerciseOrder: [...(session?.exerciseOrder ?? []), TO],
        updatedAt: new Date(),
      })
      .where(eq(workoutSessions.id, SESSION_ID));

    await replaceSessionExercise(SESSION_ID, FROM, TO);

    const after = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, SESSION_ID))
      .get();
    expect(after?.exerciseOrder).toEqual([TO]);
  });
});
