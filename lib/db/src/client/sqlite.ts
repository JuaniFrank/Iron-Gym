import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "../schema/sqlite";

export type DB = ExpoSQLiteDatabase<typeof schema>;

/**
 * Open a SQLite database backed by `expo-sqlite` and wrap it with Drizzle.
 * Call this once at boot (`initDb()` in `artifacts/ironlog/services/db.ts`)
 * and reuse the returned instance everywhere — never instantiate per-component.
 *
 * Why async: on web, `expo-sqlite` runs SQLite inside a Worker. The sync open
 * (`openDatabaseSync`) busy-loops the main thread with `Atomics.pause` while
 * waiting for the worker to respond, but the worker can't finish loading its
 * bundle + WASM inside that timeout. Using `openDatabaseAsync` for the
 * initial open lets the worker start up via normal `postMessage` first; once
 * it's warm, drizzle's subsequent sync queries work because the worker
 * responds immediately. On native, `openDatabaseAsync` is a thin wrapper
 * around the same native open and behaves the same as sync — there's no
 * downside to using async on both platforms.
 *
 * `enableChangeListener: true` is REQUIRED for Drizzle's `useLiveQuery` to
 * react to writes. Without it, queries initialize with the first read and
 * never update after mutations. Symptom: UPDATE runs fine in SQL but the UI
 * never re-renders.
 *
 * Defaults to `ironlog.db` under the platform's app sandbox; override the
 * name in tests or when running multiple isolated DBs in the same app.
 */
export async function createSqliteDb(
  name: string = "ironlog.db",
): Promise<DB> {
  const sqlite = await SQLite.openDatabaseAsync(name, {
    enableChangeListener: true,
  });
  return drizzle(sqlite, { schema });
}
