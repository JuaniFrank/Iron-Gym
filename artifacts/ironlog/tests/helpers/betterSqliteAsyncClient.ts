// better-sqlite3 implementation of `AsyncSqlClient` for tests. Every method
// yields to the event loop first so interleaving bugs (missing lock, leaked
// transactions) are observable, the way they are over expo-sqlite's async API.
import type Database from "better-sqlite3";

import type { AsyncSqlClient } from "@workspace/db";

export type BetterSqliteAsyncClient = AsyncSqlClient & {
  /** Every SQL string the client received, in arrival order. */
  readonly log: string[];
};

export function createBetterSqliteAsyncClient(
  sqlite: Database.Database,
  options: { delayMs?: number } = {},
): BetterSqliteAsyncClient {
  const { delayMs = 0 } = options;
  const log: string[] = [];
  const tick = () =>
    delayMs > 0
      ? new Promise<void>((resolve) => setTimeout(resolve, delayMs))
      : new Promise<void>((resolve) => setImmediate(resolve));

  return {
    log,
    async run(sql, params) {
      await tick();
      log.push(sql);
      const stmt = sqlite.prepare(sql);
      if (stmt.reader) stmt.raw().all(...params);
      else stmt.run(...params);
    },
    async all(sql, params) {
      await tick();
      log.push(sql);
      const stmt = sqlite.prepare(sql);
      if (!stmt.reader) {
        stmt.run(...params);
        return [];
      }
      return stmt.raw().all(...params) as unknown[][];
    },
  };
}
