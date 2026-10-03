import type Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSyncEngine, type SyncStatus } from "@/services/sync/engine";

import { createTestDb, type TestDb } from "../helpers/db";
import { FakeRemote } from "./fakeRemote";

type Row = Record<string, unknown>;
type Device = { db: TestDb; sqlite: Database.Database };

let a: Device;
let b: Device;
let remote: FakeRemote;
let uid: string | null;

const all = (d: Device, sql: string, ...p: unknown[]) => d.sqlite.prepare(sql).all(...p) as Row[];
const outboxCount = (d: Device) => all(d, "SELECT * FROM _outbox").length;
const engineFor = (d: Device, getUid: () => string | null = () => uid) =>
  createSyncEngine({ db: d.db, remote, getUid });

function insertExercise(d: Device, id: string, name = "Mine") {
  d.sqlite
    .prepare(
      `INSERT INTO exercises (id, name, primary_muscle, type, is_preset, updated_at)
       VALUES (?, ?, 'quads', 'compound', 0, 1000)`,
    )
    .run(id, name);
}

beforeEach(() => {
  a = createTestDb();
  b = createTestDb();
  remote = new FakeRemote();
  uid = "u1";
});

describe("syncNow", () => {
  it("is skipped without a uid and touches nothing", async () => {
    uid = null;
    insertExercise(a, "e1");
    const pull = vi.spyOn(remote, "pullSince");

    const result = await engineFor(a).syncNow();

    expect(result.status).toBe("skipped");
    expect(pull).not.toHaveBeenCalled();
    expect(remote.pushCalls).toEqual([]);
  });

  it("backfills pre-sync data so a second device converges", async () => {
    // Pre-sync rows: present locally, never captured.
    insertExercise(a, "e1", "Legacy");
    a.sqlite.exec("DELETE FROM _outbox");

    const ra = await engineFor(a).syncNow();
    expect(ra.status).toBe("synced");
    expect(outboxCount(a)).toBe(0);

    const rb = await engineFor(b).syncNow();
    expect(rb.status).toBe("synced");
    expect(all(b, "SELECT name FROM exercises WHERE id = 'e1'")).toEqual([{ name: "Legacy" }]);
  });

  it("propagates later edits and deletes between devices", async () => {
    const ea = engineFor(a);
    const eb = engineFor(b);
    insertExercise(a, "e1");
    await ea.syncNow();
    await eb.syncNow();

    a.sqlite.exec("UPDATE exercises SET name = 'Edited', updated_at = 2000 WHERE id = 'e1'");
    await ea.syncNow();
    await eb.syncNow();
    expect(all(b, "SELECT name FROM exercises WHERE id = 'e1'")).toEqual([{ name: "Edited" }]);

    a.sqlite.exec("DELETE FROM exercises WHERE id = 'e1'");
    await ea.syncNow();
    await eb.syncNow();
    expect(all(b, "SELECT id FROM exercises WHERE id = 'e1'")).toEqual([]);
  });

  it("shares one in-flight run and schedules exactly one follow-up", async () => {
    const engine = engineFor(a);
    const pull = vi.spyOn(remote, "pullSince");

    const calls = [engine.syncNow(), engine.syncNow(), engine.syncNow()];
    const results = await Promise.all(calls);

    // 19 syncable tables are pulled per run: 2 runs, not 1 and not 3.
    expect(pull.mock.calls.length % 2).toBe(0);
    const perRun = pull.mock.calls.length / 2;
    expect(perRun).toBeGreaterThan(0);
    expect(new Set(results.map((r) => r.status))).toEqual(new Set(["synced"]));
    // After settling, a fresh call starts a fresh single run.
    pull.mockClear();
    await engine.syncNow();
    expect(pull.mock.calls.length).toBe(perRun);
  });

  it("a single call runs exactly once", async () => {
    const pull = vi.spyOn(remote, "pullSince");
    await engineFor(a).syncNow();
    const once = pull.mock.calls.length;
    expect(once).toBeGreaterThan(0);
    pull.mockClear();
    await Promise.all([engineFor(a).syncNow()]);
    expect(pull.mock.calls.length).toBe(once);
  });

  it("still pushes when pull fails, and reports the error", async () => {
    insertExercise(a, "e1");
    vi.spyOn(remote, "pullSince").mockRejectedValue(new Error("pull down"));
    const engine = engineFor(a);

    const result = await engine.syncNow();

    expect(result.status).toBe("error");
    expect((result.error as Error).message).toBe("pull down");
    expect(remote.get("u1", "exercises", "e1")).toBeDefined();
    expect(engine.getStatus().state).toBe("error");
  });

  it("reports push failure, keeps the outbox, and recovers on the next run", async () => {
    insertExercise(a, "e1");
    remote.failWith = new Error("offline");
    const engine = engineFor(a);

    const failed = await engine.syncNow();
    expect(failed.status).toBe("error");
    expect(engine.getStatus()).toMatchObject({ state: "error" });
    expect(outboxCount(a)).toBeGreaterThan(0);

    remote.failWith = null;
    const ok = await engine.syncNow();
    expect(ok.status).toBe("synced");
    expect(outboxCount(a)).toBe(0);
    expect(engine.getStatus().state).toBe("idle");
    expect(engine.getStatus().lastSyncedAt).toBeTypeOf("number");
    expect(remote.get("u1", "exercises", "e1")).toBeDefined();
  });

  it("stops at account_mismatch before pull or push", async () => {
    const engine = engineFor(a);
    await engine.syncNow(); // backfills for u1
    insertExercise(a, "e1");
    uid = "u2";
    const pull = vi.spyOn(remote, "pullSince");
    remote.pushCalls.length = 0;

    const result = await engine.syncNow();

    expect(result.status).toBe("account_mismatch");
    expect(pull).not.toHaveBeenCalled();
    expect(remote.pushCalls).toEqual([]);
    expect(engine.getStatus().state).toBe("account_mismatch");
  });

  it("notifies subscribers of status changes until unsubscribed", async () => {
    const engine = engineFor(a);
    const seen: SyncStatus["state"][] = [];
    const off = engine.subscribe((s) => seen.push(s.state));

    await engine.syncNow();
    expect(seen).toEqual(["syncing", "idle"]);

    off();
    await engine.syncNow();
    expect(seen).toEqual(["syncing", "idle"]);
  });

  it("never throws, even if the uid getter does", async () => {
    const engine = engineFor(a, () => {
      throw new Error("boom");
    });
    const result = await engine.syncNow();
    expect(result.status).toBe("error");
  });
});
