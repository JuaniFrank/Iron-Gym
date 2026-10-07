// Active workout · rows of one exercise card (ironlog-port-minor-issues T5).

import { describe, expect, it } from "vitest";

import { buildDraftKey } from "@/domains/workout/queries";
import {
  computeExerciseRows,
  draftSlotCounts,
  isActiveWorkoutDataLoaded,
  nextExtraWork,
  rowKey,
} from "@/domains/workout/sessionRows";

const base = {
  plannedWarmup: null,
  plannedWork: null,
  targetSets: 3,
  warmupSets: 0,
  completedWarmup: 0,
  completedWork: 0,
  extraWork: 0,
};

describe("computeExerciseRows", () => {
  it("falls back to the routine targets when there is no plan", () => {
    const { rows, workRows } = computeExerciseRows({ ...base, warmupSets: 1 });
    expect(workRows).toBe(3);
    expect(rows).toEqual([
      { isWarmup: true, index: 1 },
      { isWarmup: false, index: 1 },
      { isWarmup: false, index: 2 },
      { isWarmup: false, index: 3 },
    ]);
  });

  it("the plan wins over the routine targets", () => {
    const { rows, workRows } = computeExerciseRows({
      ...base,
      plannedWarmup: 2,
      plannedWork: 4,
      targetSets: 3,
      warmupSets: 0,
    });
    expect(workRows).toBe(4);
    expect(rows.filter((r) => r.isWarmup)).toHaveLength(2);
    expect(rows.filter((r) => !r.isWarmup)).toHaveLength(4);
  });

  it("an empty plan (0 planned sets) still wins over the routine targets", () => {
    const { rows } = computeExerciseRows({
      ...base,
      plannedWarmup: 0,
      plannedWork: 0,
    });
    expect(rows).toEqual([]);
  });

  it("grows warm-up and work rows independently to fit completed sets", () => {
    const { rows } = computeExerciseRows({
      ...base,
      plannedWarmup: 1,
      plannedWork: 2,
      completedWarmup: 3,
      completedWork: 2,
    });
    expect(rows.filter((r) => r.isWarmup)).toHaveLength(3);
    expect(rows.filter((r) => !r.isWarmup)).toHaveLength(2);
  });

  it("does not add a spare empty row after the last completed set", () => {
    const { workRows } = computeExerciseRows({
      ...base,
      targetSets: 3,
      completedWork: 3,
    });
    expect(workRows).toBe(3);
  });

  it("extra work rows add on top of the plan", () => {
    const { workRows } = computeExerciseRows({
      ...base,
      plannedWork: 3,
      extraWork: 2,
    });
    expect(workRows).toBe(5);
  });

  it("extra rows are absorbed once completed sets reach them", () => {
    const { workRows } = computeExerciseRows({
      ...base,
      targetSets: 3,
      extraWork: 1,
      completedWork: 5,
    });
    expect(workRows).toBe(5);
  });

  describe("allWorkSetsDone", () => {
    it("is false with no completed work sets", () => {
      expect(computeExerciseRows(base).allWorkSetsDone).toBe(false);
    });

    it("is false while a work row is still empty", () => {
      expect(
        computeExerciseRows({ ...base, completedWork: 2 }).allWorkSetsDone,
      ).toBe(false);
    });

    it("is true once every work row is completed", () => {
      expect(
        computeExerciseRows({ ...base, completedWork: 3 }).allWorkSetsDone,
      ).toBe(true);
    });

    it("never waits for warm-ups", () => {
      expect(
        computeExerciseRows({
          ...base,
          warmupSets: 2,
          completedWarmup: 0,
          completedWork: 3,
        }).allWorkSetsDone,
      ).toBe(true);
    });

    it("is not satisfied by warm-ups alone", () => {
      expect(
        computeExerciseRows({
          ...base,
          targetSets: 0,
          warmupSets: 1,
          completedWarmup: 1,
          completedWork: 0,
        }).allWorkSetsDone,
      ).toBe(false);
    });

    it("turns false again after adding a set", () => {
      const done = { ...base, completedWork: 3 };
      expect(computeExerciseRows(done).allWorkSetsDone).toBe(true);
      expect(
        computeExerciseRows({ ...done, extraWork: 1 }).allWorkSetsDone,
      ).toBe(false);
    });
  });
});

describe("computeExerciseRows with drafts (rows added with 'Añadir set' survive a restart)", () => {
  it("restores extra work rows that only exist as drafts", () => {
    // Plan 3, user added 2 rows and typed into row 5, then the app restarted
    // (extra rows are local state, so extraWork is 0 again).
    const { workRows, rows } = computeExerciseRows({
      ...base,
      plannedWork: 3,
      draftWorkCount: 5,
    });
    expect(workRows).toBe(5);
    expect(rows.filter((r) => !r.isWarmup).map((r) => r.index)).toEqual([1, 2, 3, 4, 5]);
  });

  it("restores extra warm-up rows from drafts independently", () => {
    const { rows } = computeExerciseRows({
      ...base,
      plannedWarmup: 1,
      plannedWork: 2,
      draftWarmupCount: 3,
    });
    expect(rows.filter((r) => r.isWarmup)).toHaveLength(3);
    expect(rows.filter((r) => !r.isWarmup)).toHaveLength(2);
  });

  it("drafts inside the planned rows add nothing", () => {
    const { workRows } = computeExerciseRows({
      ...base,
      plannedWork: 3,
      draftWorkCount: 2,
    });
    expect(workRows).toBe(3);
  });

  it("falls back to the routine targets when there is no plan", () => {
    expect(
      computeExerciseRows({ ...base, targetSets: 3, draftWorkCount: 4 }).workRows,
    ).toBe(4);
  });

  it("completed sets and drafts overlap instead of adding up", () => {
    expect(
      computeExerciseRows({
        ...base,
        plannedWork: 3,
        completedWork: 4,
        draftWorkCount: 5,
      }).workRows,
    ).toBe(5);
  });

  it("omitted draft counts behave as 0", () => {
    expect(computeExerciseRows({ ...base, plannedWork: 3 }).workRows).toBe(3);
  });
});

describe("draftSlotCounts", () => {
  const drafts = new Map([
    [buildDraftKey("ex1", 1, false), { weight: 50 }],
    [buildDraftKey("ex1", 5, false), { weight: 60 }],
    [buildDraftKey("ex1", 2, true), { reps: 5 }],
    [buildDraftKey("ex2", 9, false), { weight: 10 }],
    [buildDraftKey("ex12", 7, false), { weight: 10 }],
  ]);

  it("returns the highest 1-based set index per kind for that exercise only", () => {
    expect(draftSlotCounts(drafts, "ex1")).toEqual({ warmup: 2, work: 5 });
    expect(draftSlotCounts(drafts, "ex2")).toEqual({ warmup: 0, work: 9 });
  });

  it("does not confuse exercises sharing an id prefix", () => {
    expect(draftSlotCounts(drafts, "ex12")).toEqual({ warmup: 0, work: 7 });
  });

  it("is zero without drafts, with an unknown exercise or while loading (undefined)", () => {
    expect(draftSlotCounts(new Map(), "ex1")).toEqual({ warmup: 0, work: 0 });
    expect(draftSlotCounts(drafts, "nope")).toEqual({ warmup: 0, work: 0 });
    expect(draftSlotCounts(undefined, "ex1")).toEqual({ warmup: 0, work: 0 });
  });
});

describe("nextExtraWork ('Añadir set' adds exactly one row on top of what is shown)", () => {
  it("adds one row on top of the plan", () => {
    const args = { ...base, plannedWork: 3 };
    const extra = nextExtraWork(args);
    expect(computeExerciseRows({ ...args, extraWork: extra }).workRows).toBe(4);
  });

  it("after a restart it adds on top of the rows restored from drafts (no double counting)", () => {
    const args = { ...base, plannedWork: 3, draftWorkCount: 5 };
    const extra = nextExtraWork(args);
    expect(computeExerciseRows({ ...args, extraWork: extra }).workRows).toBe(6);
  });

  it("adds on top of rows already extended by a previous 'Añadir set'", () => {
    let args: Parameters<typeof computeExerciseRows>[0] = { ...base, plannedWork: 3 };
    for (let n = 4; n <= 7; n++) {
      args = { ...args, extraWork: nextExtraWork(args) };
      expect(computeExerciseRows(args).workRows).toBe(n);
    }
  });

  it("does not stack on a draft typed into an added row", () => {
    // 3 planned + 1 added (extraWork 1); the user typed into row 4 -> draft 4.
    const args = { ...base, plannedWork: 3, extraWork: 1, draftWorkCount: 4 };
    expect(computeExerciseRows(args).workRows).toBe(4);
    expect(
      computeExerciseRows({ ...args, extraWork: nextExtraWork(args) }).workRows,
    ).toBe(5);
  });

  it("adds on top of completed sets beyond the plan", () => {
    const args = { ...base, targetSets: 3, completedWork: 5 };
    expect(
      computeExerciseRows({ ...args, extraWork: nextExtraWork(args) }).workRows,
    ).toBe(6);
  });
});

describe("isActiveWorkoutDataLoaded", () => {
  const loaded = {
    plan: null,
    drafts: new Map(),
    routine: null,
    sessionsLoaded: true,
  };

  it("is true once plan, drafts, routine and history resolved (null = resolved, empty)", () => {
    expect(isActiveWorkoutDataLoaded(loaded)).toBe(true);
  });

  it("waits for the plan (undefined = still loading)", () => {
    expect(isActiveWorkoutDataLoaded({ ...loaded, plan: undefined })).toBe(false);
  });

  it("waits for the drafts", () => {
    expect(isActiveWorkoutDataLoaded({ ...loaded, drafts: undefined })).toBe(false);
  });

  it("waits for the routine", () => {
    expect(isActiveWorkoutDataLoaded({ ...loaded, routine: undefined })).toBe(false);
  });

  it("waits for the session history behind the 'previous' values", () => {
    expect(isActiveWorkoutDataLoaded({ ...loaded, sessionsLoaded: false })).toBe(false);
  });
});

describe("rowKey", () => {
  it("is stable per slot (exercise + kind + index), not per position", () => {
    expect(rowKey("e1", { isWarmup: false, index: 2 })).toBe("e1-work-2");
    expect(rowKey("e1", { isWarmup: true, index: 2 })).toBe("e1-warmup-2");
  });

  it("does not move when a warm-up row appears before the work rows", () => {
    const before = computeExerciseRows({ ...base }).rows.map((r) =>
      rowKey("e1", r),
    );
    const after = computeExerciseRows({ ...base, completedWarmup: 1 }).rows.map(
      (r) => rowKey("e1", r),
    );
    for (const k of before) expect(after).toContain(k);
  });

  it("differs between exercises", () => {
    const row = { isWarmup: false, index: 1 };
    expect(rowKey("e1", row)).not.toBe(rowKey("e2", row));
  });
});
