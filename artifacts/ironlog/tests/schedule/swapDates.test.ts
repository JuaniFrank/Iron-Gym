// Schedule · characterization of the mutators the day swap sheet drives
// (`swapDates`, `setOverrideForDate`, `clearOverrideForDate`) plus the
// `applyDayMutation` dispatcher, against the real async DB (FKs ON).
//
// `schedule_overrides` is a synced table: every write must reach `_outbox`.

import type Database from "better-sqlite3";
import { isNull } from "drizzle-orm";
import { scheduledRoutines, scheduleOverrides } from "@workspace/db/schema";
import { beforeEach, describe, expect, it } from "vitest";

import {
  applyDayMutation,
  clearOverrideForDate,
  setOverrideForDate,
  swapDates,
} from "@/domains/schedule/mutators";
import { resolvePlanFor } from "@/domains/schedule/queries";
import {
  availableActions,
  buildWeekDays,
  dropMutation,
  makeTodayMutation,
  rescheduleMutation,
  skipMutation,
  resetMutation,
} from "@/domains/schedule/daySwap";
import type { ResolvedPlan, ScheduledRoutine, ScheduleOverride } from "@/types";
import { dateKey } from "@/utils/date";

import { createTestDb, type TestDb } from "../helpers/db";

// Week of Mon 2026-10-05 .. Sun 2026-10-11; today = Wednesday.
const at = (day: number) => new Date(2026, 9, day).getTime();
const MON = at(5);
const TUE = at(6);
const WED = at(7);
const THU = at(8);
const FRI = at(9);
const SAT = at(10);

let db: TestDb;
let sqlite: Database.Database;

function insertRoutine(id: string, dayId: string) {
  sqlite
    .prepare(
      `INSERT INTO routines (id, name, is_preset, created_at, updated_at) VALUES (?, ?, 0, 1, 1)`,
    )
    .run(id, `Routine ${id}`);
  sqlite
    .prepare(
      `INSERT INTO routine_days (id, routine_id, name, position, updated_at) VALUES (?, ?, ?, 0, 1)`,
    )
    .run(dayId, id, `Day ${dayId}`);
}

function schedule(dayOfWeek: number, routineId: string, routineDayId: string) {
  sqlite
    .prepare(
      `INSERT INTO scheduled_routines (day_of_week, routine_id, routine_day_id, updated_at) VALUES (?, ?, ?, 1)`,
    )
    .run(dayOfWeek, routineId, routineDayId);
}

type OverrideRow = {
  date_key: string;
  routine_id: string | null;
  routine_day_id: string | null;
  deleted_at: number | null;
};
const overrideRows = () =>
  sqlite
    .prepare("SELECT * FROM schedule_overrides ORDER BY date_key")
    .all() as OverrideRow[];
const overrideFor = (ts: number) =>
  overrideRows().find((r) => r.date_key === dateKey(ts));
const outbox = () =>
  sqlite
    .prepare(
      "SELECT row_id, op FROM _outbox WHERE table_name = 'schedule_overrides' ORDER BY row_id, op",
    )
    .all() as { row_id: string; op: string }[];

async function resolve(ts: number): Promise<ResolvedPlan> {
  const overrides = (await db
    .select()
    .from(scheduleOverrides)
    .where(isNull(scheduleOverrides.deletedAt))
    .all()) as unknown as ScheduleOverride[];
  const sched = (await db.select().from(scheduledRoutines).all()) as ScheduledRoutine[];
  return resolvePlanFor(ts, overrides, sched);
}

const A = { routineId: "r-a", routineDayId: "d-a" };
const B = { routineId: "r-b", routineDayId: "d-b" };

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  insertRoutine("r-a", "d-a");
  insertRoutine("r-b", "d-b");
  // Weekly schedule: Mon = A, Wed = B, Fri = A (dayOfWeek 0 = Monday).
  schedule(0, "r-a", "d-a");
  schedule(2, "r-b", "d-b");
  schedule(4, "r-a", "d-a");
  sqlite.exec("DELETE FROM _outbox");
});

describe("setOverrideForDate", () => {
  it("writes a training override for the date", async () => {
    await setOverrideForDate(TUE, B);
    expect(overrideFor(TUE)).toMatchObject({
      routine_id: "r-b",
      routine_day_id: "d-b",
      deleted_at: null,
    });
    expect(await resolve(TUE)).toEqual({ kind: "training", ...B, isOverride: true });
  });

  it("a null plan records an explicit rest override on a training day", async () => {
    await setOverrideForDate(MON, null);
    expect(overrideFor(MON)).toMatchObject({ routine_id: null, routine_day_id: null });
    expect(await resolve(MON)).toEqual({ kind: "rest", isOverride: true });
  });

  it("upserts: a second write for the same date replaces the first", async () => {
    await setOverrideForDate(TUE, A);
    await setOverrideForDate(TUE, B);
    expect(overrideRows()).toHaveLength(1);
    expect(overrideFor(TUE)).toMatchObject({ routine_id: "r-b" });
  });

  it("rejects a blank routine id and writes nothing", async () => {
    await expect(
      setOverrideForDate(TUE, { routineId: "", routineDayId: "d-a" }),
    ).rejects.toThrow();
    expect(overrideRows()).toHaveLength(0);
  });

  it("revives a soft-deleted override row", async () => {
    sqlite
      .prepare(
        `INSERT INTO schedule_overrides (date_key, routine_id, routine_day_id, created_at, updated_at, deleted_at)
         VALUES (?, NULL, NULL, 1, 1, 5)`,
      )
      .run(dateKey(TUE));
    await setOverrideForDate(TUE, A);
    expect(overrideFor(TUE)).toMatchObject({ routine_id: "r-a", deleted_at: null });
  });
});

describe("clearOverrideForDate", () => {
  it("deletes the override and the weekly schedule shows through again", async () => {
    await setOverrideForDate(MON, null);
    await clearOverrideForDate(MON);
    expect(overrideRows()).toHaveLength(0);
    expect(await resolve(MON)).toEqual({ kind: "training", ...A, isOverride: false });
  });

  it("is a no-op for a date without override", async () => {
    await expect(clearOverrideForDate(MON)).resolves.toBeUndefined();
    expect(overrideRows()).toHaveLength(0);
  });
});

describe("swapDates", () => {
  it("swaps two training dates by writing an override on both", async () => {
    await swapDates(MON, WED); // Mon = A, Wed = B
    expect(await resolve(MON)).toEqual({ kind: "training", ...B, isOverride: true });
    expect(await resolve(WED)).toEqual({ kind: "training", ...A, isOverride: true });
    expect(overrideRows()).toHaveLength(2);
  });

  it("moves a training day onto a rest day: the source becomes an explicit rest", async () => {
    await swapDates(MON, TUE); // Mon = A, Tue = natural rest
    expect(await resolve(TUE)).toEqual({ kind: "training", ...A, isOverride: true });
    expect(await resolve(MON)).toEqual({ kind: "rest", isOverride: true });
    expect(overrideFor(MON)).toMatchObject({ routine_id: null, routine_day_id: null });
  });

  it("works against existing overrides, not only the weekly schedule", async () => {
    await setOverrideForDate(TUE, B); // Tue = B (override)
    await swapDates(MON, TUE); // Mon = A <-> Tue = B
    expect(await resolve(MON)).toEqual({ kind: "training", ...B, isOverride: true });
    expect(await resolve(TUE)).toEqual({ kind: "training", ...A, isOverride: true });
  });

  it("treats a skipped (rest override) target as a free day", async () => {
    await setOverrideForDate(WED, null); // Wed skipped
    await swapDates(MON, WED);
    expect(await resolve(WED)).toEqual({ kind: "training", ...A, isOverride: true });
    expect(await resolve(MON)).toEqual({ kind: "rest", isOverride: true });
  });

  it("ignores soft-deleted override rows when resolving each side", async () => {
    sqlite
      .prepare(
        `INSERT INTO schedule_overrides (date_key, routine_id, routine_day_id, created_at, updated_at, deleted_at)
         VALUES (?, NULL, NULL, 1, 1, 5)`,
      )
      .run(dateKey(MON)); // ghost: would turn Monday into rest if honoured
    await swapDates(MON, TUE);
    expect(await resolve(TUE)).toEqual({ kind: "training", ...A, isOverride: true });
  });

  it("is a no-op for the same calendar date", async () => {
    await swapDates(MON, MON + 3_600_000);
    expect(overrideRows()).toHaveLength(0);
  });

  it("swapping twice restores the resolved plans (overrides stay as explicit rows)", async () => {
    await swapDates(MON, TUE);
    await swapDates(MON, TUE);
    expect(await resolve(MON)).toEqual({ kind: "training", ...A, isOverride: true });
    expect(await resolve(TUE)).toEqual({ kind: "rest", isOverride: true });
  });

  it("is atomic: if the second write fails the first is rolled back", async () => {
    sqlite.exec(`
      CREATE TRIGGER boom BEFORE INSERT ON schedule_overrides
      WHEN NEW.date_key = '${dateKey(TUE)}'
      BEGIN SELECT RAISE(ABORT, 'boom'); END;
    `);
    await expect(swapDates(MON, TUE)).rejects.toThrow();
    expect(overrideRows()).toHaveLength(0);
    // And the DB lock is released: the next write still goes through.
    await setOverrideForDate(THU, null);
    expect(overrideRows()).toHaveLength(1);
  });
});

describe("sync capture (schedule_overrides is a synced table)", () => {
  it("setOverrideForDate enqueues an upsert for the date", async () => {
    await setOverrideForDate(TUE, A);
    expect(outbox()).toEqual([{ row_id: dateKey(TUE), op: "upsert" }]);
  });

  it("swapDates enqueues an upsert for both dates", async () => {
    await swapDates(MON, WED);
    const rows = outbox().filter((r) => r.op === "upsert");
    expect(rows.map((r) => r.row_id).sort()).toEqual([dateKey(MON), dateKey(WED)]);
  });

  it("clearOverrideForDate enqueues a delete for the date", async () => {
    await setOverrideForDate(TUE, A);
    sqlite.exec("DELETE FROM _outbox");
    await clearOverrideForDate(TUE);
    expect(outbox()).toEqual([{ row_id: dateKey(TUE), op: "delete" }]);
  });
});

describe("applyDayMutation (sheet interactions end to end)", () => {
  const planFor = async (): Promise<(ts: number) => ResolvedPlan> => {
    const overrides = (await db
      .select()
      .from(scheduleOverrides)
      .where(isNull(scheduleOverrides.deletedAt))
      .all()) as unknown as ScheduleOverride[];
    const sched = (await db.select().from(scheduledRoutines).all()) as ScheduledRoutine[];
    return (ts) => resolvePlanFor(ts, overrides, sched);
  };
  const week = async (finishedAt: number[] = []) =>
    buildWeekDays({ todayTs: WED, planFor: await planFor(), finishedAt });
  const day = (days: ReturnType<typeof buildWeekDays>, ts: number) =>
    days.find((d) => d.ts === ts)!;

  it("dispatches swap / setOverride / clearOverride to the right mutator", async () => {
    await applyDayMutation({ kind: "swap", fromTs: MON, toTs: TUE });
    expect(await resolve(TUE)).toMatchObject({ kind: "training", ...A });
    await applyDayMutation({ kind: "setOverride", ts: THU, plan: B });
    expect(await resolve(THU)).toMatchObject({ kind: "training", ...B });
    await applyDayMutation({ kind: "setOverride", ts: FRI, plan: null });
    expect(await resolve(FRI)).toEqual({ kind: "rest", isOverride: true });
    await applyDayMutation({ kind: "clearOverride", ts: FRI });
    expect(await resolve(FRI)).toMatchObject({ kind: "training", ...A, isOverride: false });
  });

  it("dragging today onto a future rest day moves the training there", async () => {
    const days = await week();
    const m = dropMutation(day(days, WED), day(days, SAT), WED)!;
    await applyDayMutation(m);
    expect(await resolve(SAT)).toEqual({ kind: "training", ...B, isOverride: true });
    expect(await resolve(WED)).toEqual({ kind: "rest", isOverride: true });
    // The past is untouched.
    expect(overrideFor(MON)).toBeUndefined();
    expect(overrideFor(TUE)).toBeUndefined();
  });

  it("picker move of a missed Monday only writes the destination", async () => {
    const days = await week();
    const m = rescheduleMutation(day(days, MON), day(days, SAT), WED)!;
    await applyDayMutation(m);
    expect(await resolve(SAT)).toEqual({ kind: "training", ...A, isOverride: true });
    expect(overrideFor(MON)).toBeUndefined(); // history untouched
  });

  it("make-today from a missed Monday overrides today and leaves Monday alone", async () => {
    const days = await week();
    await applyDayMutation(makeTodayMutation(day(days, MON), WED)!);
    expect(await resolve(WED)).toEqual({ kind: "training", ...A, isOverride: true });
    expect(overrideFor(MON)).toBeUndefined();
  });

  it("skip then cancel-skip round trips to the weekly schedule", async () => {
    let days = await week();
    await applyDayMutation(skipMutation(day(days, FRI))!);
    days = await week();
    expect(day(days, FRI).status).toBe("skipped");
    expect(availableActions(day(days, FRI))).toEqual(["cancelSkip"]);
    await applyDayMutation(resetMutation(day(days, FRI)));
    days = await week();
    expect(day(days, FRI).status).toBe("scheduled");
    expect(overrideRows()).toHaveLength(0);
  });

  it("a completed today is never moved by the sheet rules", async () => {
    const days = await week([new Date(2026, 9, 7, 12).getTime()]);
    expect(dropMutation(day(days, WED), day(days, SAT), WED)).toBeNull();
    expect(rescheduleMutation(day(days, WED), day(days, SAT), WED)).toBeNull();
    expect(skipMutation(day(days, WED))).toBeNull();
  });
});
