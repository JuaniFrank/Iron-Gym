// Sync change-capture: AFTER INSERT/UPDATE/DELETE triggers feed `_outbox`.
// Runs against the real migrations on better-sqlite3 (FKs ON, like expo).

import type Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { createTestDb } from "../helpers/db";

type OutboxRow = { table_name: string; row_id: string; op: string; queued_at: number };

let sqlite: Database.Database;

beforeEach(() => {
  ({ sqlite } = createTestDb());
});

const outbox = (): OutboxRow[] =>
  sqlite
    .prepare("SELECT * FROM _outbox ORDER BY table_name, row_id")
    .all() as OutboxRow[];

const clearOutbox = () => sqlite.exec("DELETE FROM _outbox");

function insertExercise(id: string, isPreset = 0) {
  sqlite
    .prepare(
      `INSERT INTO exercises (id, name, primary_muscle, type, is_preset, updated_at)
       VALUES (?, 'Squat', 'quads', 'compound', ?, 1)`,
    )
    .run(id, isPreset);
}

function insertSession(id: string) {
  sqlite
    .prepare(
      `INSERT INTO workout_sessions
         (id, routine_name, day_name, started_at, exercise_order, updated_at)
       VALUES (?, 'R', 'D', 1, '[]', 1)`,
    )
    .run(id);
}

function insertSet(id: string, sessionId: string, exerciseId: string) {
  sqlite
    .prepare(
      `INSERT INTO completed_sets
         (id, session_id, exercise_id, weight, reps, is_warmup, set_index, completed_at, updated_at)
       VALUES (?, ?, ?, 100, 5, 0, 0, 1, 1)`,
    )
    .run(id, sessionId, exerciseId);
}

describe("sync capture triggers", () => {
  it("seeds _sync_state.applying = '0'", () => {
    const row = sqlite
      .prepare("SELECT value FROM _sync_state WHERE key = 'applying'")
      .get() as { value: string };
    expect(row.value).toBe("0");
  });

  it("enqueues an upsert on insert", () => {
    insertExercise("ex-1");
    const rows = outbox();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ table_name: "exercises", row_id: "ex-1", op: "upsert" });
    expect(Math.abs(rows[0].queued_at - Date.now())).toBeLessThan(5_000);
  });

  it("enqueues an upsert on update", () => {
    insertExercise("ex-1");
    clearOutbox();
    sqlite.prepare("UPDATE exercises SET name = 'Front squat' WHERE id = 'ex-1'").run();
    expect(outbox()).toMatchObject([
      { table_name: "exercises", row_id: "ex-1", op: "upsert" },
    ]);
  });

  it("keeps a single entry for repeated updates", () => {
    insertExercise("ex-1");
    for (let i = 0; i < 3; i++) {
      sqlite.prepare("UPDATE exercises SET name = ? WHERE id = 'ex-1'").run(`n${i}`);
    }
    expect(outbox()).toHaveLength(1);
  });

  it("enqueues a delete on delete and replaces a pending upsert", () => {
    insertExercise("ex-1");
    sqlite.prepare("DELETE FROM exercises WHERE id = 'ex-1'").run();
    expect(outbox()).toMatchObject([
      { table_name: "exercises", row_id: "ex-1", op: "delete" },
    ]);
  });

  it("re-insert after delete flips the entry back to upsert", () => {
    insertExercise("ex-1");
    sqlite.prepare("DELETE FROM exercises WHERE id = 'ex-1'").run();
    insertExercise("ex-1");
    expect(outbox()).toMatchObject([{ row_id: "ex-1", op: "upsert" }]);
  });

  it("ignores preset rows on insert, update and delete", () => {
    insertExercise("p-1", 1);
    sqlite.prepare("UPDATE exercises SET name = 'x' WHERE id = 'p-1'").run();
    sqlite.prepare("DELETE FROM exercises WHERE id = 'p-1'").run();
    expect(outbox()).toEqual([]);
  });

  it("ignores key_value and feature_discoveries", () => {
    sqlite
      .prepare("INSERT INTO key_value (key, value, updated_at) VALUES ('k', '1', 1)")
      .run();
    sqlite.prepare("UPDATE key_value SET value = '2' WHERE key = 'k'").run();
    sqlite
      .prepare("INSERT INTO feature_discoveries (feature_id, status) VALUES ('f', 'seen')")
      .run();
    sqlite.prepare("DELETE FROM feature_discoveries WHERE feature_id = 'f'").run();
    expect(outbox()).toEqual([]);
  });

  it("does not capture while applying = '1' and resumes after", () => {
    sqlite.prepare("UPDATE _sync_state SET value = '1' WHERE key = 'applying'").run();
    insertExercise("ex-1");
    sqlite.prepare("UPDATE exercises SET name = 'y' WHERE id = 'ex-1'").run();
    sqlite.prepare("DELETE FROM exercises WHERE id = 'ex-1'").run();
    expect(outbox()).toEqual([]);

    sqlite.prepare("UPDATE _sync_state SET value = '0' WHERE key = 'applying'").run();
    insertExercise("ex-2");
    expect(outbox()).toHaveLength(1);
  });

  it("encodes non-id primary keys as text", () => {
    sqlite
      .prepare("INSERT INTO routines (id, name, created_at, updated_at) VALUES ('r', 'R', 1, 1)")
      .run();
    sqlite
      .prepare(
        "INSERT INTO routine_days (id, routine_id, name, position, updated_at) VALUES ('d', 'r', 'D', 0, 1)",
      )
      .run();
    clearOutbox();
    sqlite
      .prepare(
        `INSERT INTO scheduled_routines (day_of_week, routine_id, routine_day_id, updated_at)
         VALUES (3, 'r', 'd', 1)`,
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO session_plans (date_key, routine_id, routine_day_id, exercises, updated_at)
         VALUES ('2026-01-02', 'r', 'd', '[]', 1)`,
      )
      .run();
    expect(outbox()).toMatchObject([
      { table_name: "scheduled_routines", row_id: "3", op: "upsert" },
      { table_name: "session_plans", row_id: "2026-01-02", op: "upsert" },
    ]);
  });

  it("enqueues delete tombstones for FK-cascaded children", () => {
    insertExercise("ex-1");
    insertSession("s-1");
    insertSet("set-1", "s-1", "ex-1");
    insertSet("set-2", "s-1", "ex-1");
    clearOutbox();

    sqlite.prepare("DELETE FROM workout_sessions WHERE id = 's-1'").run();

    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM completed_sets").get()).toEqual({ n: 0 });
    expect(outbox()).toMatchObject([
      { table_name: "completed_sets", row_id: "set-1", op: "delete" },
      { table_name: "completed_sets", row_id: "set-2", op: "delete" },
      { table_name: "workout_sessions", row_id: "s-1", op: "delete" },
    ]);
  });
});
