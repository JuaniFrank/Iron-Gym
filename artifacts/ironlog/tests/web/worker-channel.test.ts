// Regression test for expo-sqlite@16.0.10 web/WorkerChannel.ts (patched via
// patches/expo-sqlite@16.0.10.patch). Upstream wrote the result length with
// `Uint8Array.set(new Uint32Array([n]))`, which stores only `n % 256`, so every
// sync result larger than 255 bytes was truncated on the reader side.
//
// The real module is imported by absolute path (the vitest `expo-sqlite`
// alias only applies to bare specifiers). A fake worker answers synchronously
// on the same thread by calling the real `sendWorkerResult` with the
// SharedArrayBuffers handed to it, then the real `invokeWorkerSync` reads them.
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);

type Channel = {
  sendWorkerResult: (args: any) => void;
  invokeWorkerSync: (worker: any, type: any, data: any) => any;
};

let channel: Channel;

beforeAll(async () => {
  (globalThis as any).__DEV__ = false;
  const pkgDir = path.dirname(require.resolve("expo-sqlite/package.json"));
  channel = (await import(
    /* @vite-ignore */ path.join(pkgDir, "web", "WorkerChannel.ts")
  )) as Channel;
});

function roundTrip(result: unknown) {
  const worker = {
    postMessage(msg: any) {
      channel.sendWorkerResult({
        id: msg.id,
        result,
        error: null,
        syncTrait: { lockBuffer: msg.lockBuffer, resultBuffer: msg.resultBuffer },
      });
    },
  };
  return channel.invokeWorkerSync(worker, "exec" as any, {} as any);
}

describe("expo-sqlite WorkerChannel length header", () => {
  it.each([10, 255, 256, 300, 70_000, 600_000])(
    "round-trips a result of ~%i bytes intact",
    (size) => {
      const payload = { rows: ["x".repeat(size)] };
      expect(roundTrip(payload)).toEqual(payload);
    },
  );
});

// Upstream's "timeout" counts busy-loop iterations (1M `Atomics.pause()` calls,
// a few milliseconds), not time. On slow devices (iPhone OPFS writes during a
// large seed transaction) a legitimate sync call exceeded it and boot failed
// with "Sync operation timeout". The patch makes it a wall-clock deadline.
describe("expo-sqlite WorkerChannel sync timeout", () => {
  it("waits for a worker that answers after 300ms", async () => {
    const { Worker } = await import("node:worker_threads");
    const responder = new Worker(
      `
      const { parentPort } = require("node:worker_threads");
      parentPort.on("message", ({ lockBuffer, resultBuffer }) => {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
        const bytes = new TextEncoder().encode(JSON.stringify({ result: { ok: true } }));
        new DataView(resultBuffer).setUint32(0, bytes.length, true);
        new Uint8Array(resultBuffer).set(bytes, 4);
        const lock = new Int32Array(lockBuffer);
        Atomics.store(lock, 0, 2);
        Atomics.notify(lock, 0);
      });
      `,
      { eval: true },
    );
    await new Promise((r) => responder.once("online", r));
    try {
      const worker = { postMessage: (msg: any) => responder.postMessage(msg) };
      expect(channel.invokeWorkerSync(worker, "exec" as any, {} as any)).toEqual({ ok: true });
    } finally {
      await responder.terminate();
    }
  });
});

// Errors cross the SharedArrayBuffer as JSON, and `JSON.stringify(new Error("x"))`
// is `{}`, so upstream surfaced every worker failure as "[object Object]".
describe("expo-sqlite WorkerChannel sync errors", () => {
  it("throws an Error carrying the worker error message", () => {
    const worker = {
      postMessage(msg: any) {
        channel.sendWorkerResult({
          id: msg.id,
          result: null,
          error: new Error("cannot start a transaction within a transaction"),
          syncTrait: { lockBuffer: msg.lockBuffer, resultBuffer: msg.resultBuffer },
        });
      },
    };
    expect(() => channel.invokeWorkerSync(worker, "exec" as any, {} as any)).toThrow(
      new Error("cannot start a transaction within a transaction"),
    );
  });
});

// The 1 MB result buffer used to be allocated on every sync call (several per
// query). Calls on the main thread are strictly sequential, so one pair is
// reused. After a timeout the worker may still reply late, so that pair is
// abandoned and the next call gets fresh buffers.
describe("expo-sqlite WorkerChannel buffer reuse", () => {
  afterEach(() => vi.restoreAllMocks());

  function recordingWorker(seen: any[], answer = true) {
    return {
      postMessage(msg: any) {
        seen.push(msg);
        if (!answer) return;
        channel.sendWorkerResult({
          id: msg.id,
          result: { ok: true } as any,
          error: null,
          syncTrait: { lockBuffer: msg.lockBuffer, resultBuffer: msg.resultBuffer },
        });
      },
    };
  }

  it("reuses the same buffers across consecutive calls", () => {
    const seen: any[] = [];
    const worker = recordingWorker(seen);
    channel.invokeWorkerSync(worker as any, "exec" as any, {} as any);
    channel.invokeWorkerSync(worker as any, "exec" as any, {} as any);
    expect(seen[1].lockBuffer).toBe(seen[0].lockBuffer);
    expect(seen[1].resultBuffer).toBe(seen[0].resultBuffer);
  });

  it("allocates fresh buffers after a timed-out call and keeps working", () => {
    const seen: any[] = [];
    // Warm up so a shared pair exists, then time out with a silent worker.
    channel.invokeWorkerSync(recordingWorker(seen) as any, "exec" as any, {} as any);
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => (now += 5_000));
    expect(() =>
      channel.invokeWorkerSync(recordingWorker(seen, false) as any, "exec" as any, {} as any),
    ).toThrow("Sync operation timeout");
    vi.restoreAllMocks();

    expect(channel.invokeWorkerSync(recordingWorker(seen) as any, "exec" as any, {} as any)).toEqual({
      ok: true,
    });
    const [, timedOut, next] = seen;
    expect(next.lockBuffer).not.toBe(timedOut.lockBuffer);
    expect(next.resultBuffer).not.toBe(timedOut.resultBuffer);
  });
});

// A device run needs to know WHICH statement hangs, so the timeout error names
// the worker call type, the SQL (tracked per prepared statement id) and the
// elapsed time.
describe("expo-sqlite WorkerChannel timeout diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  const answering = {
    postMessage(msg: any) {
      channel.sendWorkerResult({
        id: msg.id,
        result: null,
        error: null,
        syncTrait: { lockBuffer: msg.lockBuffer, resultBuffer: msg.resultBuffer },
      });
    },
  };
  const silent = { postMessage() {} };

  function timeoutMessage(type: string, data: any): string {
    // Each Date.now() call advances 5 s, so the 30 s deadline passes quickly.
    let now = 2_000_000;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => (now += 5_000));
    try {
      channel.invokeWorkerSync(silent as any, type as any, data);
    } catch (e: any) {
      return e.message;
    } finally {
      spy.mockRestore();
    }
    throw new Error("expected a timeout");
  }

  it("names the call type, the statement SQL and the elapsed ms for a prepared statement", () => {
    channel.invokeWorkerSync(answering as any, "prepare" as any, {
      nativeDatabaseId: 1,
      nativeStatementId: 101,
      source: "UPDATE _sync_state\n   SET value = ?  WHERE key = 'applying'",
    });
    const message = timeoutMessage("run", { nativeDatabaseId: 1, nativeStatementId: 101 });
    expect(message).toMatch(/^Sync operation timeout/);
    expect(message).toContain("run");
    expect(message).toContain("UPDATE _sync_state SET value = ? WHERE key = 'applying'");
    expect(message).toMatch(/\d+ ms/);
  });

  it("includes the source of an exec call", () => {
    const message = timeoutMessage("exec", { nativeDatabaseId: 1, source: "BEGIN IMMEDIATE" });
    expect(message).toContain("exec");
    expect(message).toContain("BEGIN IMMEDIATE");
  });

  it("truncates long SQL with an ellipsis", () => {
    const message = timeoutMessage("exec", { nativeDatabaseId: 1, source: "SELECT " + "x".repeat(500) });
    expect(message).toContain("…");
    expect(message.length).toBeLessThan(300);
  });

  it("forgets the statement SQL after finalize", () => {
    channel.invokeWorkerSync(answering as any, "prepare" as any, {
      nativeDatabaseId: 1,
      nativeStatementId: 202,
      source: "SELECT secret_marker FROM t",
    });
    channel.invokeWorkerSync(answering as any, "finalize" as any, {
      nativeDatabaseId: 1,
      nativeStatementId: 202,
    });
    const message = timeoutMessage("step", { nativeDatabaseId: 1, nativeStatementId: 202 });
    expect(message).toContain("step");
    expect(message).not.toContain("secret_marker");
  });
});

// The timeout message also reports what the worker was doing, read from the
// shared status board the worker writes to (see web/diagnostics.ts). When the
// worker is still on an EARLIER call (a timed-out write whose ROLLBACK then
// timed out too), that call is named so the masked statement is visible.
describe("expo-sqlite WorkerChannel worker-state diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  let diag: any;
  beforeAll(async () => {
    const pkgDir = path.dirname(require.resolve("expo-sqlite/package.json"));
    diag = await import(/* @vite-ignore */ path.join(pkgDir, "web", "diagnostics.ts"));
  });

  const answering = {
    postMessage(msg: any) {
      channel.sendWorkerResult({
        id: msg.id,
        result: null,
        error: null,
        syncTrait: { lockBuffer: msg.lockBuffer, resultBuffer: msg.resultBuffer },
      });
    },
  };

  /** A worker that records the board and runs `onMessage` against it, never answering. */
  function hangingWorker(onMessage: (board: Float64Array, msg: any) => void) {
    return {
      postMessage(msg: any) {
        expect(msg.diagBuffer).toBeInstanceOf(SharedArrayBuffer);
        onMessage(new Float64Array(msg.diagBuffer), msg);
      },
    };
  }

  function timeoutMessage(worker: any, type: string, data: any): string {
    let now = 3_000_000;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => (now += 5_000));
    try {
      channel.invokeWorkerSync(worker, type as any, data);
    } catch (e: any) {
      return e.message;
    } finally {
      spy.mockRestore();
    }
    throw new Error("expected a timeout");
  }

  it("sends the same diagnostics board with every message", () => {
    const seen: any[] = [];
    const recording = {
      postMessage(msg: any) {
        seen.push(msg);
        answering.postMessage(msg);
      },
    };
    channel.invokeWorkerSync(recording as any, "exec" as any, {} as any);
    channel.invokeWorkerSync(recording as any, "exec" as any, {} as any);
    expect(seen[0].diagBuffer).toBeInstanceOf(SharedArrayBuffer);
    expect(seen[1].diagBuffer).toBe(seen[0].diagBuffer);
  });

  it("keeps the board across a timeout (it is a status board, not a reply channel)", () => {
    const boards: any[] = [];
    const worker = hangingWorker((_b, msg) => boards.push(msg.diagBuffer));
    timeoutMessage(worker, "exec", { source: "BEGIN" });
    timeoutMessage(worker, "exec", { source: "BEGIN" });
    expect(boards[1]).toBe(boards[0]);
  });

  it("reports the VFS op the worker is stuck in", () => {
    const worker = hangingWorker((board, msg) => {
      diag.markMessageStart(board, msg.id, 3_000_000);
      // A jSync that never returns: the running-op slots stay set (layout in diagnostics.ts).
      board[2] = diag.VFS_OPS.indexOf("jSync") + 1;
      board[3] = 3_000_000;
    });
    const message = timeoutMessage(worker, "exec", { nativeDatabaseId: 1, source: "BEGIN" });
    expect(message).toMatch(/^Sync operation timeout \(exec: BEGIN, \d+ ms; worker: running this call for \d+ ms, in jSync for \d+ ms\)$/);
  });

  it("names the earlier call the worker is still on", () => {
    let stuckId = -1;
    // First call: the worker picks it up, starts a write and never finishes.
    const first = hangingWorker((board, msg) => {
      stuckId = msg.id;
      diag.markMessageStart(board, msg.id, 3_000_000);
    });
    timeoutMessage(first, "exec", { nativeDatabaseId: 1, source: "UPDATE _sync_state SET value = 1" });
    // Second call (the ROLLBACK): the worker never even starts it.
    const second = { postMessage() {} };
    const message = timeoutMessage(second, "exec", { nativeDatabaseId: 1, source: "ROLLBACK" });
    expect(message).toContain("exec: ROLLBACK");
    expect(message).toContain(`worker: still on #${stuckId} exec: UPDATE _sync_state SET value = 1 for`);
  });

  it("says the worker is idle when it is not running anything", () => {
    // The board is module-level state shared by earlier tests: clear it, as an idle worker would.
    const idle = hangingWorker((board) => board.fill(0));
    const message = timeoutMessage(idle, "exec", { source: "SELECT 1" });
    expect(message).toMatch(/^Sync operation timeout \(exec: SELECT 1, \d+ ms; worker: idle\)$/);
  });
});
