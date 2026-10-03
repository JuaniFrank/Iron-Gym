import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { startSyncTriggers } from "@/services/sync/triggers";

/** A tiny event source: `emit()` calls the current subscriber (if any). */
function source() {
  let cb: (() => void) | null = null;
  return {
    subscribe: vi.fn((c: () => void) => {
      cb = c;
      return () => {
        cb = null;
      };
    }),
    emit: () => cb?.(),
    get active() {
      return cb !== null;
    },
  };
}

let syncNow: Mock<() => Promise<void>>;
let foreground: ReturnType<typeof source>;
let writes: ReturnType<typeof source>;

const start = () =>
  startSyncTriggers({
    syncNow,
    subscribeForeground: foreground.subscribe,
    subscribeLocalWrites: writes.subscribe,
    debounceMs: 2000,
    intervalMs: 60_000,
  });

beforeEach(() => {
  vi.useFakeTimers();
  syncNow = vi.fn<() => Promise<void>>(() => Promise.resolve());
  foreground = source();
  writes = source();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startSyncTriggers", () => {
  it("syncs immediately on start (sign-in)", () => {
    start();
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it("syncs when the app returns to the foreground", () => {
    start();
    syncNow.mockClear();
    foreground.emit();
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it("debounces a burst of local writes into one sync", () => {
    start();
    syncNow.mockClear();

    writes.emit();
    vi.advanceTimersByTime(1500);
    writes.emit();
    vi.advanceTimersByTime(1500);
    expect(syncNow).not.toHaveBeenCalled();

    vi.advanceTimersByTime(600);
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it("syncs on the interval", () => {
    start();
    syncNow.mockClear();
    vi.advanceTimersByTime(60_000);
    expect(syncNow).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(syncNow).toHaveBeenCalledTimes(2);
  });

  it("stop removes listeners and cancels pending timers", () => {
    const stop = start();
    syncNow.mockClear();
    writes.emit(); // pending debounce

    stop();

    expect(foreground.active).toBe(false);
    expect(writes.active).toBe(false);
    vi.advanceTimersByTime(180_000);
    expect(syncNow).not.toHaveBeenCalled();
  });

  it("never lets a rejected sync escape as an unhandled rejection", async () => {
    syncNow.mockRejectedValue(new Error("boom"));
    expect(() => start()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
  });
});
