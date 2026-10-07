// Guard against double taps on an async handler (ironlog-port-minor-issues R7).

import { describe, expect, it } from "vitest";

import { runOnce } from "@/utils/runOnce";

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("runOnce", () => {
  it("runs the action once while the first call is in flight", async () => {
    const flag = { current: false };
    const d = deferred();
    let calls = 0;
    const action = () => {
      calls += 1;
      return d.promise;
    };
    const first = runOnce(flag, action);
    const second = runOnce(flag, action);
    d.resolve();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });

  it("stays locked after success (the screen is leaving)", async () => {
    const flag = { current: false };
    let calls = 0;
    await runOnce(flag, async () => {
      calls += 1;
    });
    await runOnce(flag, async () => {
      calls += 1;
    });
    expect(calls).toBe(1);
  });

  it("is released when the action fails so the user can retry", async () => {
    const flag = { current: false };
    await expect(
      runOnce(flag, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(flag.current).toBe(false);
    let calls = 0;
    await runOnce(flag, async () => {
      calls += 1;
    });
    expect(calls).toBe(1);
  });

  it("is released when the action throws synchronously", async () => {
    const flag = { current: false };
    await expect(
      runOnce(flag, () => {
        throw new Error("sync");
      }),
    ).rejects.toThrow("sync");
    expect(flag.current).toBe(false);
  });
});
