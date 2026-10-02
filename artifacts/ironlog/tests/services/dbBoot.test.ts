import { describe, expect, it, vi } from "vitest";

import { bootWithRetry, classifyBootError } from "@/services/dbBoot";

const lockError = () =>
  new Error(
    "NoModificationAllowedError: Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle'",
  );

describe("classifyBootError", () => {
  it("detects an OPFS lock by error name", () => {
    const e = new Error("x");
    e.name = "NoModificationAllowedError";
    expect(classifyBootError(e)).toBe("locked");
  });
  it.each([
    "NoModificationAllowedError: blah",
    "Failed to execute 'createSyncAccessHandle'",
    "Access Handles cannot be created if there is another open Access Handle",
    "Error: Invalid VFS state",
  ])("detects lock by message: %s", (m) => {
    expect(classifyBootError(new Error(m))).toBe("locked");
  });
  it("treats anything else as other", () => {
    expect(classifyBootError(new Error("no such table"))).toBe("other");
    expect(classifyBootError("weird")).toBe("other");
    expect(classifyBootError(undefined)).toBe("other");
  });
});

describe("bootWithRetry", () => {
  it("returns without sleeping when boot succeeds first time", async () => {
    const boot = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn();
    await bootWithRetry(boot, { retryLocked: true, sleep });
    expect(boot).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries lock errors with backoff then succeeds", async () => {
    const boot = vi
      .fn()
      .mockRejectedValueOnce(lockError())
      .mockRejectedValueOnce(lockError())
      .mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await bootWithRetry(boot, { retryLocked: true, sleep, delaysMs: [100, 200, 300] });
    expect(boot).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200]);
  });

  it("gives up after delays are exhausted and rethrows the lock error", async () => {
    const err = lockError();
    const boot = vi.fn().mockRejectedValue(err);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      bootWithRetry(boot, { retryLocked: true, sleep, delaysMs: [1, 2, 3] }),
    ).rejects.toBe(err);
    expect(boot).toHaveBeenCalledTimes(4);
  });

  it("does not retry non-lock errors", async () => {
    const err = new Error("migration failed");
    const boot = vi.fn().mockRejectedValue(err);
    const sleep = vi.fn();
    await expect(bootWithRetry(boot, { retryLocked: true, sleep })).rejects.toBe(err);
    expect(boot).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("does not retry lock errors when retryLocked is false (native)", async () => {
    const boot = vi.fn().mockRejectedValue(lockError());
    await expect(bootWithRetry(boot, { retryLocked: false, sleep: vi.fn() })).rejects.toBeDefined();
    expect(boot).toHaveBeenCalledTimes(1);
  });
});
