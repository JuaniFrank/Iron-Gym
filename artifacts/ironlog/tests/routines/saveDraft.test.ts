// Routines · `saveRoutineDraft` (ironlog-routine-draft-editor T2).
//
// Create writes the whole tree in one transaction; edit diffs against the
// original draft and only touches changed rows (asserted through the sync
// `_outbox`, which the capture triggers fill on every row write).

import { asc, eq } from "drizzle-orm";
import { exercises, routineDays, routineExercises, routines } from "@workspace/db/schema";
import { beforeEach, describe, expect, it } from "vitest";

import {
  draftReducer,
  type DraftAction,
  type RoutineDraft,
} from "@/domains/routines/draft";
import { saveRoutineDraft } from "@/domains/routines/mutators";

import { createTestDb, type TestDb } from "../helpers/db";

let db: TestDb;
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  const now = new Date();
  for (const id of ["bench", "fly", "dip", "squat"]) {
    db.insert(exercises)
      .values({
        id,
        name: id,
        description: "",
        primaryMuscle: "chest",
        secondaryMuscles: [],
        type: "barbell",
        isPreset: true,
        updatedAt: now,
      })
      .run();
  }
});

function ex(id: string, exerciseId: string) {
  return {
    id,
    exerciseId,
    targetSets: 3,
    targetReps: 10,
    warmupSets: 0,
    restSeconds: 90,
    notes: null,
    supersetWith: null,
  };
}

function draft(): RoutineDraft {
  return {
    id: "r1",
    name: "Push",
    description: "desc",
    goal: "strength",
    days: [
      { id: "d1", name: "A", exercises: [ex("e1", "bench"), ex("e2", "fly"), ex("e3", "dip")] },
      { id: "d2", name: "B", exercises: [ex("e4", "squat")] },
      { id: "d3", name: "C", exercises: [] },
    ],
  };
}

function run(d: RoutineDraft, ...actions: DraftAction[]): RoutineDraft {
  return actions.reduce(draftReducer, d);
}

/** Create `draft()` and clear the outbox so edits are observed in isolation. */
async function seeded(): Promise<RoutineDraft> {
  const original = draft();
  await saveRoutineDraft(original, null);
  sqlite.exec("DELETE FROM _outbox");
  return original;
}

function outbox(): string[] {
  const rows = sqlite
    .prepare("SELECT table_name, row_id FROM _outbox ORDER BY table_name, row_id")
    .all() as { table_name: string; row_id: string }[];
  return rows.map((r) => `${r.table_name}:${r.row_id}`);
}

function dayRows(includeDeleted = false) {
  return db
    .select()
    .from(routineDays)
    .orderBy(asc(routineDays.position))
    .all()
    .filter((d) => includeDeleted || d.deletedAt === null);
}

function exRows(dayId: string) {
  return db
    .select()
    .from(routineExercises)
    .where(eq(routineExercises.routineDayId, dayId))
    .orderBy(asc(routineExercises.position))
    .all()
    .filter((e) => e.deletedAt === null);
}

describe("saveRoutineDraft: create", () => {
  it("writes routine, days and exercises with positions from array order", async () => {
    const id = await saveRoutineDraft(draft(), null);
    expect(id).toBe("r1");

    const r = db.select().from(routines).where(eq(routines.id, "r1")).get();
    expect(r).toMatchObject({
      name: "Push",
      description: "desc",
      goal: "strength",
      isPreset: false,
      deletedAt: null,
    });
    expect(dayRows().map((d) => [d.id, d.name, d.position])).toEqual([
      ["d1", "A", 0],
      ["d2", "B", 1],
      ["d3", "C", 2],
    ]);
    expect(exRows("d1").map((e) => [e.id, e.exerciseId, e.position])).toEqual([
      ["e1", "bench", 0],
      ["e2", "fly", 1],
      ["e3", "dip", 2],
    ]);
    expect(exRows("d2").map((e) => e.id)).toEqual(["e4"]);
  });

  it("persists exercise fields and superset links", async () => {
    const d = run(
      draft(),
      {
        type: "updateExercise",
        dayId: "d1",
        id: "e1",
        patch: { targetSets: 5, targetReps: 6, warmupSets: 2, restSeconds: 150, notes: "n" },
      },
      { type: "toggleSuperset", dayId: "d1", id: "e1", withId: "e2" },
    );
    await saveRoutineDraft(d, null);
    const [e1, e2] = exRows("d1");
    expect(e1).toMatchObject({
      targetSets: 5,
      targetReps: 6,
      warmupSets: 2,
      restSeconds: 150,
      notes: "n",
      supersetWith: "e2",
    });
    expect(e2.supersetWith).toBe("e1");
  });

  it("stores the trimmed name", async () => {
    await saveRoutineDraft({ ...draft(), name: "  Push  " }, null);
    expect(db.select().from(routines).get()?.name).toBe("Push");
  });

  it("writes nothing when the draft is invalid", async () => {
    await expect(saveRoutineDraft({ ...draft(), name: "  " }, null)).rejects.toThrow();
    expect(db.select().from(routines).all()).toHaveLength(0);
    expect(db.select().from(routineDays).all()).toHaveLength(0);
    expect(outbox()).toEqual([]);
  });

  it("rolls back everything when an insert fails mid-transaction", async () => {
    sqlite.exec(
      `CREATE TRIGGER boom BEFORE INSERT ON routine_exercises
       BEGIN SELECT RAISE(ABORT, 'boom'); END;`,
    );
    await expect(saveRoutineDraft(draft(), null)).rejects.toThrow();
    expect(db.select().from(routines).all()).toHaveLength(0);
    expect(db.select().from(routineDays).all()).toHaveLength(0);
    expect(outbox()).toEqual([]);
  });
});

describe("saveRoutineDraft: edit", () => {
  it("unchanged draft writes nothing", async () => {
    const original = await seeded();
    await saveRoutineDraft(structuredClone(original), original);
    expect(outbox()).toEqual([]);
  });

  it("rename-only updates only the routine row", async () => {
    const original = await seeded();
    await saveRoutineDraft(run(original, { type: "setName", name: "Pull" }), original);
    expect(outbox()).toEqual(["routines:r1"]);
    expect(db.select().from(routines).get()?.name).toBe("Pull");
  });

  it("exercise stepper change updates only that exercise row", async () => {
    const original = await seeded();
    const edited = run(original, {
      type: "updateExercise",
      dayId: "d1",
      id: "e2",
      patch: { targetReps: 12 },
    });
    await saveRoutineDraft(edited, original);
    expect(outbox()).toEqual(["routine_exercises:e2"]);
    expect(exRows("d1")[1].targetReps).toBe(12);
  });

  it("day rename updates only that day", async () => {
    const original = await seeded();
    await saveRoutineDraft(
      run(original, { type: "renameDay", dayId: "d2", name: "Pull" }),
      original,
    );
    expect(outbox()).toEqual(["routine_days:d2"]);
  });

  it("adds a day and an exercise (inserts only new rows)", async () => {
    const original = await seeded();
    const edited = run(
      original,
      { type: "addDay", id: "d4", name: "D" },
      { type: "addExercise", dayId: "d4", id: "e9", exerciseId: "squat" },
      { type: "addExercise", dayId: "d3", id: "e8", exerciseId: "bench" },
    );
    await saveRoutineDraft(edited, original);
    expect(outbox()).toEqual([
      "routine_days:d4",
      "routine_exercises:e8",
      "routine_exercises:e9",
    ]);
    expect(dayRows().map((d) => [d.id, d.position])).toEqual([
      ["d1", 0],
      ["d2", 1],
      ["d3", 2],
      ["d4", 3],
    ]);
    expect(exRows("d3")[0]).toMatchObject({ id: "e8", position: 0 });
  });

  it("removes an exercise: soft delete and renumber siblings", async () => {
    const original = await seeded();
    await saveRoutineDraft(
      run(original, { type: "removeExercise", dayId: "d1", id: "e1" }),
      original,
    );
    const all = db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineDayId, "d1"))
      .all();
    const removed = all.find((e) => e.id === "e1");
    expect(removed?.deletedAt).toBeInstanceOf(Date);
    expect(exRows("d1").map((e) => [e.id, e.position])).toEqual([
      ["e2", 0],
      ["e3", 1],
    ]);
    expect(outbox()).toEqual([
      "routine_exercises:e1",
      "routine_exercises:e2",
      "routine_exercises:e3",
    ]);
  });

  it("removing the last exercise then adding another reuses the position", async () => {
    const original = await seeded();
    const edited = run(
      original,
      { type: "removeExercise", dayId: "d1", id: "e3" },
      { type: "addExercise", dayId: "d1", id: "e7", exerciseId: "squat" },
    );
    await saveRoutineDraft(edited, original);
    expect(exRows("d1").map((e) => [e.id, e.position])).toEqual([
      ["e1", 0],
      ["e2", 1],
      ["e7", 2],
    ]);
  });

  it("removes a day with its exercises (soft delete) and renumbers", async () => {
    const original = await seeded();
    await saveRoutineDraft(run(original, { type: "removeDay", dayId: "d1" }), original);
    const days = dayRows(true);
    expect(days.find((d) => d.id === "d1")?.deletedAt).toBeInstanceOf(Date);
    expect(dayRows().map((d) => [d.id, d.position])).toEqual([
      ["d2", 0],
      ["d3", 1],
    ]);
    const d1Exercises = db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineDayId, "d1"))
      .all();
    expect(d1Exercises.every((e) => e.deletedAt !== null)).toBe(true);
  });

  it("reorders days without UNIQUE violations", async () => {
    const original = await seeded();
    await saveRoutineDraft(
      run(original, { type: "moveDay", fromIndex: 2, toIndex: 0 }),
      original,
    );
    expect(dayRows().map((d) => [d.id, d.position])).toEqual([
      ["d3", 0],
      ["d1", 1],
      ["d2", 2],
    ]);
    expect(outbox()).toEqual(["routine_days:d1", "routine_days:d2", "routine_days:d3"]);
  });

  it("reorders exercises without UNIQUE violations", async () => {
    const original = await seeded();
    await saveRoutineDraft(
      run(original, { type: "moveExercise", dayId: "d1", fromIndex: 0, toIndex: 2 }),
      original,
    );
    expect(exRows("d1").map((e) => [e.id, e.position])).toEqual([
      ["e2", 0],
      ["e3", 1],
      ["e1", 2],
    ]);
  });

  it("supersets toggled on both partners update both rows", async () => {
    const original = await seeded();
    await saveRoutineDraft(
      run(original, { type: "toggleSuperset", dayId: "d1", id: "e1", withId: "e2" }),
      original,
    );
    expect(outbox()).toEqual(["routine_exercises:e1", "routine_exercises:e2"]);
    const [e1, e2] = exRows("d1");
    expect([e1.supersetWith, e2.supersetWith]).toEqual(["e2", "e1"]);
  });

  it("saving the same edit twice (re-based original) is a no-op the second time", async () => {
    const original = await seeded();
    const edited = run(original, { type: "moveDay", fromIndex: 0, toIndex: 1 });
    await saveRoutineDraft(edited, original);
    sqlite.exec("DELETE FROM _outbox");
    await saveRoutineDraft(structuredClone(edited), edited);
    expect(outbox()).toEqual([]);
  });

  it("reuses a position held by a previously soft-deleted row", async () => {
    const original = await seeded();
    // First save soft-deletes e3 (position 2) ...
    const afterRemove = run(original, { type: "removeExercise", dayId: "d1", id: "e3" });
    await saveRoutineDraft(afterRemove, original);
    // ... then a new exercise lands on position 2 and a day is removed/added.
    const next = run(
      afterRemove,
      { type: "addExercise", dayId: "d1", id: "e6", exerciseId: "dip" },
      { type: "removeDay", dayId: "d3" },
      { type: "addDay", id: "d5" },
    );
    await saveRoutineDraft(next, afterRemove);
    expect(exRows("d1").map((e) => [e.id, e.position])).toEqual([
      ["e1", 0],
      ["e2", 1],
      ["e6", 2],
    ]);
    expect(dayRows().map((d) => [d.id, d.position])).toEqual([
      ["d1", 0],
      ["d2", 1],
      ["d5", 2],
    ]);
  });

  it("writes nothing when the edited draft is invalid", async () => {
    const original = await seeded();
    await expect(
      saveRoutineDraft(run(original, { type: "setName", name: "" }), original),
    ).rejects.toThrow();
    expect(outbox()).toEqual([]);
    expect(db.select().from(routines).get()?.name).toBe("Push");
  });

  it("rolls back every change when a later statement fails", async () => {
    const original = await seeded();
    sqlite.exec(
      `CREATE TRIGGER boom BEFORE UPDATE ON routine_exercises
       BEGIN SELECT RAISE(ABORT, 'boom'); END;`,
    );
    const edited = run(
      original,
      { type: "setName", name: "Pull" },
      { type: "renameDay", dayId: "d2", name: "Z" },
      { type: "updateExercise", dayId: "d1", id: "e1", patch: { targetSets: 4 } },
    );
    await expect(saveRoutineDraft(edited, original)).rejects.toThrow();
    expect(db.select().from(routines).get()?.name).toBe("Push");
    expect(dayRows().find((d) => d.id === "d2")?.name).toBe("B");
    expect(exRows("d1")[0].targetSets).toBe(3);
    expect(outbox()).toEqual([]);
  });
});
