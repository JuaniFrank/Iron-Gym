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
import { beforeAll, describe, expect, it } from "vitest";

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
