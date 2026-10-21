// Regression · "22.5 kg shows as 22" (ironlog-workout-input-fixes T2).
//
// Root cause: `parseFloat("22,5") === 22` on es-AR keyboards (comma decimal
// pad). This walks the whole domain path for a 22.5 kg weight typed with
// either separator: input text → draft / completion / plan → storage →
// read-back → volume. Nothing downstream may truncate a decimal.

import type Database from "better-sqlite3";
import { completedSets, sessionPlans, sessionSetDrafts, workoutSessions } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { upsertSessionPlan } from "@/domains/schedule/mutators";
import {
  logSet,
  upsertSessionSetDraft,
} from "@/domains/workout/mutators";
import {
  parseCompletion,
  parseDraftPatch,
  resolveSetInputs,
} from "@/domains/workout/setInputs";
import { parseDecimal } from "@/utils/parseNumber";

import { createTestDb, type TestDb } from "../helpers/db";

const S1 = "session-1";
const EX = "ex-bench";

let db: TestDb;
let sqlite: Database.Database;

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  sqlite
    .prepare(
      `INSERT INTO exercises (id, name, primary_muscle, type, is_preset, updated_at)
       VALUES (?, 'Lift', 'chest', 'barbell', 1, 1)`,
    )
    .run(EX);
  sqlite
    .prepare(
      `INSERT INTO workout_sessions
         (id, routine_name, day_name, started_at, exercise_order, updated_at)
       VALUES (?, 'R', 'D', 1, '[]', 1)`,
    )
    .run(S1);
  sqlite
    .prepare("INSERT INTO routines (id, name, created_at, updated_at) VALUES ('r', 'R', 1, 1)")
    .run();
  sqlite
    .prepare(
      "INSERT INTO routine_days (id, routine_id, name, position, updated_at) VALUES ('d', 'r', 'D', 0, 1)",
    )
    .run();
});

describe.each(["22.5", "22,5"])("weight typed as %s", (typed) => {
  it("is stored as 22.5 when the set is logged", async () => {
    const parsed = parseCompletion(typed, "8", "");
    expect(parsed).not.toBeNull();
    await logSet(S1, { exerciseId: EX, isWarmup: false, setIndex: 0, ...parsed! });

    const rows = await db.select().from(completedSets).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.weight).toBe(22.5);
    // 22.5 kg x 8 reps = 180 kg of volume (rounded snapshot, not 22 x 8 = 176).
    const session = await db.select().from(workoutSessions).where(eq(workoutSessions.id, S1)).get();
    expect(session!.totalVolumeKg).toBe(180);
  });

  it("is kept as 22.5 in the autosaved draft and re-seeds the input as 22.5", async () => {
    const patch = parseDraftPatch(typed, "8", "");
    await upsertSessionSetDraft(
      { sessionId: S1, exerciseId: EX, setIndex: 1, isWarmup: false },
      patch,
    );
    const draft = await db.select().from(sessionSetDrafts).get();
    expect(draft!.weight).toBe(22.5);
    expect(
      resolveSetInputs({ isWarmup: false, draft: { weight: draft!.weight ?? undefined } }).weight,
    ).toBe("22.5");
  });

  it("is kept as 22.5 in a session plan", async () => {
    await upsertSessionPlan({
      dateKey: "2026-10-21",
      routineId: "r",
      routineDayId: "d",
      exercises: [
        { exerciseId: EX, sets: [{ weight: parseDecimal(typed) ?? undefined, reps: 8, isWarmup: false }] },
      ],
    });
    const plan = await db.select().from(sessionPlans).get();
    expect(plan!.exercises[0]!.sets[0]!.weight).toBe(22.5);
  });
});
