import type Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { backfillIfNeeded } from "@/services/sync/backfill";

import { createTestDb, type TestDb } from "../helpers/db";

let db: TestDb;
let sqlite: Database.Database;

type Row = Record<string, unknown>;
const all = (sql: string, ...params: unknown[]) => sqlite.prepare(sql).all(...params) as Row[];
const outbox = () =>
  all("SELECT table_name, row_id, op, queued_at FROM _outbox ORDER BY table_name, row_id");
const outboxKeys = () => outbox().map((r) => `${r.table_name}/${r.row_id}`);

function seedData() {
  const run = (sql: string) => sqlite.exec(sql);
  run(`INSERT INTO exercises (id, name, primary_muscle, type, is_preset, updated_at)
       VALUES ('ex-user', 'Mine', 'quads', 'compound', 0, 1),
              ('ex-preset', 'Preset', 'quads', 'compound', 1, 1)`);
  run(`INSERT INTO routines (id, name, is_preset, created_at, updated_at)
       VALUES ('r-user', 'Mine', 0, 1, 1), ('r-preset', 'Preset', 1, 1, 1)`);
  run(`INSERT INTO routine_days (id, routine_id, name, position, updated_at)
       VALUES ('d-user', 'r-user', 'Day', 0, 1), ('d-preset', 'r-preset', 'Day', 0, 1)`);
  run(`INSERT INTO routine_exercises
         (id, routine_day_id, exercise_id, position, target_sets, target_reps, rest_seconds, updated_at)
       VALUES ('re-user', 'd-user', 'ex-user', 0, 3, 5, 60, 1),
              ('re-preset', 'd-preset', 'ex-preset', 0, 3, 5, 60, 1)`);
  run(`INSERT INTO body_weights (id, date, weight_kg, updated_at) VALUES ('bw1', 1, 80, 1)`);
}

/** Simulate pre-sync data: rows exist, nothing captured. */
function clearOutbox() {
  sqlite.exec("DELETE FROM _outbox");
}

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedData();
  clearOutbox();
});

describe("backfillIfNeeded", () => {
  it("enqueues every existing user row as an upsert and records the uid", () => {
    const result = backfillIfNeeded(db, "u1");

    expect(result.status).toBe("backfilled");
    expect(outboxKeys()).toEqual(
      expect.arrayContaining([
        "exercises/ex-user",
        "routines/r-user",
        "routine_days/d-user",
        "routine_exercises/re-user",
        "body_weights/bw1",
      ]),
    );
    expect(outbox().every((r) => r.op === "upsert")).toBe(true);
    expect(result.enqueued).toBe(outbox().length);
    expect(
      all("SELECT value FROM _sync_state WHERE key = 'backfilled_uid'")[0]?.value,
    ).toBe("u1");
  });

  it("excludes preset rows and the children of preset routines", () => {
    backfillIfNeeded(db, "u1");
    const keys = outboxKeys();

    expect(keys).not.toContain("exercises/ex-preset");
    expect(keys).not.toContain("routines/r-preset");
    expect(keys).not.toContain("routine_days/d-preset");
    expect(keys).not.toContain("routine_exercises/re-preset");
  });

  it("keeps existing pending entries untouched", () => {
    sqlite.exec(
      `INSERT INTO _outbox (table_name, row_id, op, queued_at)
       VALUES ('exercises', 'ex-user', 'delete', 42)`,
    );

    backfillIfNeeded(db, "u1");

    const kept = outbox().find((r) => r.row_id === "ex-user");
    expect(kept).toMatchObject({ op: "delete", queued_at: 42 });
  });

  it("is a no-op the second time for the same uid", () => {
    backfillIfNeeded(db, "u1");
    clearOutbox();

    const again = backfillIfNeeded(db, "u1");

    expect(again.status).toBe("already_done");
    expect(outbox()).toEqual([]);
  });

  it("refuses a different uid without enqueueing", () => {
    backfillIfNeeded(db, "u1");
    clearOutbox();

    const result = backfillIfNeeded(db, "u2");

    expect(result.status).toBe("account_mismatch");
    expect(outbox()).toEqual([]);
    expect(
      all("SELECT value FROM _sync_state WHERE key = 'backfilled_uid'")[0]?.value,
    ).toBe("u1");
  });
});
