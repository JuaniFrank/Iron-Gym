// Routines · in-memory draft store (ironlog-routine-draft-editor T3).

import { describe, expect, it, vi } from "vitest";

import type { DraftAction } from "@/domains/routines/draft";
import {
  dispatchToDraft,
  registerDraft,
  unregisterDraft,
} from "@/domains/routines/draftStore";

const action: DraftAction = { type: "addExercise", dayId: "d1", id: "e1", exerciseId: "x" };

describe("draftStore", () => {
  it("delivers an action to the registered draft and reports it", () => {
    const dispatch = vi.fn();
    registerDraft("k1", dispatch);
    expect(dispatchToDraft("k1", action)).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(action);
    unregisterDraft("k1", dispatch);
  });

  it("returns false for an unknown key", () => {
    expect(dispatchToDraft("nope", action)).toBe(false);
  });

  it("stops delivering after unregister", () => {
    const dispatch = vi.fn();
    registerDraft("k2", dispatch);
    unregisterDraft("k2", dispatch);
    expect(dispatchToDraft("k2", action)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("keeps drafts isolated per key", () => {
    const a = vi.fn();
    const b = vi.fn();
    registerDraft("ka", a);
    registerDraft("kb", b);
    dispatchToDraft("kb", action);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    unregisterDraft("ka", a);
    unregisterDraft("kb", b);
  });

  it("ignores a stale unregister from a replaced registration", () => {
    const first = vi.fn();
    const second = vi.fn();
    registerDraft("k3", first);
    registerDraft("k3", second); // remount re-registers
    unregisterDraft("k3", first); // old cleanup runs late
    expect(dispatchToDraft("k3", action)).toBe(true);
    expect(second).toHaveBeenCalledTimes(1);
    unregisterDraft("k3", second);
  });
});
