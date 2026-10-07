// Active workout · loading vs "no session" (ironlog-port-minor-issues F1).

import { describe, expect, it } from "vitest";

import {
  activeScreenView,
  resolveActiveSessionPhase,
} from "@/domains/workout/activeSessionState";

const loaded = {
  activeIdLoaded: true,
  activeId: "s1" as string | null,
  dataLoaded: true,
  sessionRowId: "s1" as string | undefined,
};

describe("resolveActiveSessionPhase", () => {
  it("is loading until the active id row resolved", () => {
    expect(
      resolveActiveSessionPhase({ ...loaded, activeIdLoaded: false, activeId: null }),
    ).toBe("loading");
  });

  it("is none when the active id resolved to nothing", () => {
    expect(
      resolveActiveSessionPhase({ ...loaded, activeId: null, sessionRowId: undefined }),
    ).toBe("none");
  });

  it("is loading while the session/sets/prs queries are pending", () => {
    expect(resolveActiveSessionPhase({ ...loaded, dataLoaded: false })).toBe("loading");
  });

  it("is none when the active id points to no live session row", () => {
    expect(resolveActiveSessionPhase({ ...loaded, sessionRowId: undefined })).toBe("none");
  });

  it("is loading when the loaded row belongs to a previous active id (stale)", () => {
    expect(resolveActiveSessionPhase({ ...loaded, sessionRowId: "old" })).toBe("loading");
  });

  it("is ready once everything resolved for the current id", () => {
    expect(resolveActiveSessionPhase(loaded)).toBe("ready");
  });
});

describe("activeScreenView", () => {
  it("shows loading while the session is undefined", () => {
    expect(activeScreenView({ session: undefined, startPending: false })).toBe("loading");
  });

  it("shows the empty state only when loaded and there is no session", () => {
    expect(activeScreenView({ session: null, startPending: false })).toBe("empty");
  });

  it("keeps loading while a workout is being started from the route params", () => {
    expect(activeScreenView({ session: null, startPending: true })).toBe("loading");
  });

  it("shows the session when there is one", () => {
    expect(activeScreenView({ session: { id: "s1" }, startPending: true })).toBe("session");
  });
});
