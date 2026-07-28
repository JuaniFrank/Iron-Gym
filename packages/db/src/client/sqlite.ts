import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "../schema/sqlite";

/**
 * Open a SQLite database backed by `expo-sqlite` and wrap it with Drizzle.
 * Call this once at boot (`bootDatabase()` in `app/_layout.tsx`) and reuse
 * the returned instance everywhere — never instantiate per-component.
 *
 * `enableChangeListener: true` is REQUIRED for Drizzle's `useLiveQuery` to
 * react to writes. Without it, queries initialize with the first read and
 * never update after mutations. Symptom: UPDATE runs fine in SQL but the
 * UI never re-renders.
 *
 * Defaults to `ironlog.db` under the platform's app sandbox; override the
 * name in tests or when running multiple isolated DBs in the same app.
 */
export function createSqliteDb(name: string = "ironlog.db") {
  const sqlite = SQLite.openDatabaseSync(name, { enableChangeListener: true });
  return drizzle(sqlite, { schema });
}

export type DB = ReturnType<typeof createSqliteDb>;
