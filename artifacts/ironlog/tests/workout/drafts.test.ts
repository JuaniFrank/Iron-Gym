// Workout · set-input drafts (`session_set_drafts`).
//
// Drafts are device-ephemeral: autosaved kg/reps/rpe for a slot that is not
// completed yet. They must never sync (no capture triggers, no `_outbox` rows)
// and must disappear when their slot is logged or their session ends.

import type Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { sessionSetDrafts, workoutSessions } from "@workspace/db/schema";
import { beforeEach, describe, expect, it } from "vitest";

import { resetAll } from "@/domains/admin/mutators";
import {
  buildDraftKey,
  draftRowsToMap,
} from "@/domains/workout/queries";
import {
  cancelWorkout,
  clearDraftsForSession,
  clearSessionSetDraft,
  finishWorkout,
  logSet,
  upsertSessionSetDraft,
} from "@/domains/workout/mutators";

import { createTestDb, type TestDb } from "../helpers/db";

const S1 = "session-1";
const S2 = "session-2";
const EX = "ex-bench";
const EX2 = "ex-squat";

let db: TestDb;
let sqlite: Database.Database;

function insertSession(id: string) {
  sqlite
    .prepare(
      `INSERT INTO workout_sessions
         (id, routine_name, day_name, started_at, exercise_order, updated_at)
       VALUES (?, 'R', 'D', 1, '[]', 1)`,
    )
    .run(id);
}

const slot = (over: Partial<{ sessionId: string; exerciseId: string; setIndex: number; isWarmup: boolean }> = {}) => ({
  sessionId: S1,
  exerciseId: EX,
  setIndex: 1,
  isWarmup: false,
  ...over,
});

const drafts = (sessionId?: string) =>
  db
    .select()
    .from(sessionSetDrafts)
    .where(sessionId ? eq(sessionSetDrafts.sessionId, sessionId) : undefined)
    .all();

function insertExercise(id: string) {
  sqlite
    .prepare(
      `INSERT INTO exercises (id, name, primary_muscle, type, is_preset, updated_at)
       VALUES (?, 'Lift', 'chest', 'barbell', 1, 1)`,
    )
    .run(id);
}

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  insertExercise(EX);
  insertExercise(EX2);
  insertSession(S1);
  insertSession(S2);
});

describe("upsertSessionSetDraft", () => {
  it("inserts a draft for a new slot", async () => {
    await upsertSessionSetDraft(slot(), { weight: 80, reps: 8, rpe: 7.5 });
    const rows = await drafts();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sessionId: S1,
      exerciseId: EX,
      setIndex: 1,
      isWarmup: false,
      weight: 80,
      reps: 8,
      rpe: 7.5,
    });
  });

  it("keeps untouched fields on a partial patch and bumps updatedAt", async () => {
    await upsertSessionSetDraft(slot(), { weight: 80, reps: 8 });
    const before = (await drafts())[0]!;
    await new Promise((r) => setTimeout(r, 5));
    await upsertSessionSetDraft(slot(), { rpe: 9 });
    const rows = await drafts();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: before.id, weight: 80, reps: 8, rpe: 9 });
    expect(rows[0]!.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("clears a single field when the patch sets it to null but others remain", async () => {
    await upsertSessionSetDraft(slot(), { weight: 80, reps: 8 });
    await upsertSessionSetDraft(slot(), { reps: null });
    expect((await drafts())[0]).toMatchObject({ weight: 80, reps: null });
  });

  it("writes nothing for an all-empty patch on a new slot", async () => {
    await upsertSessionSetDraft(slot(), {});
    await upsertSessionSetDraft(slot(), { weight: null, reps: null, rpe: null });
    await upsertSessionSetDraft(slot(), { weight: NaN, reps: NaN, rpe: NaN });
    expect(await drafts()).toHaveLength(0);
  });

  it("deletes the existing draft when the patch empties every field", async () => {
    await upsertSessionSetDraft(slot(), { weight: 80, reps: 8, rpe: 7 });
    await upsertSessionSetDraft(slot(), { weight: null, reps: null, rpe: null });
    expect(await drafts()).toHaveLength(0);
  });

  it("does not delete when other fields remain after a partial emptying patch", async () => {
    await upsertSessionSetDraft(slot(), { weight: 80, reps: 8 });
    await upsertSessionSetDraft(slot(), { weight: null });
    expect(await drafts()).toHaveLength(1);
  });

  it("isolates slots by session, exercise, set index and warmup flag", async () => {
    await upsertSessionSetDraft(slot(), { weight: 1 });
    await upsertSessionSetDraft(slot({ sessionId: S2 }), { weight: 2 });
    await upsertSessionSetDraft(slot({ exerciseId: EX2 }), { weight: 3 });
    await upsertSessionSetDraft(slot({ setIndex: 2 }), { weight: 4 });
    await upsertSessionSetDraft(slot({ isWarmup: true }), { weight: 5 });
    expect((await drafts()).map((r) => r.weight).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("rejects an invalid slot", async () => {
    await expect(upsertSessionSetDraft(slot({ setIndex: 0 }), { weight: 1 })).rejects.toThrow();
    await expect(upsertSessionSetDraft(slot({ sessionId: "" }), { weight: 1 })).rejects.toThrow();
  });
});

describe("unique slot index", () => {
  it("rejects a second row for the same slot", () => {
    const insert = () =>
      sqlite
        .prepare(
          `INSERT INTO session_set_drafts
             (id, session_id, exercise_id, set_index, is_warmup, updated_at)
           VALUES (?, ?, ?, 1, 0, 1)`,
        )
        .run(Math.random().toString(), S1, EX);
    insert();
    expect(insert).toThrow(/UNIQUE/);
  });
});

describe("clearing drafts", () => {
  it("clearSessionSetDraft removes only the given slot", async () => {
    await upsertSessionSetDraft(slot(), { weight: 1 });
    await upsertSessionSetDraft(slot({ setIndex: 2 }), { weight: 2 });
    await clearSessionSetDraft(slot());
    expect((await drafts()).map((r) => r.setIndex)).toEqual([2]);
  });

  it("clearDraftsForSession removes every draft of that session only", async () => {
    await upsertSessionSetDraft(slot(), { weight: 1 });
    await upsertSessionSetDraft(slot({ setIndex: 2 }), { weight: 2 });
    await upsertSessionSetDraft(slot({ sessionId: S2 }), { weight: 3 });
    await clearDraftsForSession(S1);
    expect((await drafts()).map((r) => r.sessionId)).toEqual([S2]);
  });
});

describe("workout lifecycle cleanup", () => {
  const set = (over: Partial<{ setIndex: number; isWarmup: boolean; exerciseId: string }> = {}) => ({
    exerciseId: EX,
    weight: 100,
    reps: 5,
    isWarmup: false,
    setIndex: 1,
    ...over,
  });

  it("logSet removes only the draft of the logged slot", async () => {
    await upsertSessionSetDraft(slot(), { weight: 1 });
    await upsertSessionSetDraft(slot({ setIndex: 2 }), { weight: 2 });
    await upsertSessionSetDraft(slot({ isWarmup: true }), { weight: 3 });
    await upsertSessionSetDraft(slot({ exerciseId: EX2 }), { weight: 4 });
    await upsertSessionSetDraft(slot({ sessionId: S2 }), { weight: 5 });

    await logSet(S1, set());

    expect((await drafts()).map((r) => r.weight).sort()).toEqual([2, 3, 4, 5]);
  });

  it("finishWorkout removes the drafts of that session only", async () => {
    await upsertSessionSetDraft(slot(), { weight: 1 });
    await upsertSessionSetDraft(slot({ setIndex: 2 }), { weight: 2 });
    await upsertSessionSetDraft(slot({ sessionId: S2 }), { weight: 3 });

    await finishWorkout(S1);

    expect((await drafts()).map((r) => r.sessionId)).toEqual([S2]);
  });

  it("cancelWorkout removes the drafts of that session only", async () => {
    await upsertSessionSetDraft(slot(), { weight: 1 });
    await upsertSessionSetDraft(slot({ sessionId: S2 }), { weight: 3 });

    await cancelWorkout(S1);

    expect((await drafts()).map((r) => r.sessionId)).toEqual([S2]);
    expect(
      await db.select().from(workoutSessions).where(eq(workoutSessions.id, S1)).all(),
    ).toHaveLength(0);
  });

  it("cancelWorkout cleans drafts even when FK enforcement is off (expo-sqlite default)", async () => {
    sqlite.pragma("foreign_keys = OFF");
    await upsertSessionSetDraft(slot(), { weight: 1 });
    await cancelWorkout(S1);
    expect(await drafts()).toHaveLength(0);
  });

  it("cascades from workout_sessions when FK enforcement is on", async () => {
    await upsertSessionSetDraft(slot(), { weight: 1 });
    await db.delete(workoutSessions).where(and(eq(workoutSessions.id, S1))).run();
    expect(await drafts()).toHaveLength(0);
  });

  it("resetAll clears every draft", async () => {
    await upsertSessionSetDraft(slot(), { weight: 1 });
    await upsertSessionSetDraft(slot({ sessionId: S2 }), { weight: 3 });
    await resetAll();
    expect(await drafts()).toHaveLength(0);
  });
});

describe("local-only guarantee", () => {
  it("draft writes never enqueue _outbox rows", async () => {
    sqlite.exec("DELETE FROM _outbox");
    await upsertSessionSetDraft(slot(), { weight: 1 });
    await upsertSessionSetDraft(slot(), { reps: 5 });
    await upsertSessionSetDraft(slot({ setIndex: 2 }), { weight: 2 });
    await clearSessionSetDraft(slot({ setIndex: 2 }));
    await clearDraftsForSession(S1);
    const rows = sqlite
      .prepare("SELECT * FROM _outbox WHERE table_name = 'session_set_drafts'")
      .all();
    expect(rows).toEqual([]);
  });

  it("has no capture triggers", () => {
    const triggers = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'session_set_drafts'")
      .all();
    expect(triggers).toEqual([]);
  });
});

describe("draft lookup helpers", () => {
  it("buildDraftKey is stable per slot and distinguishes warmups", () => {
    expect(buildDraftKey(EX, 1, false)).toBe(buildDraftKey(EX, 1, false));
    expect(buildDraftKey(EX, 1, false)).not.toBe(buildDraftKey(EX, 1, true));
    expect(buildDraftKey(EX, 1, false)).not.toBe(buildDraftKey(EX, 2, false));
    expect(buildDraftKey(EX, 1, false)).not.toBe(buildDraftKey(EX2, 1, false));
  });

  it("draftRowsToMap returns undefined while loading and a keyed map when loaded", async () => {
    expect(draftRowsToMap(undefined)).toBeUndefined();
    expect(draftRowsToMap([])).toEqual(new Map());

    await upsertSessionSetDraft(slot(), { weight: 80, reps: 8 });
    const map = draftRowsToMap(await drafts())!;
    expect(map.get(buildDraftKey(EX, 1, false))).toEqual({
      weight: 80,
      reps: 8,
      rpe: undefined,
    });
  });
});
