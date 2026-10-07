// Active workout · "session ended" flag around finish/discard
// (ironlog-port-minor-issues R4): drafts must stop saving BEFORE the session
// is closed, but keep saving if closing fails.

import { describe, expect, it } from "vitest";

import { withSessionEnding } from "@/domains/workout/sessionEnd";

describe("withSessionEnding", () => {
  it("raises the flag before the action runs", async () => {
    const flag = { current: false };
    let seenInside: boolean | undefined;
    await withSessionEnding(flag, async () => {
      seenInside = flag.current;
    });
    expect(seenInside).toBe(true);
  });

  it("keeps the flag up after the action succeeds and returns its value", async () => {
    const flag = { current: false };
    await expect(withSessionEnding(flag, async () => 42)).resolves.toBe(42);
    expect(flag.current).toBe(true);
  });

  it("lowers the flag again and rethrows when the action fails", async () => {
    const flag = { current: false };
    const boom = new Error("boom");
    await expect(
      withSessionEnding(flag, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(flag.current).toBe(false);
  });

  it("lowers the flag when the action throws synchronously", async () => {
    const flag = { current: false };
    await expect(
      withSessionEnding(flag, () => {
        throw new Error("sync");
      }),
    ).rejects.toThrow("sync");
    expect(flag.current).toBe(false);
  });
});
