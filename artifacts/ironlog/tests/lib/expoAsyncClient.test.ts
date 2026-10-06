// `expoAsyncClient` adapts expo-sqlite's ASYNC methods to `AsyncSqlClient`.
// expo-sqlite is aliased to a stub under vitest, so these tests drive it with a
// fake database that records every call (and proves no `*Sync` method is used).
import { expoAsyncClient } from "@workspace/db";
import { describe, expect, it } from "vitest";

function createFakeExpoDb(options: { rows?: unknown[][]; failExecute?: boolean } = {}) {
  const calls: string[] = [];
  const db = {
    async runAsync(sql: string, params: unknown[]) {
      calls.push(`runAsync ${sql} ${JSON.stringify(params)}`);
      return { changes: 0, lastInsertRowId: 0 };
    },
    async prepareAsync(sql: string) {
      calls.push(`prepareAsync ${sql}`);
      return {
        async executeForRawResultAsync(params: unknown[]) {
          calls.push(`executeForRawResultAsync ${JSON.stringify(params)}`);
          if (options.failExecute) throw new Error("boom");
          return {
            async getAllAsync() {
              calls.push("getAllAsync");
              return options.rows ?? [];
            },
          };
        },
        async finalizeAsync() {
          calls.push("finalizeAsync");
        },
      };
    },
    // Any sync entry point must never be touched: fail loudly if it is.
    runSync() {
      throw new Error("runSync must not be used");
    },
    getAllSync() {
      throw new Error("getAllSync must not be used");
    },
  };
  return { db, calls };
}

describe("expoAsyncClient", () => {
  it("run delegates to runAsync with the positional params", async () => {
    const { db, calls } = createFakeExpoDb();
    await expoAsyncClient(db).run("insert into t values (?, ?)", [1, "a"]);
    expect(calls).toEqual(['runAsync insert into t values (?, ?) [1,"a"]']);
  });

  it("all prepares, executes for raw rows, reads them and finalizes", async () => {
    const { db, calls } = createFakeExpoDb({ rows: [[1, "a"], [2, "b"]] });
    const rows = await expoAsyncClient(db).all("select id, name from t where id > ?", [0]);
    expect(rows).toEqual([[1, "a"], [2, "b"]]);
    expect(calls).toEqual([
      "prepareAsync select id, name from t where id > ?",
      "executeForRawResultAsync [0]",
      "getAllAsync",
      "finalizeAsync",
    ]);
  });

  it("all finalizes the statement and rethrows when execution fails", async () => {
    const { db, calls } = createFakeExpoDb({ failExecute: true });
    await expect(expoAsyncClient(db).all("select 1", [])).rejects.toThrow("boom");
    expect(calls).toEqual(["prepareAsync select 1", "executeForRawResultAsync []", "finalizeAsync"]);
  });
});
