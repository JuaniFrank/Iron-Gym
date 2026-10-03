import type Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { pullChanges } from "@/services/sync/pull";
import { pushPending } from "@/services/sync/push";
import type { PulledChange } from "@/services/sync/remote";

import { createTestDb, type TestDb } from "../helpers/db";
import { FakeRemote } from "./fakeRemote";

const UID = "user-1";

let db: TestDb;
let sqlite: Database.Database;
let remote: FakeRemote;

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  remote = new FakeRemote();
});

type Row = Record<string, unknown>;
const all = (sql: string, ...params: unknown[]) => sqlite.prepare(sql).all(...params) as Row[];
const outbox = () => all("SELECT table_name, row_id, op FROM _outbox ORDER BY table_name, row_id");
const cursor = (table: string) =>
  all("SELECT value FROM _sync_state WHERE key = ?", `pull_cursor:${table}`)[0]?.value;
const applying = () => all("SELECT value FROM _sync_state WHERE key = 'applying'")[0].value;
const exercise = (id: string) => all("SELECT * FROM exercises WHERE id = ?", id)[0];

const exerciseData = (id: string, over: Row = {}): Row => ({
  id,
  name: "Squat",
  primary_muscle: "quads",
  type: "compound",
  is_preset: 0,
  updated_at: 1000,
  ...over,
});

/** Seed the fake remote directly (server clock increments per call order). */
function remoteDoc(
  table: string,
  rowId: string,
  updatedAt: number,
  data: Row | null,
  serverUpdatedAt: number,
) {
  const doc: PulledChange = {
    table,
    rowId,
    updatedAt,
    deleted: data === null,
    data,
    serverUpdatedAt,
  };
  remote.docs.set(`${UID}/${table}/${rowId}`, doc);
}

function insertExercise(id: string, updatedAt: number, name = "Local") {
  sqlite
    .prepare(
      `INSERT INTO exercises (id, name, primary_muscle, type, is_preset, updated_at)
       VALUES (?, ?, 'quads', 'compound', 0, ?)`,
    )
    .run(id, name, updatedAt);
}

function insertRoutineTree() {
  sqlite
    .prepare(
      `INSERT INTO routines (id, name, is_preset, created_at, updated_at)
       VALUES ('r1', 'Mine', 0, 1, 1)`,
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO routine_days (id, routine_id, name, position, updated_at)
       VALUES ('d1', 'r1', 'Day 1', 0, 1)`,
    )
    .run();
  sqlite.exec("DELETE FROM _outbox");
}

const routineData = (over: Row = {}): Row => ({
  id: "r1",
  name: "Renamed",
  is_preset: 0,
  created_at: 1,
  updated_at: 5000,
  ...over,
});

describe("pullChanges: apply rules", () => {
  it("inserts a new remote row and does not enqueue it", async () => {
    remoteDoc("exercises", "ex-1", 2000, exerciseData("ex-1", { updated_at: 2000 }), 10);
    const res = await pullChanges(db, remote, UID);

    expect(res).toEqual({ applied: 1 });
    expect(exercise("ex-1")).toMatchObject({ name: "Squat", updated_at: 2000 });
    expect(outbox()).toEqual([]);
    expect(applying()).toBe("0");
  });

  it("overwrites a local row when remote is newer", async () => {
    insertExercise("ex-1", 1000);
    sqlite.exec("DELETE FROM _outbox");
    remoteDoc("exercises", "ex-1", 2000, exerciseData("ex-1", { name: "Remote", updated_at: 2000 }), 10);
    await pullChanges(db, remote, UID);
    expect(exercise("ex-1")).toMatchObject({ name: "Remote", updated_at: 2000 });
  });

  it("keeps the local row when local is newer and leaves its outbox entry", async () => {
    insertExercise("ex-1", 3000);
    remoteDoc("exercises", "ex-1", 2000, exerciseData("ex-1", { name: "Remote", updated_at: 2000 }), 10);
    const res = await pullChanges(db, remote, UID);

    expect(res.applied).toBe(0);
    expect(exercise("ex-1")).toMatchObject({ name: "Local", updated_at: 3000 });
    expect(outbox()).toEqual([{ table_name: "exercises", row_id: "ex-1", op: "upsert" }]);
  });

  it("remote wins ties", async () => {
    insertExercise("ex-1", 2000);
    remoteDoc("exercises", "ex-1", 2000, exerciseData("ex-1", { name: "Remote", updated_at: 2000 }), 10);
    await pullChanges(db, remote, UID);
    expect(exercise("ex-1")).toMatchObject({ name: "Remote" });
  });

  it("clears a stale pending outbox entry when remote wins", async () => {
    insertExercise("ex-1", 1000);
    expect(outbox()).toHaveLength(1);
    remoteDoc("exercises", "ex-1", 2000, exerciseData("ex-1", { name: "Remote", updated_at: 2000 }), 10);
    await pullChanges(db, remote, UID);
    expect(outbox()).toEqual([]);
  });

  it("a tombstone deletes the local row and cascades children without enqueuing", async () => {
    insertRoutineTree();
    remoteDoc("routines", "r1", 5000, null, 10);
    const res = await pullChanges(db, remote, UID);

    expect(res.applied).toBe(1);
    expect(all("SELECT id FROM routines")).toEqual([]);
    expect(all("SELECT id FROM routine_days")).toEqual([]);
    expect(outbox()).toEqual([]);
  });

  it("a tombstone older than the local row is ignored", async () => {
    insertExercise("ex-1", 3000);
    remoteDoc("exercises", "ex-1", 2000, null, 10);
    const res = await pullChanges(db, remote, UID);
    expect(res.applied).toBe(0);
    expect(exercise("ex-1")).toBeDefined();
  });

  it("does not resurrect a row whose local delete is still pending", async () => {
    sqlite.exec(
      `INSERT INTO _outbox (table_name, row_id, op, queued_at)
       VALUES ('exercises', 'ex-1', 'delete', 5000)`,
    );
    remoteDoc("exercises", "ex-1", 2000, exerciseData("ex-1", { updated_at: 2000 }), 10);

    const res = await pullChanges(db, remote, UID);

    expect(res.applied).toBe(0);
    expect(exercise("ex-1")).toBeUndefined();
    expect(outbox()).toEqual([{ table_name: "exercises", row_id: "ex-1", op: "delete" }]);
  });

  it("a newer remote doc beats a pending local delete", async () => {
    sqlite.exec(
      `INSERT INTO _outbox (table_name, row_id, op, queued_at)
       VALUES ('exercises', 'ex-1', 'delete', 1000)`,
    );
    remoteDoc("exercises", "ex-1", 2000, exerciseData("ex-1", { updated_at: 2000 }), 10);

    await pullChanges(db, remote, UID);

    expect(exercise("ex-1")).toBeDefined();
    expect(outbox()).toEqual([]);
  });

  it("a tombstone for a missing row is a no-op", async () => {
    remoteDoc("exercises", "ghost", 2000, null, 10);
    const res = await pullChanges(db, remote, UID);
    expect(res.error).toBeUndefined();
    expect(res.applied).toBe(0);
    expect(cursor("exercises")).toBe("10");
  });

  it("upserting a parent does not delete its children (no REPLACE)", async () => {
    insertRoutineTree();
    remoteDoc("routines", "r1", 5000, routineData(), 10);
    await pullChanges(db, remote, UID);

    expect(all("SELECT name FROM routines WHERE id = 'r1'")).toEqual([{ name: "Renamed" }]);
    expect(all("SELECT id FROM routine_days")).toEqual([{ id: "d1" }]);
    expect(outbox()).toEqual([]);
  });

  it("ignores remote columns that do not exist locally", async () => {
    remoteDoc(
      "exercises",
      "ex-1",
      2000,
      exerciseData("ex-1", { updated_at: 2000, future_column: "x" }),
      10,
    );
    const res = await pullChanges(db, remote, UID);
    expect(res.error).toBeUndefined();
    expect(exercise("ex-1")).toMatchObject({ name: "Squat" });
  });

  it("handles a table whose primary key is not id (scheduled_routines)", async () => {
    remoteDoc("routines", "r1", 1, routineData({ updated_at: 1 }), 10);
    remoteDoc(
      "routine_days",
      "d1",
      1,
      { id: "d1", routine_id: "r1", name: "Day 1", position: 0, updated_at: 1 },
      11,
    );
    remoteDoc(
      "scheduled_routines",
      "3",
      2000,
      { day_of_week: 3, routine_id: "r1", routine_day_id: "d1", updated_at: 2000 },
      12,
    );
    const res = await pullChanges(db, remote, UID);
    expect(res.error).toBeUndefined();
    expect(all("SELECT day_of_week, routine_id FROM scheduled_routines")).toEqual([
      { day_of_week: 3, routine_id: "r1" },
    ]);

    // Newer remote update then tombstone, matched through CAST(pk AS TEXT).
    remoteDoc("scheduled_routines", "3", 3000, null, 13);
    await pullChanges(db, remote, UID);
    expect(all("SELECT * FROM scheduled_routines")).toEqual([]);
  });
});

describe("pullChanges: ordering and atomicity", () => {
  it("applies a parent and its child delivered in the same pull", async () => {
    remoteDoc("routines", "r1", 1, routineData({ updated_at: 1 }), 10);
    remoteDoc(
      "routine_days",
      "d1",
      1,
      { id: "d1", routine_id: "r1", name: "Day 1", position: 0, updated_at: 1 },
      11,
    );
    const res = await pullChanges(db, remote, UID);
    expect(res.error).toBeUndefined();
    expect(res.applied).toBe(2);
    expect(all("SELECT id FROM routine_days")).toEqual([{ id: "d1" }]);
  });

  it("rolls everything back (rows and cursors) when a parent never arrives", async () => {
    remoteDoc("exercises", "ex-1", 2000, exerciseData("ex-1", { updated_at: 2000 }), 10);
    remoteDoc(
      "routine_days",
      "d9",
      1,
      { id: "d9", routine_id: "missing", name: "Orphan", position: 0, updated_at: 1 },
      11,
    );
    const res = await pullChanges(db, remote, UID);

    expect(res.applied).toBe(0);
    expect(res.error).toBeDefined();
    expect(exercise("ex-1")).toBeUndefined();
    expect(all("SELECT id FROM routine_days")).toEqual([]);
    expect(cursor("exercises")).toBeUndefined();
    expect(cursor("routine_days")).toBeUndefined();
    expect(applying()).toBe("0");
    expect(outbox()).toEqual([]);
  });

  it("returns the error and changes nothing when the fetch fails", async () => {
    remote.pullSince = async () => {
      throw new Error("offline");
    };
    const res = await pullChanges(db, remote, UID);
    expect(res.applied).toBe(0);
    expect((res.error as Error).message).toBe("offline");
    expect(applying()).toBe("0");
  });
});

describe("pullChanges: cursors", () => {
  it("advances each table's cursor to the max serverUpdatedAt and never moves back", async () => {
    remoteDoc("exercises", "a", 2000, exerciseData("a", { updated_at: 2000 }), 40);
    remoteDoc("exercises", "b", 2000, exerciseData("b", { updated_at: 2000 }), 90);
    await pullChanges(db, remote, UID);
    expect(cursor("exercises")).toBe("90");
    expect(cursor("routines")).toBeUndefined();

    // Nothing new: cursor stays.
    await pullChanges(db, remote, UID);
    expect(cursor("exercises")).toBe("90");
  });

  it("re-fetches within the overlap window and re-applying is idempotent", async () => {
    remoteDoc("exercises", "a", 2000, exerciseData("a", { updated_at: 2000 }), 10_000);
    const calls: number[] = [];
    const orig = remote.pullSince.bind(remote);
    remote.pullSince = (uid, table, c) => {
      if (table === "exercises") calls.push(c);
      return orig(uid, table, c);
    };

    await pullChanges(db, remote, UID, { overlapMs: 5000 });
    const second = await pullChanges(db, remote, UID, { overlapMs: 5000 });

    expect(calls).toEqual([0, 5000]);
    // Re-delivered change ties on updated_at (remote wins) -> same data, no error.
    expect(second.error).toBeUndefined();
    expect(all("SELECT id, name FROM exercises")).toEqual([{ id: "a", name: "Squat" }]);
    expect(outbox()).toEqual([]);
    expect(cursor("exercises")).toBe("10000");
  });

  it("clamps the overlapped cursor at zero", async () => {
    const calls: number[] = [];
    remote.pullSince = async (_u, _t, c) => {
      calls.push(c);
      return { changes: [] };
    };
    await pullChanges(db, remote, UID, { overlapMs: 5000 });
    expect(new Set(calls)).toEqual(new Set([0]));
  });
});

describe("push -> pull round trip", () => {
  it("replicates device A rows (incl. a delete) into device B", async () => {
    insertRoutineTree();
    sqlite
      .prepare(
        `INSERT INTO exercises (id, name, primary_muscle, type, is_preset, updated_at)
         VALUES ('ex-1', 'Row', 'back', 'compound', 0, 777)`,
      )
      .run();
    sqlite.exec("INSERT INTO routines (id, name, is_preset, created_at, updated_at) VALUES ('r2','Gone',0,1,1)");
    // insertRoutineTree cleared the outbox before the inserts above; re-enqueue the tree.
    sqlite.exec("UPDATE routines SET name = name; UPDATE routine_days SET name = name");
    sqlite.exec("DELETE FROM routines WHERE id = 'r2'");

    expect((await pushPending(db, remote, UID)).error).toBeUndefined();

    const b = createTestDb();
    const res = await pullChanges(b.db, remote, UID);
    expect(res.error).toBeUndefined();

    const rows = (s: Database.Database, t: string) =>
      s.prepare(`SELECT * FROM ${t} ORDER BY 1`).all();
    for (const t of ["exercises", "routines", "routine_days"]) {
      expect(rows(b.sqlite, t)).toEqual(rows(sqlite, t));
    }
    expect(b.sqlite.prepare("SELECT * FROM _outbox").all()).toEqual([]);
  });
});
