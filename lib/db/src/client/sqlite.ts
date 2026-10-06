import * as SQLite from "expo-sqlite";
import * as schema from "../schema/sqlite";
import { createAsyncDb, type AsyncDB } from "./asyncDb";
import { expoAsyncClient } from "./expoAsyncClient";

export type DB = AsyncDB<typeof schema>;

/**
 * Open a SQLite database backed by `expo-sqlite` and wrap it with Drizzle
 * (sqlite-proxy over expo's ASYNC API, see `createAsyncDb`).
 * Call this once at boot (`initDb()` in `artifacts/ironlog/services/db.ts`)
 * and reuse the returned instance everywhere — never instantiate per-component.
 *
 * Why async everywhere: on web, `expo-sqlite` runs SQLite inside a Worker and
 * its sync API parks the main thread on the worker's reply. On iOS Safari a
 * write that grows an OPFS file stalls until the main thread is free, so sync
 * calls deadlock. Every query therefore goes through the async API on both
 * platforms; a JS lock serializes them on the single connection.
 *
 * `enableChangeListener: true` is REQUIRED for `useLiveQuery` to react to
 * writes. Without it, queries initialize with the first read and never update
 * after mutations. Symptom: UPDATE runs fine in SQL but the UI never
 * re-renders.
 *
 * `onOpen` receives the raw expo connection before the db is returned, for
 * connection-level setup that must not go through drizzle (e.g. PRAGMAs).
 *
 * Defaults to `ironlog.db` under the platform's app sandbox; override the
 * name in tests or when running multiple isolated DBs in the same app.
 */
export async function createSqliteDb(
  name: string = "ironlog.db",
  options: { onOpen?: (sqlite: SQLite.SQLiteDatabase) => Promise<void> } = {},
): Promise<DB> {
  const sqlite = await SQLite.openDatabaseAsync(name, {
    enableChangeListener: true,
  });
  await options.onOpen?.(sqlite);
  return createAsyncDb(expoAsyncClient(sqlite), { schema });
}
