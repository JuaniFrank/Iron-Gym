// Active workout · initial values of a set row (ironlog-port-minor-issues T4).

import { describe, expect, it } from "vitest";

import {
  parseCompletion,
  parseDraftPatch,
  resolveSetInputs,
} from "@/domains/workout/setInputs";

describe("resolveSetInputs", () => {
  it("returns empty strings when nothing is known", () => {
    expect(resolveSetInputs({ isWarmup: false })).toEqual({
      weight: "",
      reps: "",
      rpe: "",
    });
  });

  it("prefills from the plan when the set is not completed", () => {
    expect(
      resolveSetInputs({
        isWarmup: false,
        planned: { weight: 60, reps: 8, rpe: 7 },
      }),
    ).toEqual({ weight: "60", reps: "8", rpe: "7" });
  });

  it("falls back to the previous session only for weight and reps", () => {
    expect(
      resolveSetInputs({
        isWarmup: false,
        previous: { weight: 50, reps: 10 },
      }),
    ).toEqual({ weight: "50", reps: "10", rpe: "" });
  });

  it("plan beats previous per field", () => {
    expect(
      resolveSetInputs({
        isWarmup: false,
        planned: { weight: 60 },
        previous: { weight: 50, reps: 10 },
      }),
    ).toEqual({ weight: "60", reps: "10", rpe: "" });
  });

  it("a draft beats plan and previous for incomplete sets", () => {
    expect(
      resolveSetInputs({
        isWarmup: false,
        draft: { weight: 62.5, reps: 6, rpe: 9 },
        planned: { weight: 60, reps: 8, rpe: 7 },
        previous: { weight: 50, reps: 10 },
      }),
    ).toEqual({ weight: "62.5", reps: "6", rpe: "9" });
  });

  it("resolves each field independently across draft, plan and previous", () => {
    expect(
      resolveSetInputs({
        isWarmup: false,
        draft: { reps: 5 },
        planned: { weight: 60, reps: 8, rpe: 7 },
        previous: { weight: 50, reps: 10 },
      }),
    ).toEqual({ weight: "60", reps: "5", rpe: "7" });
  });

  it("a completed set shows its logged values, ignoring draft, plan and previous", () => {
    expect(
      resolveSetInputs({
        isWarmup: false,
        completed: { weight: 70, reps: 5, rpe: 8.5 },
        draft: { weight: 62.5, reps: 6, rpe: 9 },
        planned: { weight: 60, reps: 8, rpe: 7 },
        previous: { weight: 50, reps: 10 },
      }),
    ).toEqual({ weight: "70", reps: "5", rpe: "8.5" });
  });

  it("a completed set without RPE does not borrow the planned RPE", () => {
    expect(
      resolveSetInputs({
        isWarmup: false,
        completed: { weight: 70, reps: 5 },
        planned: { weight: 60, reps: 8, rpe: 7 },
      }),
    ).toEqual({ weight: "70", reps: "5", rpe: "" });
  });

  it("keeps a logged zero weight (bodyweight) instead of treating it as empty", () => {
    expect(
      resolveSetInputs({
        isWarmup: false,
        completed: { weight: 0, reps: 12 },
        planned: { weight: 10, reps: 8 },
      }),
    ).toEqual({ weight: "0", reps: "12", rpe: "" });
  });

  it("warm-ups never carry an RPE", () => {
    expect(
      resolveSetInputs({
        isWarmup: true,
        completed: { weight: 20, reps: 10, rpe: 6 },
        draft: { rpe: 5 },
        planned: { weight: 20, reps: 10, rpe: 4 },
      }),
    ).toEqual({ weight: "20", reps: "10", rpe: "" });
    expect(
      resolveSetInputs({ isWarmup: true, planned: { weight: 20, reps: 10, rpe: 4 } }).rpe,
    ).toBe("");
  });
});

describe("parseDraftPatch", () => {
  it("parses numeric strings", () => {
    expect(parseDraftPatch("62.5", "6", "8.5")).toEqual({
      weight: 62.5,
      reps: 6,
      rpe: 8.5,
    });
  });

  it("maps blank and unparsable inputs to null", () => {
    expect(parseDraftPatch("", "abc", "   ")).toEqual({
      weight: null,
      reps: null,
      rpe: null,
    });
    expect(parseDraftPatch(".", "-", "NaN")).toEqual({
      weight: null,
      reps: null,
      rpe: null,
    });
  });

  it("truncates reps to an integer and rejects non-finite values", () => {
    expect(parseDraftPatch("1e999", "7.9", "")).toEqual({
      weight: null,
      reps: 7,
      rpe: null,
    });
  });
});

describe("parseCompletion", () => {
  it("parses weight, reps and rpe", () => {
    expect(parseCompletion("60.5", "8", "9")).toEqual({
      weight: 60.5,
      reps: 8,
      rpe: 9,
    });
  });

  it("blank weight counts as 0 (bodyweight) and blank rpe is undefined", () => {
    expect(parseCompletion("", "10", "")).toEqual({
      weight: 0,
      reps: 10,
      rpe: undefined,
    });
  });

  it("rejects the set when reps are 0, blank or not a number", () => {
    expect(parseCompletion("60", "0", "")).toBeNull();
    expect(parseCompletion("60", "", "")).toBeNull();
    expect(parseCompletion("60", "abc", "")).toBeNull();
  });
});
