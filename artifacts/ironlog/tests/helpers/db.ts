// Test DB helper. Creates a fresh `better-sqlite3` in-memory database,
// applies the SAME drizzle migrations the prod boot pipeline runs, and
// rewires `services/db` so every mutator + query under test sees this
// connection.
//
// Why better-sqlite3 (not expo-sqlite mocked)?
// IronLog convention (cf. db-integration.md §7 + the user's no-mock-DB
// rule): tests against a real DB, same dialect as prod. The whole point
// is to catch SQL/migration breakage in CI before it ships.
//
// DRIVER PATH — same as prod. `createTestDb()` builds the db with
// `createAsyncDb` (drizzle sqlite-proxy + FIFO lock + async transactions) over a
// better-sqlite3 facade, so tests exercise the exact async code path the app
// runs on expo-sqlite, including the lock and BEGIN/COMMIT/ROLLBACK lifecycle.
//
// MIGRATION APPROACH.
// We read the raw `.sql` files from `lib/db/src/migrations/sqlite` and
// `sqlite.exec()` them. drizzle-orm's better-sqlite3 migrator works too
// but expects a specific bundle layout that doesn't match the expo
// migrator's shape (the `migrations.js` file there is a JS module the
// expo driver consumes via `babel-plugin-inline-import`). Exec'ing the
// raw .sql is simpler, doesn't need a transpile step, and uses the
// SAME .sql payload that ships to prod via the inline-imported bundle.

import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { createAsyncDb, type DB as ProdDB } from "@workspace/db";
import * as schema from "@workspace/db/schema";

import { useTestDb } from "../setup";
import { createBetterSqliteAsyncClient } from "./betterSqliteAsyncClient";

const MIGRATIONS_DIR = path.resolve(
  __dirname,
  "../../../../lib/db/src/migrations/sqlite",
);

let cachedMigrations: string[] | null = null;

function loadMigrationSql(): string[] {
  if (cachedMigrations) return cachedMigrations;
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  cachedMigrations = files.map((f) =>
    readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"),
  );
  return cachedMigrations;
}

/** Public test DB type — the prod async `DB`. */
export type TestDb = ProdDB;

/**
 * Create a fresh in-memory DB, apply migrations, rewire the singleton.
 * Returns the async drizzle handle (mutator-compatible) plus the raw
 * sqlite handle for tests that want to peek at `_meta` rows or run
 * pragma assertions.
 */
export function createTestDb(): {
  db: TestDb;
  sqlite: Database.Database;
} {
  const sqlite = new Database(":memory:");
  // Match expo-sqlite's default-on FK enforcement.
  sqlite.pragma("foreign_keys = ON");

  for (const sql of loadMigrationSql()) {
    sqlite.exec(sql);
  }

  const db = createAsyncDb(createBetterSqliteAsyncClient(sqlite), { schema });
  useTestDb(db);
  return { db, sqlite };
}
