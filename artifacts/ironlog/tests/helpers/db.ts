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
// TRANSACTION SEMANTICS — mirror prod (expo-sqlite), NOT better-sqlite3.
// Prod mutators call `db.transaction((tx) => { ... })` with a SYNCHRONOUS
// callback. drizzle's expo-sqlite session runs `begin`, calls the callback,
// then `commit` as soon as it RETURNS (rollback if it throws) — it never
// awaits. So an `async` callback commits at its first `await` and later
// statements run outside the transaction with no rollback (the bug fixed in
// ironlog-web-compat T4). better-sqlite3's native drizzle transaction would
// instead throw on async callbacks, hiding that class of bug differently, so
// we wrap `.transaction()` to reproduce the expo lifecycle exactly:
//   1. BEGIN
//   2. result = cb(tx)   (NOT awaited)
//   3. COMMIT on return, ROLLBACK on throw
// Atomicity tests (tests/atomicity.test.ts) rely on this faithfulness.
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
import { drizzle as drizzleBetter } from "drizzle-orm/better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type { DB as ProdDB } from "@workspace/db";
import * as schema from "@workspace/db/schema";

import { useTestDb } from "../setup";

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

type RawDb = ReturnType<typeof drizzleBetter<typeof schema>>;

/**
 * Wrap a drizzle better-sqlite3 db so `.transaction(cb)` follows the
 * expo-sqlite session lifecycle (see header). Nested transactions
 * (savepoints) aren't handled — none of the IronLog mutators nest.
 */
function wrapExpoTransaction(db: RawDb, sqlite: Database.Database): RawDb {
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === "transaction") {
        return <T,>(cb: (tx: RawDb) => T): T => {
          sqlite.exec("BEGIN");
          try {
            // Same wrapped handle as `tx` — avoids a separate tx surface.
            const result = cb(receiver as RawDb);
            sqlite.exec("COMMIT");
            return result;
          } catch (err) {
            sqlite.exec("ROLLBACK");
            throw err;
          }
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Public test DB type — assignment-compatible with the prod
 * `ExpoSQLiteDatabase` thanks to the type assertion in `createTestDb()`.
 *
 * Both drivers extend the same `BaseSQLiteDatabase<'sync', ...>` and
 * expose the same query surface. The only divergence is the
 * `RunResult` shape (`lastInsertRowid` vs `lastInsertRowId`), which
 * none of the IronLog mutators inspect — they read inserted rows back
 * via SELECTs. Casting at the helper boundary keeps every test file
 * (and the rest of the prod code that types its `db` parameter as
 * `DB`) free of cast noise.
 */
export type TestDb = ProdDB;

/**
 * Create a fresh in-memory DB, apply migrations, rewire the singleton.
 * Returns the wrapped drizzle handle (mutator-compatible) plus the raw
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

  const raw = drizzleBetter(sqlite, { schema });
  const wrapped = wrapExpoTransaction(raw, sqlite);
  // Single cast at the boundary — see `TestDb` doc.
  const db = wrapped as unknown as TestDb;
  useTestDb(db);
  return { db, sqlite };
}
