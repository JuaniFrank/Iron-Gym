// Schedule · day swap sheet rules (pure).
//
// The sheet shows the current Mon-Sun week. Each day gets a status, may be a
// drag source and/or a drop target, and every action maps to exactly one
// schedule mutation. Past days are immutable history.

import { describe, expect, it } from "vitest";

import {
  availableActions,
  buildWeekDays,
  deriveDayStatus,
  dropIndexFor,
  dropMutation,
  isValidDropTarget,
  makeTodayMutation,
  pickerTargetState,
  rescheduleMutation,
  resetMutation,
  skipMutation,
  weekDatesFor,
  type DayInfo,
} from "@/domains/schedule/daySwap";
import type { ResolvedPlan } from "@/types";

// Wednesday 2026-10-07 is "today"; the week is Mon 5 .. Sun 11.
const at = (day: number) => new Date(2026, 9, day).getTime();
const MON = at(5);
const TUE = at(6);
const WED = at(7);
const THU = at(8);
const FRI = at(9);
const SAT = at(10);
const SUN = at(11);
const TODAY = WED;

const training = (id = "a", isOverride = false): ResolvedPlan => ({
  kind: "training",
  routineId: `r-${id}`,
  routineDayId: `d-${id}`,
  isOverride,
});
const rest = (isOverride = false): ResolvedPlan => ({ kind: "rest", isOverride });

/** Noon of a day: a finished session ends sometime during that date. */
const endedOn = (day: number) => new Date(2026, 9, day, 12).getTime();

function week(
  plans: Partial<Record<number, ResolvedPlan>>,
  finished: number[] = [],
): DayInfo[] {
  return buildWeekDays({
    todayTs: TODAY,
    planFor: (ts) => plans[ts] ?? rest(),
    finishedAt: finished,
  });
}

const byTs = (days: DayInfo[], ts: number) => {
  const d = days.find((x) => x.ts === ts);
  if (!d) throw new Error(`no day for ${ts}`);
  return d;
};

describe("weekDatesFor", () => {
  it("returns Monday to Sunday of the week containing today", () => {
    expect(weekDatesFor(WED)).toEqual([MON, TUE, WED, THU, FRI, SAT, SUN]);
  });

  it("treats Sunday as the end of the week and Monday as the start", () => {
    expect(weekDatesFor(SUN)[0]).toBe(MON);
    expect(weekDatesFor(MON)[6]).toBe(SUN);
  });
});

describe("deriveDayStatus", () => {
  const base = { todayTs: TODAY, hasFinishedSession: false };

  it("completed beats every other status, including today", () => {
    expect(
      deriveDayStatus({ ...base, ts: TODAY, plan: training(), hasFinishedSession: true }),
    ).toBe("completed");
    expect(
      deriveDayStatus({ ...base, ts: TODAY, plan: rest(), hasFinishedSession: true }),
    ).toBe("completed");
    expect(
      deriveDayStatus({ ...base, ts: MON, plan: training(), hasFinishedSession: true }),
    ).toBe("completed");
  });

  it("today with training is `today`, today with rest is `todayRest`", () => {
    expect(deriveDayStatus({ ...base, ts: TODAY, plan: training() })).toBe("today");
    expect(deriveDayStatus({ ...base, ts: TODAY, plan: training("b", true) })).toBe("today");
    expect(deriveDayStatus({ ...base, ts: TODAY, plan: rest() })).toBe("todayRest");
    expect(deriveDayStatus({ ...base, ts: TODAY, plan: rest(true) })).toBe("todayRest");
  });

  it("a past training day without a finished session is `missed`", () => {
    expect(deriveDayStatus({ ...base, ts: MON, plan: training() })).toBe("missed");
    expect(deriveDayStatus({ ...base, ts: TUE, plan: training("b", true) })).toBe("missed");
  });

  it("a rest override (no routine) on a non-today day is `skipped`", () => {
    expect(deriveDayStatus({ ...base, ts: MON, plan: rest(true) })).toBe("skipped");
    expect(deriveDayStatus({ ...base, ts: FRI, plan: rest(true) })).toBe("skipped");
  });

  it("a natural rest day is `rest`", () => {
    expect(deriveDayStatus({ ...base, ts: MON, plan: rest() })).toBe("rest");
    expect(deriveDayStatus({ ...base, ts: FRI, plan: rest() })).toBe("rest");
  });

  it("a future training day is `scheduled`", () => {
    expect(deriveDayStatus({ ...base, ts: FRI, plan: training() })).toBe("scheduled");
    expect(deriveDayStatus({ ...base, ts: THU, plan: training("c", true) })).toBe("scheduled");
  });
});

describe("buildWeekDays", () => {
  it("builds seven ordered days with status, position flags and ts", () => {
    const days = week(
      { [MON]: training("a"), [TUE]: training("b"), [WED]: training("c"), [FRI]: training("d") },
      [endedOn(5)],
    );
    expect(days.map((d) => d.ts)).toEqual([MON, TUE, WED, THU, FRI, SAT, SUN]);
    expect(days.map((d) => d.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(days.map((d) => d.status)).toEqual([
      "completed", // Mon trained
      "missed", // Tue training, nothing logged
      "today",
      "rest",
      "scheduled",
      "rest",
      "rest",
    ]);
    expect(byTs(days, MON)).toMatchObject({ isPast: true, isToday: false, isFuture: false });
    expect(byTs(days, WED)).toMatchObject({ isPast: false, isToday: true, isFuture: false });
    expect(byTs(days, FRI)).toMatchObject({ isPast: false, isToday: false, isFuture: true });
  });

  it("matches a finished session to its calendar date, not to another day", () => {
    const days = week({ [TUE]: training(), [THU]: training() }, [endedOn(8)]);
    expect(byTs(days, TUE).status).toBe("missed");
    expect(byTs(days, THU).status).toBe("completed");
  });

  it("only today/future training days that are not completed can be dragged", () => {
    const days = week(
      {
        [MON]: training("a"), // past missed
        [WED]: training("b"), // today pending
        [THU]: training("c"), // future
        [FRI]: rest(true), // skipped
        // SAT natural rest
      },
      [],
    );
    expect(days.map((d) => d.draggable)).toEqual([
      false, // Mon past
      false, // Tue rest
      true, // Wed today training
      true, // Thu future training
      false, // Fri skipped (nothing to drag)
      false, // Sat rest
      false, // Sun rest
    ]);
  });

  it("a completed training day today is not draggable (history is not rewritten)", () => {
    const days = week({ [WED]: training() }, [endedOn(7)]);
    expect(byTs(days, WED).status).toBe("completed");
    expect(byTs(days, WED).draggable).toBe(false);
  });

  it("past and completed days are not droppable; today/future are", () => {
    const days = week({ [MON]: training(), [WED]: training() }, [endedOn(7)]);
    expect(days.map((d) => d.droppable)).toEqual([
      false, // Mon past
      false, // Tue past
      false, // Wed completed
      true,
      true,
      true,
      true,
    ]);
  });
});

describe("isValidDropTarget", () => {
  const days = week(
    { [MON]: training("a"), [WED]: training("b"), [THU]: training("c"), [FRI]: rest(true) },
    [],
  );

  it("accepts future training, future rest and skipped days", () => {
    expect(isValidDropTarget(byTs(days, THU), WED, TODAY)).toBe(true); // training
    expect(isValidDropTarget(byTs(days, SAT), WED, TODAY)).toBe(true); // natural rest
    expect(isValidDropTarget(byTs(days, FRI), WED, TODAY)).toBe(true); // skipped
  });

  it("rejects the source itself", () => {
    expect(isValidDropTarget(byTs(days, WED), WED, TODAY)).toBe(false);
  });

  it("rejects past days (immutable)", () => {
    expect(isValidDropTarget(byTs(days, MON), THU, TODAY)).toBe(false);
    expect(isValidDropTarget(byTs(days, TUE), THU, TODAY)).toBe(false);
  });

  it("rejects a completed day (never rewrite history)", () => {
    const done = week({ [WED]: training("b"), [THU]: training("c") }, [endedOn(7)]);
    expect(isValidDropTarget(byTs(done, WED), THU, TODAY)).toBe(false);
  });

  it("accepts today as a target when it is still pending", () => {
    expect(isValidDropTarget(byTs(days, WED), THU, TODAY)).toBe(true);
  });
});

describe("pickerTargetState", () => {
  const days = week(
    {
      [MON]: training("a"), // past missed
      [WED]: training("b"), // today (source in these tests)
      [THU]: training("c"), // occupied
      [FRI]: rest(true), // skipped -> free
      [SAT]: training("d", true), // override training -> occupied
    },
    [],
  );

  it("enables free future/today rest days (natural rest and skipped)", () => {
    expect(pickerTargetState(byTs(days, FRI), WED, TODAY)).toEqual({
      enabled: true,
      reason: null,
    });
    expect(pickerTargetState(byTs(days, SUN), WED, TODAY)).toEqual({
      enabled: true,
      reason: null,
    });
  });

  it("marks days that already hold training as occupied (schedule or override)", () => {
    expect(pickerTargetState(byTs(days, THU), WED, TODAY)).toEqual({
      enabled: false,
      reason: "occupied",
    });
    expect(pickerTargetState(byTs(days, SAT), WED, TODAY)).toEqual({
      enabled: false,
      reason: "occupied",
    });
  });

  it("disables the source and past days with a matching reason", () => {
    expect(pickerTargetState(byTs(days, WED), WED, TODAY)).toEqual({
      enabled: false,
      reason: "source",
    });
    expect(pickerTargetState(byTs(days, TUE), WED, TODAY)).toEqual({
      enabled: false,
      reason: "past",
    });
    expect(pickerTargetState(byTs(days, MON), WED, TODAY)).toEqual({
      enabled: false,
      reason: "past",
    });
  });

  it("a missed past day as source can target today and the future", () => {
    expect(pickerTargetState(byTs(days, FRI), MON, TODAY).enabled).toBe(true);
    expect(pickerTargetState(byTs(days, MON), MON, TODAY).reason).toBe("source");
  });

  it("disables a completed day even when its plan is rest", () => {
    const done = week({ [THU]: training("c") }, [endedOn(7)]); // freestyle on rest today
    expect(pickerTargetState(byTs(done, WED), THU, TODAY)).toEqual({
      enabled: false,
      reason: "completed",
    });
  });
});

describe("dropMutation (drag & drop)", () => {
  const days = week(
    {
      [MON]: training("a"),
      [WED]: training("b"),
      [THU]: training("c"),
      [FRI]: rest(true),
    },
    [],
  );

  it("maps a valid drop onto another day to swapDates(source, target)", () => {
    expect(dropMutation(byTs(days, WED), byTs(days, THU), TODAY)).toEqual({
      kind: "swap",
      fromTs: WED,
      toTs: THU,
    });
  });

  it("covers rest and skipped targets with the same swap", () => {
    expect(dropMutation(byTs(days, WED), byTs(days, SAT), TODAY)).toEqual({
      kind: "swap",
      fromTs: WED,
      toTs: SAT,
    });
    expect(dropMutation(byTs(days, THU), byTs(days, FRI), TODAY)).toEqual({
      kind: "swap",
      fromTs: THU,
      toTs: FRI,
    });
  });

  it("does nothing for an invalid source or target", () => {
    expect(dropMutation(byTs(days, MON), byTs(days, THU), TODAY)).toBeNull(); // past source
    expect(dropMutation(byTs(days, SAT), byTs(days, THU), TODAY)).toBeNull(); // rest source
    expect(dropMutation(byTs(days, WED), byTs(days, MON), TODAY)).toBeNull(); // past target
    expect(dropMutation(byTs(days, WED), byTs(days, WED), TODAY)).toBeNull(); // itself
  });
});

describe("rescheduleMutation (picker)", () => {
  const days = week(
    { [MON]: training("a"), [WED]: training("b"), [THU]: training("c"), [FRI]: rest(true) },
    [],
  );

  it("today/future training moves with swapDates (source becomes rest)", () => {
    expect(rescheduleMutation(byTs(days, WED), byTs(days, SAT), TODAY)).toEqual({
      kind: "swap",
      fromTs: WED,
      toTs: SAT,
    });
    expect(rescheduleMutation(byTs(days, THU), byTs(days, FRI), TODAY)).toEqual({
      kind: "swap",
      fromTs: THU,
      toTs: FRI,
    });
  });

  it("a missed past day only writes an override on the destination (past untouched)", () => {
    expect(rescheduleMutation(byTs(days, MON), byTs(days, SAT), TODAY)).toEqual({
      kind: "setOverride",
      ts: SAT,
      plan: { routineId: "r-a", routineDayId: "d-a" },
    });
  });

  it("refuses occupied, past and source targets", () => {
    expect(rescheduleMutation(byTs(days, WED), byTs(days, THU), TODAY)).toBeNull(); // occupied
    expect(rescheduleMutation(byTs(days, WED), byTs(days, TUE), TODAY)).toBeNull(); // past
    expect(rescheduleMutation(byTs(days, WED), byTs(days, WED), TODAY)).toBeNull(); // source
  });

  it("refuses a source without training", () => {
    expect(rescheduleMutation(byTs(days, SAT), byTs(days, SUN), TODAY)).toBeNull();
  });
});

describe("single-day actions", () => {
  const days = week(
    {
      [MON]: training("a"), // missed
      [WED]: training("b"),
      [THU]: training("c", true),
      [FRI]: rest(true), // skipped
    },
    [],
  );

  it("skip writes a rest override (plan null) for today/future training only", () => {
    expect(skipMutation(byTs(days, WED))).toEqual({ kind: "setOverride", ts: WED, plan: null });
    expect(skipMutation(byTs(days, THU))).toEqual({ kind: "setOverride", ts: THU, plan: null });
    expect(skipMutation(byTs(days, MON))).toBeNull(); // past: immutable
    expect(skipMutation(byTs(days, SAT))).toBeNull(); // rest: nothing to skip
  });

  it("reset clears the override of that date", () => {
    expect(resetMutation(byTs(days, FRI))).toEqual({ kind: "clearOverride", ts: FRI });
    expect(resetMutation(byTs(days, THU))).toEqual({ kind: "clearOverride", ts: THU });
  });

  it("make-today from a missed day overrides TODAY with that plan, never the past", () => {
    expect(makeTodayMutation(byTs(days, MON), TODAY)).toEqual({
      kind: "setOverride",
      ts: TODAY,
      plan: { routineId: "r-a", routineDayId: "d-a" },
    });
  });

  it("make-today only applies to a missed past training day", () => {
    expect(makeTodayMutation(byTs(days, THU), TODAY)).toBeNull(); // future
    expect(makeTodayMutation(byTs(days, FRI), TODAY)).toBeNull(); // skipped
    const done = week({ [MON]: training("a") }, [endedOn(5)]);
    expect(makeTodayMutation(byTs(done, MON), TODAY)).toBeNull(); // completed
  });
});

describe("availableActions (tap menu)", () => {
  const days = week(
    {
      [MON]: training("a"), // missed
      [TUE]: training("z"), // missed with override
      [WED]: training("b"), // today pending
      [THU]: training("c", true), // future override
      [FRI]: training("d"), // future natural
      [SAT]: rest(true), // skipped
      // SUN natural rest
    },
    [],
  );
  const overrideMissed = buildWeekDays({
    todayTs: TODAY,
    planFor: (ts) => (ts === TUE ? training("z", true) : rest()),
    finishedAt: [],
  });

  it("today pending: start, reschedule, skip", () => {
    expect(availableActions(byTs(days, WED))).toEqual(["start", "reschedule", "skip"]);
  });

  it("today pending with override also offers restoring the original plan", () => {
    const d = buildWeekDays({
      todayTs: TODAY,
      planFor: (ts) => (ts === WED ? training("b", true) : rest()),
      finishedAt: [],
    });
    expect(availableActions(byTs(d, WED))).toEqual([
      "start",
      "reschedule",
      "skip",
      "resetOriginal",
    ]);
  });

  it("scheduled future: reschedule, skip (+ restore original when overridden)", () => {
    expect(availableActions(byTs(days, FRI))).toEqual(["reschedule", "skip"]);
    expect(availableActions(byTs(days, THU))).toEqual(["reschedule", "skip", "resetOriginal"]);
  });

  it("missed: make today or reschedule; never reset-original (past is immutable)", () => {
    expect(availableActions(byTs(days, MON))).toEqual(["makeToday", "reschedule"]);
    expect(availableActions(byTs(overrideMissed, TUE))).toEqual(["makeToday", "reschedule"]);
  });

  it("skipped: cancel the skip", () => {
    expect(availableActions(byTs(days, SAT))).toEqual(["cancelSkip"]);
  });

  it("rest, today rest and completed have no menu", () => {
    expect(availableActions(byTs(days, SUN))).toEqual([]);
    const restToday = week({}, []);
    expect(availableActions(byTs(restToday, WED))).toEqual([]);
    const done = week({ [WED]: training("b") }, [endedOn(7)]);
    expect(availableActions(byTs(done, WED))).toEqual([]);
  });
});

describe("dropIndexFor (drag translation to row)", () => {
  it("snaps to the row under the finger using the row pitch", () => {
    expect(dropIndexFor(2, 0, 94, 7)).toBe(2);
    expect(dropIndexFor(2, 46, 94, 7)).toBe(2);
    expect(dropIndexFor(2, 48, 94, 7)).toBe(3);
    expect(dropIndexFor(2, 190, 94, 7)).toBe(4);
    expect(dropIndexFor(3, -100, 94, 7)).toBe(2);
  });

  it("clamps to the week bounds", () => {
    expect(dropIndexFor(1, -1000, 94, 7)).toBe(0);
    expect(dropIndexFor(5, 1000, 94, 7)).toBe(6);
  });

  it("is safe for a zero or invalid pitch", () => {
    expect(dropIndexFor(2, 500, 0, 7)).toBe(2);
  });
});
