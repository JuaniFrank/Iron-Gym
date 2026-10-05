import type Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SyncProgressEvent } from "@/services/sync/progress";
import { pushPending } from "@/services/sync/push";

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

type OutboxRow = { table_name: string; row_id: string; op: string; queued_at: number };
const outbox = () =>
  sqlite.prepare("SELECT * FROM _outbox ORDER BY queued_at, row_id").all() as OutboxRow[];

function insertExercise(id: string, updatedAt = 1000) {
  sqlite
    .prepare(
      `INSERT INTO exercises (id, name, primary_muscle, type, is_preset, updated_at)
       VALUES (?, 'Squat', 'quads', 'compound', 0, ?)`,
    )
    .run(id, updatedAt);
}

/** Pin queued_at so ordering/compare-and-delete tests are deterministic. */
const setQueuedAt = (table: string, rowId: string, at: number) =>
  sqlite
    .prepare("UPDATE _outbox SET queued_at = ? WHERE table_name = ? AND row_id = ?")
    .run(at, table, rowId);

describe("pushPending", () => {
  it("returns pushed 0 and does not call the remote on an empty outbox", async () => {
    const res = await pushPending(db, remote, UID);
    expect(res).toEqual({ pushed: 0 });
    expect(remote.pushCalls).toHaveLength(0);
  });

  it("sends the raw row for an upsert and clears the outbox", async () => {
    insertExercise("ex-1", 4242);
    const res = await pushPending(db, remote, UID);

    expect(res).toEqual({ pushed: 1 });
    expect(remote.pushCalls).toHaveLength(1);
    expect(remote.pushCalls[0].uid).toBe(UID);
    const [change] = remote.pushCalls[0].changes;
    expect(change).toMatchObject({
      table: "exercises",
      rowId: "ex-1",
      updatedAt: 4242,
      deleted: false,
    });
    // Raw SQL column names + raw stored values.
    expect(change.data).toMatchObject({
      id: "ex-1",
      name: "Squat",
      primary_muscle: "quads",
      is_preset: 0,
      updated_at: 4242,
    });
    expect(outbox()).toEqual([]);
  });

  it("sends a tombstone for a delete, stamped with queued_at", async () => {
    insertExercise("ex-1");
    sqlite.exec("DELETE FROM _outbox");
    sqlite.exec("DELETE FROM exercises WHERE id = 'ex-1'");
    setQueuedAt("exercises", "ex-1", 7777);

    await pushPending(db, remote, UID);

    expect(remote.pushCalls[0].changes).toEqual([
      { table: "exercises", rowId: "ex-1", updatedAt: 7777, deleted: true, data: null },
    ]);
    expect(outbox()).toEqual([]);
  });

  it("sends a tombstone when an upserted row no longer exists", async () => {
    insertExercise("ex-1");
    // Row vanishes without the trigger recording it (e.g. capture suppressed).
    sqlite.exec("UPDATE _sync_state SET value = '1' WHERE key = 'applying'");
    sqlite.exec("DELETE FROM exercises WHERE id = 'ex-1'");
    sqlite.exec("UPDATE _sync_state SET value = '0' WHERE key = 'applying'");
    setQueuedAt("exercises", "ex-1", 5555);

    await pushPending(db, remote, UID);

    expect(remote.pushCalls[0].changes).toEqual([
      { table: "exercises", rowId: "ex-1", updatedAt: 5555, deleted: true, data: null },
    ]);
    expect(outbox()).toEqual([]);
  });

  it("pushes tables with a non-id primary key", async () => {
    sqlite.exec(
      `INSERT INTO routines (id, name, is_preset, created_at, updated_at) VALUES ('r-1', 'R', 0, 1, 1)`,
    );
    sqlite.exec(
      `INSERT INTO routine_days (id, routine_id, name, position, updated_at) VALUES ('d-1', 'r-1', 'D', 0, 1)`,
    );
    sqlite.exec(
      `INSERT INTO scheduled_routines (day_of_week, routine_id, routine_day_id, updated_at)
       VALUES (3, 'r-1', 'd-1', 9)`,
    );

    await pushPending(db, remote, UID);

    const change = remote.get(UID, "scheduled_routines", "3");
    expect(change).toMatchObject({ rowId: "3", updatedAt: 9, deleted: false });
    expect(change?.data).toMatchObject({ day_of_week: 3, routine_id: "r-1" });
    expect(outbox()).toEqual([]);
  });

  it("drains the outbox in batches, oldest first", async () => {
    for (let i = 0; i < 5; i++) {
      insertExercise(`ex-${i}`);
      setQueuedAt("exercises", `ex-${i}`, 100 + i);
    }

    const res = await pushPending(db, remote, UID, { batchSize: 2 });

    expect(res).toEqual({ pushed: 5 });
    expect(remote.pushCalls.map((c) => c.changes.map((x) => x.rowId))).toEqual([
      ["ex-0", "ex-1"],
      ["ex-2", "ex-3"],
      ["ex-4"],
    ]);
    expect(outbox()).toEqual([]);
  });

  it("leaves the outbox intact and does not throw when the remote fails", async () => {
    insertExercise("ex-1");
    const boom = new Error("offline");
    remote.failWith = boom;

    const res = await pushPending(db, remote, UID);

    expect(res).toEqual({ pushed: 0, error: boom });
    expect(outbox()).toHaveLength(1);

    // Recovers on the next run.
    remote.failWith = null;
    expect(await pushPending(db, remote, UID)).toEqual({ pushed: 1 });
    expect(outbox()).toEqual([]);
  });

  it("stops after the failing round and keeps earlier rounds cleared", async () => {
    for (let i = 0; i < 3; i++) {
      insertExercise(`ex-${i}`);
      setQueuedAt("exercises", `ex-${i}`, 100 + i);
    }
    remote.onPush = () => {
      if (remote.pushCalls.length === 2) remote.failWith = new Error("boom");
    };

    const res = await pushPending(db, remote, UID, { batchSize: 2 });

    expect(res.pushed).toBe(2);
    expect(res.error).toBeInstanceOf(Error);
    expect(outbox().map((r) => r.row_id)).toEqual(["ex-2"]);
  });

  it("keeps an entry queued when the row is written again during the push", async () => {
    insertExercise("ex-1");
    setQueuedAt("exercises", "ex-1", 100);
    remote.onPush = () => {
      sqlite.exec("UPDATE exercises SET name = 'Front squat' WHERE id = 'ex-1'");
      setQueuedAt("exercises", "ex-1", 200);
      remote.onPush = null;
    };

    // One round only: the re-queued entry would otherwise be pushed again.
    const res = await pushPending(db, remote, UID, { batchSize: 1 });

    expect(res.error).toBeUndefined();
    expect(remote.pushCalls[0].changes[0].data).toMatchObject({ name: "Squat" });
    // The first round's entry survived (queued_at moved), so a 2nd round pushed the new row.
    expect(remote.pushCalls).toHaveLength(2);
    expect(remote.pushCalls[1].changes[0].data).toMatchObject({ name: "Front squat" });
    expect(outbox()).toEqual([]);
  });

  it("does not clear a re-queued entry (compare-and-delete)", async () => {
    insertExercise("ex-1");
    setQueuedAt("exercises", "ex-1", 100);
    let calls = 0;
    remote.onPush = () => {
      calls++;
      if (calls === 1) {
        sqlite.exec("UPDATE exercises SET name = 'Front squat' WHERE id = 'ex-1'");
        setQueuedAt("exercises", "ex-1", 200);
      } else {
        // Second round: stop the loop from clearing by failing.
        remote.failWith = new Error("stop");
      }
    };

    const res = await pushPending(db, remote, UID);

    expect(res.pushed).toBe(1);
    expect(outbox()).toMatchObject([{ row_id: "ex-1", queued_at: 200 }]);
  });

  it("skips and drops unknown tables without interpolating them into SQL", async () => {
    sqlite.exec(
      `INSERT INTO _outbox (table_name, row_id, op, queued_at)
       VALUES ('users; DROP TABLE exercises', '1', 'upsert', 1)`,
    );
    insertExercise("ex-1");

    const res = await pushPending(db, remote, UID);

    expect(res.error).toBeUndefined();
    expect(res.pushed).toBe(1);
    expect(remote.pushCalls.flatMap((c) => c.changes.map((x) => x.table))).toEqual([
      "exercises",
    ]);
    // The poisoned entry is discarded so it cannot wedge the queue.
    expect(outbox()).toEqual([]);
    expect(sqlite.prepare("SELECT count(*) AS n FROM exercises").get()).toEqual({ n: 1 });
  });

  it("reads the rows of a round with one query per table", async () => {
    for (let i = 0; i < 5; i++) insertExercise(`ex-${i}`);
    const prepared: string[] = [];
    const orig = sqlite.prepare.bind(sqlite);
    vi.spyOn(sqlite, "prepare").mockImplementation(((q: string) => {
      prepared.push(q);
      return orig(q);
    }) as typeof sqlite.prepare);

    const res = await pushPending(db, remote, UID, { batchSize: 5, yieldToUi: async () => {} });

    expect(res).toEqual({ pushed: 5 });
    expect(prepared.filter((q) => /^\s*select \*\s+from "exercises"/i.test(q))).toHaveLength(1);
    expect(remote.pushCalls[0].changes.map((c) => c.rowId).sort()).toEqual([
      "ex-0",
      "ex-1",
      "ex-2",
      "ex-3",
      "ex-4",
    ]);
  });

  it("yields to the UI between rounds but not after the last", async () => {
    for (let i = 0; i < 5; i++) {
      insertExercise(`ex-${i}`);
      setQueuedAt("exercises", `ex-${i}`, 100 + i);
    }
    const yieldToUi = vi.fn(async () => {});

    await pushPending(db, remote, UID, { batchSize: 2, yieldToUi });

    expect(yieldToUi).toHaveBeenCalledTimes(2);
  });
});

describe("pushPending: progress", () => {
  it("reports one event per round with cumulative counts and the initial total", async () => {
    for (let i = 0; i < 5; i++) {
      insertExercise(`ex-${i}`);
      setQueuedAt("exercises", `ex-${i}`, 100 + i);
    }
    const events: SyncProgressEvent[] = [];

    const res = await pushPending(db, remote, UID, {
      batchSize: 2,
      yieldToUi: async () => {},
      onProgress: (e) => events.push(e),
    });

    expect(res).toEqual({ pushed: 5 });
    expect(events).toEqual([
      { phase: "push", done: 2, total: 5, tables: { exercises: 2 } },
      { phase: "push", done: 4, total: 5, tables: { exercises: 4 } },
      { phase: "push", done: 5, total: 5, tables: { exercises: 5 } },
    ]);
  });

  it("emits nothing for an empty outbox", async () => {
    const events: SyncProgressEvent[] = [];
    await pushPending(db, remote, UID, { onProgress: (e) => events.push(e) });
    expect(events).toEqual([]);
  });
});
