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
const engineFor = (
  d: Device,
  getUid: () => string | null = () => uid,
  extra: { now?: () => number; notifyIntervalMs?: number } = {},
) => createSyncEngine({ db: d.db, remote, getUid, ...extra });

/** A clock that advances `step` ms on every read. */
const steppingClock = (step: number) => {
  let t = 1_000_000;
  return () => (t += step);
};

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
    // Progress ticks re-notify while syncing; only state changes matter here.
    const off = engine.subscribe((s) => {
      if (seen[seen.length - 1] !== s.state) seen.push(s.state);
    });

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

describe("status: activity, lastRun and log", () => {
  it("reports activity phases in order while syncing and clears it after", async () => {
    insertExercise(a, "e1", "FromA");
    await engineFor(a).syncNow();
    insertExercise(b, "e2", "FromB");
    const engine = engineFor(b, undefined, { now: steppingClock(1000) });
    const phases: string[] = [];
    engine.subscribe((s) => {
      const phase = s.activity?.phase;
      if (phase && phases[phases.length - 1] !== phase) phases.push(phase);
    });

    await engine.syncNow();

    expect(phases).toEqual(["backfill", "pull-fetch", "pull-apply", "push"]);
    expect(engine.getStatus().activity).toBeUndefined();
    expect(engine.getStatus().state).toBe("idle");
  });

  it("exposes the table and counts of the current activity", async () => {
    insertExercise(a, "e1");
    await engineFor(a).syncNow();
    insertExercise(b, "e2");
    const engine = engineFor(b, undefined, { now: steppingClock(1000) });
    const seen: SyncStatus["activity"][] = [];
    engine.subscribe((s) => s.activity && seen.push(s.activity));

    await engine.syncNow();

    expect(seen).toContainEqual({ phase: "pull-apply", table: "exercises", done: 1, total: 1 });
    expect(seen).toContainEqual({ phase: "push", done: 1, total: 1 });
  });

  it("fills lastRun with timing and counts", async () => {
    insertExercise(a, "e1");
    await engineFor(a).syncNow();
    insertExercise(b, "e2");
    const engine = engineFor(b, undefined, { now: steppingClock(10) });

    await engine.syncNow();

    const run = engine.getStatus().lastRun!;
    expect(run.pulled).toBe(1);
    expect(run.pushed).toBeGreaterThanOrEqual(1);
    expect(run.durationMs).toBeGreaterThan(0);
    expect(run.startedAt).toBeGreaterThan(1_000_000);
    expect(run.error).toBeUndefined();
  });

  it("logs run start, backfill, per-table pull, push and run end (newest first)", async () => {
    insertExercise(a, "e1");
    await engineFor(a).syncNow();
    insertExercise(b, "e2");
    const engine = engineFor(b, undefined, { now: steppingClock(10) });

    await engine.syncNow();

    const log = engine.getStatus().log;
    const messages = log.map((e) => e.message);
    expect(log.every((e) => e.level === "info")).toBe(true);
    expect(log.map((e) => e.at)).toEqual([...log.map((e) => e.at)].sort((x, y) => y - x));
    const idx = (re: RegExp) => messages.findIndex((m) => re.test(m));
    // Newest first: end < push < pull < backfill < start.
    expect(idx(/terminado/i)).toBe(0);
    expect(idx(/push/i)).toBeLessThan(idx(/pull exercises/i));
    expect(idx(/pull exercises/i)).toBeLessThan(idx(/backfill/i));
    expect(idx(/backfill/i)).toBeLessThan(idx(/iniciado/i));
    expect(messages.find((m) => /pull exercises/i.test(m))).toMatch(/1 recibidos?, 1 aplicados?/);
    // Tables without changes are not logged.
    expect(messages.some((m) => /pull routines/i.test(m))).toBe(false);
  });

  it("logs the backfill outcomes", async () => {
    insertExercise(a, "e1");
    const engine = engineFor(a);
    await engine.syncNow();
    expect(engine.getStatus().log.map((e) => e.message).join("\n")).toMatch(
      /backfill: \d+ encolad/i,
    );

    await engine.syncNow();
    expect(engine.getStatus().log.map((e) => e.message)).toContain("Backfill: ya hecho");
  });

  it("caps the log at 30 entries, newest first", async () => {
    const engine = engineFor(a, undefined, { now: steppingClock(5) });
    for (let i = 0; i < 12; i++) await engine.syncNow();

    const log = engine.getStatus().log;
    expect(log).toHaveLength(30);
    expect(log[0].message).toMatch(/terminado/i);
    expect(log.map((e) => e.at)).toEqual([...log.map((e) => e.at)].sort((x, y) => y - x));
  });

  it("logs the cause chain of a failed run and records it in lastRun", async () => {
    const boom = new Error("outer", { cause: new Error("inner") });
    vi.spyOn(remote, "pullSince").mockRejectedValue(boom);
    const engine = engineFor(a, undefined, { now: steppingClock(10) });

    await engine.syncNow();

    const status = engine.getStatus();
    const errors = status.log.filter((e) => e.level === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("outer ← inner");
    expect(status.lastRun?.error).toBe(boom);
    expect(status.activity).toBeUndefined();
  });

  it("logs an account mismatch as an error and ends the run", async () => {
    const engine = engineFor(a);
    await engine.syncNow();
    uid = "u2";

    await engine.syncNow();

    const status = engine.getStatus();
    expect(status.state).toBe("account_mismatch");
    expect(status.log.some((e) => e.level === "error" && /cuenta/i.test(e.message))).toBe(true);
    expect(status.lastRun).toBeDefined();
    expect(status.activity).toBeUndefined();
  });

  it("throttles progress notifications but always notifies state changes", async () => {
    for (let i = 0; i < 60; i++) insertExercise(a, `e${i}`);
    await engineFor(a).syncNow();

    const count = async (clock: () => number) => {
      const fresh = createTestDb();
      const engine = engineFor(fresh, undefined, { now: clock, notifyIntervalMs: 250 });
      const seen: SyncStatus[] = [];
      engine.subscribe((s) => seen.push(s));
      await engine.syncNow();
      return seen;
    };

    const frozen = await count(() => 1_000_000);
    const fast = await count(steppingClock(1000));

    expect(frozen.map((s) => s.state)).toEqual(["syncing", "idle"]);
    expect(fast.length).toBeGreaterThan(frozen.length + 5);
    expect(fast[fast.length - 1].state).toBe("idle");
  });
});
