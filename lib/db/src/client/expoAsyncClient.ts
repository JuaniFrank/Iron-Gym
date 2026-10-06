import type { AsyncSqlClient } from "./asyncDb";

/**
 * The slice of expo-sqlite's `SQLiteDatabase` the adapter uses: ASYNC methods
 * only. The sync API blocks the JS thread (on web it parks the main thread on
 * the worker, which deadlocks OPFS writes on iOS Safari), so it is never used.
 */
export interface ExpoAsyncDatabase {
  runAsync(sql: string, params: any[]): Promise<unknown>;
  prepareAsync(sql: string): Promise<{
    executeForRawResultAsync(params: any[]): Promise<{
      getAllAsync(): Promise<unknown[][]>;
    }>;
    finalizeAsync(): Promise<void>;
  }>;
}

/**
 * `AsyncSqlClient` over expo-sqlite's async API. `all` returns positional rows
 * (`executeForRawResultAsync`), which is what drizzle's sqlite-proxy maps from.
 * Drizzle always passes positional params as an array.
 */
export function expoAsyncClient(sqlite: ExpoAsyncDatabase): AsyncSqlClient {
  return {
    async run(sql, params) {
      await sqlite.runAsync(sql, params);
    },
    async all(sql, params) {
      const statement = await sqlite.prepareAsync(sql);
      try {
        const result = await statement.executeForRawResultAsync(params);
        return await result.getAllAsync();
      } finally {
        await statement.finalizeAsync();
      }
    },
  };
}
