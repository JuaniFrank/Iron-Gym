import { describe, expect, it } from "vitest";

import type { SyncStatus } from "@/services/sync/engine";
import {
  describeActivity,
  errorText,
  formatDuration,
  formatRelative,
  pillView,
} from "@/services/sync/statusView";

const NOW = 1_000_000_000;
const status = (over: Partial<SyncStatus>): SyncStatus => ({ state: "idle", log: [], ...over });

describe("formatRelative", () => {
  it("says 'recién' under a minute (and for clock skew)", () => {
    expect(formatRelative(NOW, NOW)).toBe("recién");
    expect(formatRelative(NOW - 59_000, NOW)).toBe("recién");
    expect(formatRelative(NOW + 5_000, NOW)).toBe("recién");
  });

  it("uses minutes up to an hour", () => {
    expect(formatRelative(NOW - 60_000, NOW)).toBe("hace 1 min");
    expect(formatRelative(NOW - 2 * 60_000 - 30_000, NOW)).toBe("hace 2 min");
    expect(formatRelative(NOW - 59 * 60_000, NOW)).toBe("hace 59 min");
  });

  it("uses hours up to a day, then days", () => {
    expect(formatRelative(NOW - 60 * 60_000, NOW)).toBe("hace 1 h");
    expect(formatRelative(NOW - 23 * 3_600_000, NOW)).toBe("hace 23 h");
    expect(formatRelative(NOW - 24 * 3_600_000, NOW)).toBe("hace 1 d");
    expect(formatRelative(NOW - 3 * 86_400_000, NOW)).toBe("hace 3 d");
  });
});

describe("formatDuration", () => {
  it("formats ms, seconds and minutes", () => {
    expect(formatDuration(0)).toBe("0 ms");
    expect(formatDuration(420)).toBe("420 ms");
    expect(formatDuration(1500)).toBe("1.5 s");
    expect(formatDuration(12_000)).toBe("12 s");
    expect(formatDuration(125_000)).toBe("2 min 5 s");
  });
});

describe("errorText", () => {
  it("joins the cause chain", () => {
    const err = new Error("outer", { cause: new Error("inner") });
    expect(errorText(err)).toBe("outer ← inner");
  });

  it("handles strings and unknown values", () => {
    expect(errorText("plain")).toBe("plain");
    expect(errorText(undefined)).toBe("Error desconocido");
    expect(errorText({})).toBe("Error desconocido");
  });
});

describe("describeActivity", () => {
  it("labels each phase with whatever parts exist", () => {
    expect(describeActivity({ phase: "backfill" })).toBe("Backfill");
    expect(describeActivity({ phase: "pull-fetch", table: "exercises" })).toBe("Pull exercises");
    expect(
      describeActivity({ phase: "pull-apply", table: "exercises", done: 25, total: 60 }),
    ).toBe("Pull exercises 25/60");
    expect(describeActivity({ phase: "push", done: 3, total: 10 })).toBe("Push 3/10");
    expect(describeActivity({ phase: "push", done: 3 })).toBe("Push 3");
    expect(describeActivity({ phase: "push" })).toBe("Push");
  });
});

describe("pillView", () => {
  it("is ok with relative time after a sync", () => {
    expect(pillView(status({ lastSyncedAt: NOW - 120_000 }), NOW)).toEqual({
      tone: "ok",
      label: "Sincronizado · hace 2 min",
    });
  });

  it("is plain ok when it never synced", () => {
    expect(pillView(status({}), NOW)).toEqual({ tone: "ok", label: "Sincronizado" });
  });

  it("is syncing with the current activity", () => {
    expect(
      pillView(
        status({
          state: "syncing",
          activity: { phase: "pull-apply", table: "exercises", done: 25, total: 60 },
        }),
        NOW,
      ),
    ).toEqual({ tone: "syncing", label: "Sync · Pull exercises 25/60" });
    expect(
      pillView(status({ state: "syncing", activity: { phase: "push", done: 1, total: 2 } }), NOW),
    ).toEqual({ tone: "syncing", label: "Sync · Push 1/2" });
  });

  it("is syncing without activity details", () => {
    expect(pillView(status({ state: "syncing" }), NOW)).toEqual({
      tone: "syncing",
      label: "Sync",
    });
  });

  it("is an error", () => {
    expect(pillView(status({ state: "error", lastError: new Error("x") }), NOW)).toEqual({
      tone: "error",
      label: "Error de sync",
    });
  });

  it("flags an account mismatch as an error tone", () => {
    expect(pillView(status({ state: "account_mismatch" }), NOW)).toEqual({
      tone: "error",
      label: "Cuenta distinta",
    });
  });
});
