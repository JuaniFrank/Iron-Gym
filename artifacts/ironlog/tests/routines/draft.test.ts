// Routines · draft model + reducer (ironlog-routine-draft-editor T1).
// Pure logic: no DB.

import { describe, expect, it } from "vitest";

import {
  draftFromRoutine,
  draftReducer,
  emptyDraft,
  isDirty,
  validateDraft,
  type DraftAction,
  type RoutineDraft,
} from "@/domains/routines/draft";
import type { Routine } from "@/types";

function base(): RoutineDraft {
  return {
    id: "r1",
    name: "Push",
    days: [
      {
        id: "d1",
        name: "Día 1",
        exercises: [
          ex("e1", "bench"),
          ex("e2", "fly"),
          ex("e3", "dip"),
        ],
      },
      { id: "d2", name: "Día 2", exercises: [] },
      { id: "d3", name: "Día 3", exercises: [] },
    ],
  };
}

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

function run(draft: RoutineDraft, ...actions: DraftAction[]): RoutineDraft {
  return actions.reduce(draftReducer, draft);
}

describe("emptyDraft", () => {
  it("starts with an empty name and one 'Día 1'", () => {
    const d = emptyDraft();
    expect(d.name).toBe("");
    expect(d.days).toHaveLength(1);
    expect(d.days[0].name).toBe("Día 1");
    expect(d.days[0].exercises).toEqual([]);
    expect(d.id).toBeTruthy();
    expect(d.days[0].id).toBeTruthy();
  });

  it("generates distinct ids per call", () => {
    expect(emptyDraft().id).not.toBe(emptyDraft().id);
  });
});

describe("draftReducer: routine fields", () => {
  it("sets name, description and goal", () => {
    const d = run(
      base(),
      { type: "setName", name: "Pull" },
      { type: "setDescription", description: "desc" },
      { type: "setGoal", goal: "strength" },
    );
    expect(d.name).toBe("Pull");
    expect(d.description).toBe("desc");
    expect(d.goal).toBe("strength");
  });

  it("does not mutate the input draft", () => {
    const original = base();
    const snapshot = JSON.parse(JSON.stringify(original));
    run(original, { type: "setName", name: "X" }, { type: "removeDay", dayId: "d1" });
    expect(original).toEqual(snapshot);
  });
});

describe("draftReducer: days", () => {
  it("adds a day with a default name and explicit id", () => {
    const d = run(base(), { type: "addDay", id: "d4" });
    expect(d.days.map((x) => x.id)).toEqual(["d1", "d2", "d3", "d4"]);
    expect(d.days[3].name).toBe("Día 4");
  });

  it("adds a day with an explicit name", () => {
    const d = run(base(), { type: "addDay", id: "d4", name: "Legs" });
    expect(d.days[3].name).toBe("Legs");
  });

  it("renames a day", () => {
    const d = run(base(), { type: "renameDay", dayId: "d2", name: "Pull" });
    expect(d.days[1].name).toBe("Pull");
  });

  it("removes a day when more than one exists", () => {
    const d = run(base(), { type: "removeDay", dayId: "d2" });
    expect(d.days.map((x) => x.id)).toEqual(["d1", "d3"]);
  });

  it("cannot remove the last day", () => {
    const d = run(
      base(),
      { type: "removeDay", dayId: "d1" },
      { type: "removeDay", dayId: "d2" },
      { type: "removeDay", dayId: "d3" },
    );
    expect(d.days.map((x) => x.id)).toEqual(["d3"]);
  });

  it("reorders days", () => {
    expect(
      run(base(), { type: "moveDay", fromIndex: 0, toIndex: 2 }).days.map((x) => x.id),
    ).toEqual(["d2", "d3", "d1"]);
    expect(
      run(base(), { type: "moveDay", fromIndex: 2, toIndex: 0 }).days.map((x) => x.id),
    ).toEqual(["d3", "d1", "d2"]);
  });

  it("ignores out-of-range or identical moves", () => {
    const b = base();
    expect(run(b, { type: "moveDay", fromIndex: 0, toIndex: 9 }).days).toEqual(b.days);
    expect(run(b, { type: "moveDay", fromIndex: 1, toIndex: 1 }).days).toEqual(b.days);
  });
});

describe("draftReducer: exercises", () => {
  it("appends an exercise with defaults", () => {
    const d = run(base(), { type: "addExercise", dayId: "d2", id: "n1", exerciseId: "squat" });
    expect(d.days[1].exercises).toEqual([
      {
        id: "n1",
        exerciseId: "squat",
        targetSets: 3,
        targetReps: 10,
        warmupSets: 0,
        restSeconds: 90,
        notes: null,
        supersetWith: null,
      },
    ]);
  });

  it("updates sets, reps, warmup, rest and notes", () => {
    const d = run(base(), {
      type: "updateExercise",
      dayId: "d1",
      id: "e2",
      patch: { targetSets: 5, targetReps: 8, warmupSets: 2, restSeconds: 120, notes: "slow" },
    });
    expect(d.days[0].exercises[1]).toMatchObject({
      targetSets: 5,
      targetReps: 8,
      warmupSets: 2,
      restSeconds: 120,
      notes: "slow",
    });
    expect(d.days[0].exercises[0].targetSets).toBe(3);
  });

  it("removes an exercise preserving order", () => {
    const d = run(base(), { type: "removeExercise", dayId: "d1", id: "e2" });
    expect(d.days[0].exercises.map((e) => e.id)).toEqual(["e1", "e3"]);
  });

  it("reorders exercises inside a day", () => {
    const d = run(base(), { type: "moveExercise", dayId: "d1", fromIndex: 2, toIndex: 0 });
    expect(d.days[0].exercises.map((e) => e.id)).toEqual(["e3", "e1", "e2"]);
  });
});

describe("draftReducer: superset", () => {
  it("links two exercises symmetrically", () => {
    const d = run(base(), { type: "toggleSuperset", dayId: "d1", id: "e1", withId: "e2" });
    expect(d.days[0].exercises[0].supersetWith).toBe("e2");
    expect(d.days[0].exercises[1].supersetWith).toBe("e1");
    expect(d.days[0].exercises[2].supersetWith).toBeNull();
  });

  it("clears both sides when withId is null", () => {
    const d = run(
      base(),
      { type: "toggleSuperset", dayId: "d1", id: "e1", withId: "e2" },
      { type: "toggleSuperset", dayId: "d1", id: "e1", withId: null },
    );
    expect(d.days[0].exercises.every((e) => e.supersetWith === null)).toBe(true);
  });

  it("clears the partner link when a linked exercise is removed", () => {
    const d = run(
      base(),
      { type: "toggleSuperset", dayId: "d1", id: "e1", withId: "e2" },
      { type: "removeExercise", dayId: "d1", id: "e1" },
    );
    expect(d.days[0].exercises.map((e) => e.id)).toEqual(["e2", "e3"]);
    expect(d.days[0].exercises[0].supersetWith).toBeNull();
  });

  it("keeps unrelated links when another exercise is removed", () => {
    const d = run(
      base(),
      { type: "toggleSuperset", dayId: "d1", id: "e1", withId: "e2" },
      { type: "removeExercise", dayId: "d1", id: "e3" },
    );
    expect(d.days[0].exercises[0].supersetWith).toBe("e2");
    expect(d.days[0].exercises[1].supersetWith).toBe("e1");
  });
});

describe("isDirty", () => {
  it("is false for an identical copy", () => {
    expect(isDirty(base(), base())).toBe(false);
  });

  it("treats undefined and null optional fields as equal", () => {
    const a = base();
    const b = { ...base(), description: undefined, goal: undefined };
    expect(isDirty(a, b)).toBe(false);
  });

  it("is true after any edit", () => {
    expect(isDirty(run(base(), { type: "setName", name: "X" }), base())).toBe(true);
    expect(isDirty(run(base(), { type: "addDay", id: "z" }), base())).toBe(true);
    expect(isDirty(run(base(), { type: "moveDay", fromIndex: 0, toIndex: 1 }), base())).toBe(true);
    expect(
      isDirty(
        run(base(), { type: "updateExercise", dayId: "d1", id: "e1", patch: { targetReps: 11 } }),
        base(),
      ),
    ).toBe(true);
  });

  it("is false after an edit is reverted", () => {
    const d = run(base(), { type: "setName", name: "X" }, { type: "setName", name: "Push" });
    expect(isDirty(d, base())).toBe(false);
  });

  it("new routine (original null): clean when untouched, dirty after typing", () => {
    const d = emptyDraft();
    expect(isDirty(d, null)).toBe(false);
    expect(isDirty(run(d, { type: "setName", name: "A" }), null)).toBe(true);
    expect(
      isDirty(run(d, { type: "addExercise", dayId: d.days[0].id, id: "x", exerciseId: "e" }), null),
    ).toBe(true);
    expect(isDirty(run(d, { type: "addDay", id: "y" }), null)).toBe(true);
  });
});

describe("validateDraft", () => {
  it("accepts a valid draft", () => {
    expect(validateDraft(base())).toEqual({ ok: true });
  });

  it("rejects an empty or whitespace-only name", () => {
    for (const name of ["", "   "]) {
      const res = validateDraft({ ...base(), name });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.errors.name).toBeTruthy();
    }
  });

  it("rejects a name over 200 chars after trimming but accepts padded 200", () => {
    expect(validateDraft({ ...base(), name: "a".repeat(201) }).ok).toBe(false);
    expect(validateDraft({ ...base(), name: `  ${"a".repeat(200)}  ` }).ok).toBe(true);
  });

  it("rejects a draft without days", () => {
    const res = validateDraft({ ...base(), days: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.days).toBeTruthy();
  });

  it("rejects blank day names, reporting the day id", () => {
    const d = run(base(), { type: "renameDay", dayId: "d2", name: "  " });
    const res = validateDraft(d);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors.dayNames ?? {})).toEqual(["d2"]);
  });

  it("rejects out-of-range exercise values, reporting the row id", () => {
    const d = run(base(), {
      type: "updateExercise",
      dayId: "d1",
      id: "e1",
      patch: { targetSets: 0 },
    });
    const res = validateDraft(d);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors.exercises ?? {})).toEqual(["e1"]);
  });
});

describe("draftFromRoutine", () => {
  const routine: Routine = {
    id: "r1",
    name: "Push",
    description: "desc",
    goal: "strength",
    createdAt: 1,
    days: [
      {
        id: "d1",
        name: "A",
        exercises: [
          {
            id: "e1",
            exerciseId: "bench",
            targetSets: 4,
            targetReps: 6,
            warmupSets: 1,
            restSeconds: 120,
            notes: "n",
            supersetWith: "e2",
          },
          {
            id: "e2",
            exerciseId: "fly",
            targetSets: 3,
            targetReps: 12,
            warmupSets: 0,
            restSeconds: 60,
            supersetWith: "e1",
          },
        ],
      },
    ],
  };

  it("maps the query shape, normalizing missing optionals to null", () => {
    const d = draftFromRoutine(routine);
    expect(d).toEqual({
      id: "r1",
      name: "Push",
      description: "desc",
      goal: "strength",
      days: [
        {
          id: "d1",
          name: "A",
          exercises: [
            {
              id: "e1",
              exerciseId: "bench",
              targetSets: 4,
              targetReps: 6,
              warmupSets: 1,
              restSeconds: 120,
              notes: "n",
              supersetWith: "e2",
            },
            {
              id: "e2",
              exerciseId: "fly",
              targetSets: 3,
              targetReps: 12,
              warmupSets: 0,
              restSeconds: 60,
              notes: null,
              supersetWith: "e1",
            },
          ],
        },
      ],
    });
  });

  it("round trips: a fresh draft is not dirty vs its source", () => {
    expect(isDirty(draftFromRoutine(routine), draftFromRoutine(routine))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T5 / T4 pure helpers
// ---------------------------------------------------------------------------

import {
  canSaveDraft,
  draftFromTemplate,
  saveButtonLabel,
  shouldPromptOnLeave,
} from "@/domains/routines/draft";

function presetRoutine(): Routine {
  return {
    id: "p1",
    name: "PPL",
    description: "desc",
    goal: "strength",
    isPreset: true,
    createdAt: 1,
    days: [
      {
        id: "pd1",
        name: "Push",
        exercises: [
          { id: "pe1", exerciseId: "bench", targetSets: 4, targetReps: 8, warmupSets: 1, restSeconds: 120, notes: "n", supersetWith: "pe2" },
          { id: "pe2", exerciseId: "fly", targetSets: 3, targetReps: 12, warmupSets: 0, restSeconds: 60, supersetWith: "pe1" },
        ],
      },
      { id: "pd2", name: "Pull", exercises: [] },
    ],
  } as unknown as Routine;
}

describe("draftFromTemplate", () => {
  it("copies content with fresh ids and a '(copia)' name", () => {
    const src = presetRoutine();
    const d = draftFromTemplate(src);
    expect(d.name).toBe("PPL (copia)");
    expect(d.description).toBe("desc");
    expect(d.goal).toBe("strength");
    expect(d.id).not.toBe("p1");
    expect(d.days.map((x) => x.name)).toEqual(["Push", "Pull"]);
    expect(d.days[0].id).not.toBe("pd1");
    const [a, b] = d.days[0].exercises;
    expect(a.id).not.toBe("pe1");
    expect(a.exerciseId).toBe("bench");
    expect(a.targetSets).toBe(4);
    expect(a.notes).toBe("n");
    expect(b.notes).toBeNull();
  });

  it("remaps supersetWith to the new ids", () => {
    const d = draftFromTemplate(presetRoutine());
    const [a, b] = d.days[0].exercises;
    expect(a.supersetWith).toBe(b.id);
    expect(b.supersetWith).toBe(a.id);
  });

  it("is dirty against a null original and valid", () => {
    const d = draftFromTemplate(presetRoutine());
    expect(isDirty(d, null)).toBe(true);
    expect(validateDraft(d).ok).toBe(true);
  });
});

describe("save/leave helpers", () => {
  it("labels by mode", () => {
    expect(saveButtonLabel(null)).toBe("Guardar rutina");
    expect(saveButtonLabel(base())).toBe("Guardar cambios");
  });

  it("canSaveDraft requires dirty and not saving", () => {
    const orig = base();
    expect(canSaveDraft(orig, orig, false)).toBe(false);
    const changed = draftReducer(orig, { type: "setName", name: "X" });
    expect(canSaveDraft(changed, orig, false)).toBe(true);
    expect(canSaveDraft(changed, orig, true)).toBe(false);
  });

  it("prompts on leave only when dirty and not just saved", () => {
    const orig = base();
    const changed = draftReducer(orig, { type: "setName", name: "X" });
    expect(shouldPromptOnLeave(orig, orig, false)).toBe(false);
    expect(shouldPromptOnLeave(changed, orig, false)).toBe(true);
    expect(shouldPromptOnLeave(changed, orig, true)).toBe(false);
    expect(shouldPromptOnLeave(emptyDraft(), null, false)).toBe(false);
  });
});
