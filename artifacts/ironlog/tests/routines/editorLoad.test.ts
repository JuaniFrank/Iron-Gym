// Routines · editor load decision (ironlog-async-sqlite T9).

import { describe, expect, it } from "vitest";

import { resolveEditorLoad } from "@/domains/routines/editorLoad";
import type { Routine } from "@/types";

const r1: Routine = {
  id: "r1",
  name: "Push",
  days: [],
  isPreset: false,
  createdAt: 1,
};

describe("resolveEditorLoad", () => {
  it("waits while the routines have not loaded", () => {
    expect(
      resolveEditorLoad({ isNew: false, id: "r1", loaded: false, routines: [] }),
    ).toEqual({ status: "loading" });
  });

  it("loads the routine for edit once loaded", () => {
    expect(
      resolveEditorLoad({ isNew: false, id: "r1", loaded: true, routines: [r1] }),
    ).toEqual({ status: "edit", routine: r1 });
  });

  it("reports missing only after load", () => {
    expect(
      resolveEditorLoad({ isNew: false, id: "zz", loaded: true, routines: [r1] }),
    ).toEqual({ status: "missing" });
  });

  it("a new blank routine needs no data", () => {
    expect(
      resolveEditorLoad({ isNew: true, loaded: false, routines: [] }),
    ).toEqual({ status: "blank" });
  });

  it("a new routine from a template waits for the template to load", () => {
    expect(
      resolveEditorLoad({ isNew: true, templateId: "r1", loaded: false, routines: [] }),
    ).toEqual({ status: "loading" });
    expect(
      resolveEditorLoad({ isNew: true, templateId: "r1", loaded: true, routines: [r1] }),
    ).toEqual({ status: "template", routine: r1 });
  });

  it("a missing template after load falls back to blank", () => {
    expect(
      resolveEditorLoad({ isNew: true, templateId: "zz", loaded: true, routines: [r1] }),
    ).toEqual({ status: "blank" });
  });
});
