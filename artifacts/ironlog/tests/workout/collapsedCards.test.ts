// Active workout · collapsed exercise cards persisted per session
// (ironlog-workout-input-fixes T6). Stored in the local-only `key_value`
// table, never synced.

import type Database from "better-sqlite3";
import { keyValue } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  collapsedKey,
  parseCollapsed,
  resolveCollapsed,
  serializeCollapsed,
  withCollapsed,
} from "@/domains/workout/collapsedCards";
import {
  cancelWorkout,
  finishWorkout,
  setExerciseCollapsed,
} from "@/domains/workout/mutators";

import { createTestDb, type TestDb } from "../helpers/db";

describe("collapsed cards helpers", () => {
  it("scopes the key per session", () => {
    expect(collapsedKey("s1")).not.toBe(collapsedKey("s2"));
  });

  it("parses a stored id list into a lookup", () => {
    expect(parseCollapsed(["a", "b"])).toEqual({ a: true, b: true });
  });

  it("ignores missing, malformed and non-string stored values", () => {
    expect(parseCollapsed(undefined)).toEqual({});
    expect(parseCollapsed(null)).toEqual({});
    expect(parseCollapsed("a")).toEqual({});
    expect(parseCollapsed({ a: true })).toEqual({});
    expect(parseCollapsed(["a", 3, null, "b"])).toEqual({ a: true, b: true });
  });

  it("serializes only collapsed ids, sorted for stable output", () => {
    expect(serializeCollapsed({ b: true, a: true, c: false })).toEqual(["a", "b"]);
  });

  it("adds and removes an id immutably", () => {
    const base = { a: true };
    expect(withCollapsed(base, "b", true)).toEqual({ a: true, b: true });
    expect(withCollapsed(base, "a", false)).toEqual({});
    expect(base).toEqual({ a: true });
  });
});

let db: TestDb;
let sqlite: Database.Database;

const stored = async (sessionId: string) =>
  (
    await db.select().from(keyValue).where(eq(keyValue.key, collapsedKey(sessionId))).all()
  )[0]?.value;

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  for (const id of ["s1", "s2"]) {
    sqlite
      .prepare(
        `INSERT INTO workout_sessions
           (id, routine_name, day_name, started_at, exercise_order, updated_at)
         VALUES (?, 'R', 'D', 1, '[]', 1)`,
      )
      .run(id);
  }
});

describe("setExerciseCollapsed", () => {
  it("persists collapsed exercises per session", async () => {
    await setExerciseCollapsed("s1", "ex-a", true);
    await setExerciseCollapsed("s1", "ex-b", true);
    await setExerciseCollapsed("s2", "ex-c", true);
    expect(await stored("s1")).toEqual(["ex-a", "ex-b"]);
    expect(await stored("s2")).toEqual(["ex-c"]);
  });

  it("expanding removes the id, and the row when nothing is collapsed", async () => {
    await setExerciseCollapsed("s1", "ex-a", true);
    await setExerciseCollapsed("s1", "ex-b", true);
    await setExerciseCollapsed("s1", "ex-a", false);
    expect(await stored("s1")).toEqual(["ex-b"]);
    await setExerciseCollapsed("s1", "ex-b", false);
    expect(await stored("s1")).toBeUndefined();
  });

  it("is dropped when the session is finished or cancelled", async () => {
    await setExerciseCollapsed("s1", "ex-a", true);
    await setExerciseCollapsed("s2", "ex-a", true);
    await cancelWorkout("s1");
    expect(await stored("s1")).toBeUndefined();
    expect(await stored("s2")).toEqual(["ex-a"]);
    await finishWorkout("s2");
    expect(await stored("s2")).toBeUndefined();
  });

  it("never enqueues _outbox rows (local-only)", async () => {
    sqlite.exec("DELETE FROM _outbox");
    await setExerciseCollapsed("s1", "ex-a", true);
    await setExerciseCollapsed("s1", "ex-a", false);
    expect(sqlite.prepare("SELECT * FROM _outbox").all()).toEqual([]);
  });
});

describe("resolveCollapsed", () => {
  it("waits only while loading without an error", () => {
    expect(resolveCollapsed({ loaded: false, data: undefined, error: undefined })).toBeUndefined();
  });

  it("falls back to an empty set when the query failed", () => {
    expect(resolveCollapsed({ loaded: false, data: undefined, error: new Error("x") })).toEqual({});
  });

  it("reads the stored row, or an empty set when the row is absent", () => {
    expect(resolveCollapsed({ loaded: true, data: [{ value: ["a"] }], error: undefined })).toEqual({ a: true });
    expect(resolveCollapsed({ loaded: true, data: [], error: undefined })).toEqual({});
  });
});
