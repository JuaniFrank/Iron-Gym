import type Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SyncProgressEvent } from "@/services/sync/progress";
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

  it("an orphan child fails alone: committed parent batches and cursors survive", async () => {
    // Parents sit in earlier batches (parent-first table order), so they commit
    // before the child batch is attempted. The orphan child batch rolls back
    // alone and is retried on the next cycle (when its parent has arrived).
    remoteDoc("exercises", "ex-1", 2000, exerciseData("ex-1", { updated_at: 2000 }), 10);
    remoteDoc(
      "routine_days",
      "d9",
      1,
      { id: "d9", routine_id: "missing", name: "Orphan", position: 0, updated_at: 1 },
      11,
    );
    const res = await pullChanges(db, remote, UID);

    expect(res.applied).toBe(1);
    expect(res.error).toBeDefined();
    expect(exercise("ex-1")).toBeDefined();
    expect(all("SELECT id FROM routine_days")).toEqual([]);
    expect(cursor("exercises")).toBe("10");
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

describe("pullChanges: batching", () => {
  const seedExercises = (n: number) => {
    for (let i = 1; i <= n; i++) {
      const id = `ex-${String(i).padStart(3, "0")}`;
      remoteDoc("exercises", id, 2000, exerciseData(id, { updated_at: 2000 }), i);
    }
  };

  it("applies each batch in its own transaction and advances the cursor per batch", async () => {
    seedExercises(60);
    const begins = vi.spyOn(sqlite, "exec");
    const seen: (unknown)[] = [];
    const yieldToUi = vi.fn(async () => {
      seen.push(cursor("exercises"));
    });

    const res = await pullChanges(db, remote, UID, { batchSize: 25, yieldToUi });

    expect(res).toEqual({ applied: 60 });
    expect(begins.mock.calls.filter(([q]) => q === "BEGIN")).toHaveLength(3);
    expect(yieldToUi).toHaveBeenCalledTimes(2);
    expect(seen).toEqual(["25", "50"]);
    expect(cursor("exercises")).toBe("60");
    expect(all("SELECT id FROM exercises")).toHaveLength(60);
  });

  it("does not yield when everything fits in one batch", async () => {
    seedExercises(3);
    const yieldToUi = vi.fn(async () => {});
    await pullChanges(db, remote, UID, { batchSize: 25, yieldToUi });
    expect(yieldToUi).not.toHaveBeenCalled();
  });

  it("a failing batch keeps earlier batches and their cursor, then the next call resumes", async () => {
    remoteDoc("routines", "r1", 1, routineData({ updated_at: 1 }), 5);
    for (let i = 1; i <= 30; i++) {
      const id = `d${String(i).padStart(2, "0")}`;
      // d30 (second batch) points at a routine that has not arrived yet.
      const routine = i === 30 ? "r2" : "r1";
      remoteDoc(
        "routine_days",
        id,
        1,
        { id, routine_id: routine, name: id, position: i, updated_at: 1 },
        100 + i,
      );
    }

    const first = await pullChanges(db, remote, UID, {
      batchSize: 25,
      overlapMs: 0,
      yieldToUi: async () => {},
    });

    expect(first.error).toBeDefined();
    expect(first.applied).toBe(26); // routine r1 + the 25 days of batch 1
    expect(all("SELECT id FROM routine_days")).toHaveLength(25);
    expect(cursor("routines")).toBe("5");
    expect(cursor("routine_days")).toBe("125");
    expect(applying()).toBe("0");

    remoteDoc("routines", "r2", 1, routineData({ id: "r2", updated_at: 1 }), 200);
    const second = await pullChanges(db, remote, UID, {
      batchSize: 25,
      overlapMs: 0,
      yieldToUi: async () => {},
    });

    expect(second.error).toBeUndefined();
    expect(all("SELECT id FROM routine_days")).toHaveLength(30);
    expect(cursor("routine_days")).toBe("130");
  });

  it("orders each table's changes by serverUpdatedAt across batches", async () => {
    // Insertion order is the reverse of server order.
    for (let i = 4; i >= 1; i--) {
      remoteDoc("exercises", `ex-${i}`, 2000, exerciseData(`ex-${i}`, { updated_at: 2000 }), i);
    }
    const seen: unknown[] = [];
    await pullChanges(db, remote, UID, {
      batchSize: 2,
      yieldToUi: async () => {
        seen.push(cursor("exercises"));
      },
    });
    expect(seen).toEqual(["2"]);
    expect(cursor("exercises")).toBe("4");
  });
});

describe("pullChanges: round trips per batch", () => {
  it("reads local rows and outbox entries once per batch, not once per row", async () => {
    for (let i = 1; i <= 25; i++) {
      insertExercise(`ex-${i}`, 1000); // also enqueues a stale outbox entry
      remoteDoc("exercises", `ex-${i}`, 2000, exerciseData(`ex-${i}`, { name: "R", updated_at: 2000 }), i);
    }
    const prepared: string[] = [];
    const orig = sqlite.prepare.bind(sqlite);
    vi.spyOn(sqlite, "prepare").mockImplementation(((q: string) => {
      prepared.push(q);
      return orig(q);
    }) as typeof sqlite.prepare);

    const res = await pullChanges(db, remote, UID, { batchSize: 25 });

    expect(res).toEqual({ applied: 25 });
    const count = (re: RegExp) => prepared.filter((q) => re.test(q)).length;
    expect(count(/^\s*select[^]*from "exercises"/i)).toBe(1);
    expect(count(/^\s*select[^]*from _outbox/i)).toBe(1);
    expect(count(/^\s*delete from _outbox/i)).toBe(1);
    expect(outbox()).toEqual([]);
  });

  it("handles batches larger than the bound-parameter chunk size", async () => {
    for (let i = 1; i <= 600; i++) {
      remoteDoc("exercises", `e${i}`, 2000, exerciseData(`e${i}`, { updated_at: 2000 }), i);
    }
    const res = await pullChanges(db, remote, UID, { batchSize: 600 });
    expect(res).toEqual({ applied: 600 });
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

describe("pullChanges: progress", () => {
  it("reports fetches per table and one apply event per committed batch", async () => {
    for (let i = 1; i <= 60; i++) {
      const id = `ex-${String(i).padStart(3, "0")}`;
      remoteDoc("exercises", id, 2000, exerciseData(id, { updated_at: 2000 }), i);
    }
    const events: SyncProgressEvent[] = [];

    const res = await pullChanges(db, remote, UID, {
      batchSize: 25,
      yieldToUi: async () => {},
      onProgress: (e) => events.push(e),
    });

    expect(res).toEqual({ applied: 60 });
    const fetches = events.filter((e) => e.phase === "pull-fetch");
    expect(fetches.length).toBeGreaterThan(1);
    expect(fetches[0]).toEqual({ phase: "pull-fetch", table: "exercises", fetched: 60 });
    expect(fetches.find((e) => e.phase === "pull-fetch" && e.table === "routines")).toEqual({
      phase: "pull-fetch",
      table: "routines",
      fetched: 0,
    });
    expect(events.filter((e) => e.phase === "pull-apply")).toEqual([
      { phase: "pull-apply", table: "exercises", done: 25, total: 60, applied: 25 },
      { phase: "pull-apply", table: "exercises", done: 50, total: 60, applied: 50 },
      { phase: "pull-apply", table: "exercises", done: 60, total: 60, applied: 60 },
    ]);
    // All fetches come before any apply.
    const firstApply = events.findIndex((e) => e.phase === "pull-apply");
    expect(events.slice(firstApply).some((e) => e.phase === "pull-fetch")).toBe(false);
  });

  it("counts rows that lost last-write-wins as done but not applied", async () => {
    sqlite.exec(
      `INSERT INTO exercises (id, name, primary_muscle, type, is_preset, updated_at)
       VALUES ('ex-1', 'Local', 'quads', 'compound', 0, 9000)`,
    );
    remoteDoc("exercises", "ex-1", 2000, exerciseData("ex-1", { updated_at: 2000 }), 1);
    const events: SyncProgressEvent[] = [];

    await pullChanges(db, remote, UID, { onProgress: (e) => events.push(e) });

    expect(events.filter((e) => e.phase === "pull-apply")).toEqual([
      { phase: "pull-apply", table: "exercises", done: 1, total: 1, applied: 0 },
    ]);
  });

  it("is a no-op when onProgress is omitted", async () => {
    remoteDoc("exercises", "ex-1", 2000, exerciseData("ex-1", { updated_at: 2000 }), 1);
    expect(await pullChanges(db, remote, UID)).toEqual({ applied: 1 });
  });
});
