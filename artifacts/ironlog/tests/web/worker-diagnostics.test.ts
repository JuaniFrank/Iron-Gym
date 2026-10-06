// Tests for expo-sqlite@16.0.10 web/diagnostics.ts (added by
// patches/expo-sqlite@16.0.10.patch). The worker writes a small status board
// (a Float64Array over a SharedArrayBuffer) that the blocked main thread reads
// when a sync call times out: which message the worker is on, which VFS op is
// running and how long it has been running, plus per-message op counters.
import { createRequire } from "node:module";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

type Diag = {
  DIAG_SLOTS: number;
  createDiagBoard: () => SharedArrayBuffer;
  markMessageStart: (board: Float64Array, id: number, now?: number) => void;
  markMessageEnd: (board: Float64Array, id: number) => void;
  instrumentVfs: (vfs: any, getBoard: () => Float64Array | null, now?: () => number) => any;
  formatWorkerState: (
    board: Float64Array,
    now: number,
    call: { id: number; describe: (id: number) => string | null },
  ) => string;
};

let diag: Diag;

beforeAll(async () => {
  const pkgDir = path.dirname(require.resolve("expo-sqlite/package.json"));
  diag = (await import(/* @vite-ignore */ path.join(pkgDir, "web", "diagnostics.ts"))) as Diag;
});

function clock(start = 1_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => (t += ms),
  };
}

describe("instrumentVfs", () => {
  it("returns values, passes arguments and `this` through", () => {
    const board = new Float64Array(diag.createDiagBoard());
    const vfs = {
      tag: "vfs",
      jWrite(this: any, fileId: number, data: string, offset: number) {
        return `${this.tag}:${fileId}:${data}:${offset}`;
      },
    };
    diag.instrumentVfs(vfs, () => board);
    expect(vfs.jWrite(1, "d", 4096)).toBe("vfs:1:d:4096");
  });

  it("propagates exceptions unchanged and still clears the running op", () => {
    const board = new Float64Array(diag.createDiagBoard());
    const boom = new Error("disk full");
    const vfs = {
      jSync() {
        throw boom;
      },
    };
    diag.instrumentVfs(vfs, () => board);
    expect(() => vfs.jSync()).toThrow(boom);
    diag.markMessageStart(board, 5, 1_000);
    expect(diag.formatWorkerState(board, 1_000, { id: 5, describe: () => null })).not.toContain(
      "in jSync",
    );
  });

  it("shows the running op while it executes", () => {
    const c = clock();
    const board = new Float64Array(diag.createDiagBoard());
    let during = "";
    const vfs = {
      jSync() {
        c.advance(500);
        during = diag.formatWorkerState(board, c.now(), { id: 7, describe: () => null });
        return 0;
      },
    };
    diag.instrumentVfs(vfs, () => board, c.now);
    diag.markMessageStart(board, 7, c.now());
    vfs.jSync();
    expect(during).toContain("in jSync for 500 ms");
  });

  it("counts ops and totals per message, and tracks the slowest op", () => {
    const c = clock();
    const board = new Float64Array(diag.createDiagBoard());
    const vfs = {
      jWrite: () => (c.advance(10), 0),
      jSync: () => (c.advance(200), 0),
    };
    diag.instrumentVfs(vfs, () => board, c.now);
    diag.markMessageStart(board, 3, c.now());
    for (let i = 0; i < 3; i++) vfs.jWrite();
    vfs.jSync();
    vfs.jSync();
    const text = diag.formatWorkerState(board, c.now(), { id: 3, describe: () => null });
    expect(text).toContain("jSync×2 400 ms");
    expect(text).toContain("jWrite×3 30 ms");
    expect(text).toContain("slowest jSync 200 ms");
  });

  it("resets counters when a new message starts", () => {
    const c = clock();
    const board = new Float64Array(diag.createDiagBoard());
    const vfs = { jWrite: () => (c.advance(10), 0) };
    diag.instrumentVfs(vfs, () => board, c.now);
    diag.markMessageStart(board, 1, c.now());
    vfs.jWrite();
    diag.markMessageStart(board, 2, c.now());
    expect(diag.formatWorkerState(board, c.now(), { id: 2, describe: () => null })).not.toContain(
      "jWrite",
    );
  });

  it("does nothing special without a board and does not wrap twice", () => {
    let calls = 0;
    const vfs = { jRead: () => (calls++, 0) };
    diag.instrumentVfs(vfs, () => null);
    expect(vfs.jRead()).toBe(0);
    const wrapped = vfs.jRead;
    diag.instrumentVfs(vfs, () => null);
    expect(vfs.jRead).toBe(wrapped);
  });

  it("leaves async methods and missing methods alone", () => {
    const asyncFn = async () => 1;
    const vfs: any = { jRead: asyncFn };
    diag.instrumentVfs(vfs, () => null);
    expect(vfs.jRead).toBe(asyncFn);
    expect(vfs.jWrite).toBeUndefined();
  });
});

describe("formatWorkerState", () => {
  const none = () => null;

  it("says idle when no message is running", () => {
    const board = new Float64Array(diag.createDiagBoard());
    expect(diag.formatWorkerState(board, 5_000, { id: 1, describe: none })).toBe("worker: idle");
    diag.markMessageStart(board, 1, 1_000);
    diag.markMessageEnd(board, 1);
    expect(diag.formatWorkerState(board, 5_000, { id: 2, describe: none })).toBe("worker: idle");
  });

  it("describes the current call when the worker is on it", () => {
    const board = new Float64Array(diag.createDiagBoard());
    diag.markMessageStart(board, 9, 1_000);
    expect(diag.formatWorkerState(board, 4_000, { id: 9, describe: none })).toBe(
      "worker: running this call for 3000 ms, no VFS op active",
    );
  });

  it("names an earlier call the worker is still on", () => {
    const c = clock(10_000);
    const board = new Float64Array(diag.createDiagBoard());
    const vfs = { jSync: () => 0 };
    // Start an op that never "finishes" by writing the running-op slots directly via a hanging wrapper.
    let text = "";
    vfs.jSync = () => {
      c.advance(94_000);
      text = diag.formatWorkerState(board, c.now(), {
        id: 44,
        describe: (id) => (id === 41 ? "run: UPDATE _sync_state SET v = ?" : null),
      });
      return 0;
    };
    diag.instrumentVfs(vfs, () => board, c.now);
    diag.markMessageStart(board, 41, c.now() - 1_000);
    vfs.jSync();
    expect(text).toBe(
      "worker: still on #41 run: UPDATE _sync_state SET v = ? for 95000 ms, in jSync for 94000 ms",
    );
  });

  it("falls back to the bare id for an unknown earlier call", () => {
    const board = new Float64Array(diag.createDiagBoard());
    diag.markMessageStart(board, 41, 1_000);
    expect(diag.formatWorkerState(board, 3_000, { id: 44, describe: none })).toBe(
      "worker: still on #41 (unknown call) for 2000 ms, no VFS op active",
    );
  });
});
