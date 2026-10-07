import { sql } from "drizzle-orm";

import type { AsyncDB } from "./client/asyncDb";

/** Shape of the bundle `drizzle-kit generate` emits for the `expo` driver. */
export interface MigrationsBundle {
  journal: { entries: { idx: number; tag: string; when: number; breakpoints?: boolean }[] };
  migrations: Record<string, string>;
}

const MIGRATIONS_TABLE = "__drizzle_migrations";

// `ALTER TABLE <t> ADD [COLUMN] <c> ...` (drizzle-kit emits both spellings,
// quoted or not). SQLite has no `ADD COLUMN IF NOT EXISTS`, so a device whose
// schema already has the column (e.g. one that ran an unmerged branch build)
// would crash boot with "duplicate column name".
const ADD_COLUMN_STATEMENT = /^(?:\s*--[^\n]*\n)*\s*ALTER\s+TABLE\s+(?:`[^`]+`|"[^"]+"|\[[^\]]+\]|\S+)\s+ADD\s/i;

function errorMessages(error: unknown): string {
  const messages: string[] = [];
  for (let e = error; e instanceof Error && messages.length < 5; e = e.cause) {
    messages.push(e.message);
  }
  return messages.join("\n");
}

/**
 * Whether `error` is SQLite's "duplicate column name" raised by an
 * `ALTER TABLE ... ADD` statement: the column is already there, so the
 * statement's intent is satisfied. Deliberately narrow: any other statement
 * (e.g. a `CREATE TABLE` with a repeated column) or any other error still fails.
 */
function isAlreadyAppliedAddColumn(statement: string, error: unknown): boolean {
  return (
    ADD_COLUMN_STATEMENT.test(statement) &&
    /duplicate column name/i.test(errorMessages(error))
  );
}

/**
 * Apply pending migrations through our async db. Mirrors drizzle's
 * `SQLiteAsyncDialect.migrate` + expo `readMigrationFiles` exactly (same
 * `__drizzle_migrations` table, empty hash, skip anything not newer than the
 * last recorded `created_at`) so installs migrated by drizzle's expo migrator
 * keep working. Unlike drizzle's, the apply step runs inside `db.transaction`,
 * so it holds our connection lock for the whole run.
 *
 * Also unlike drizzle's: an `ALTER TABLE ... ADD <column>` that fails with
 * "duplicate column name" counts as already applied (statement-scoped; every
 * other error still aborts and rolls back the whole run).
 */
export async function migrateAsync(
  db: AsyncDB<any>,
  { journal, migrations }: MigrationsBundle,
): Promise<void> {
  const pending = journal.entries.map((entry) => {
    const query = migrations[`m${entry.idx.toString().padStart(4, "0")}`];
    if (!query) throw new Error(`Missing migration: ${entry.tag}`);
    return {
      statements: query.split("--> statement-breakpoint"),
      folderMillis: entry.when,
    };
  });

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS ${sql.identifier(MIGRATIONS_TABLE)} (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `);
  const rows = await db.values(
    sql`SELECT id, hash, created_at FROM ${sql.identifier(MIGRATIONS_TABLE)} ORDER BY created_at DESC LIMIT 1`,
  );
  const last = rows[0] as unknown[] | undefined;

  await db.transaction(async (tx) => {
    for (const migration of pending) {
      if (last && Number(last[2]) >= migration.folderMillis) continue;
      for (const statement of migration.statements) {
        try {
          await tx.run(sql.raw(statement));
        } catch (error) {
          if (!isAlreadyAppliedAddColumn(statement, error)) throw error;
        }
      }
      await tx.run(
        sql`INSERT INTO ${sql.identifier(MIGRATIONS_TABLE)} ("hash", "created_at") VALUES(${""}, ${migration.folderMillis})`,
      );
    }
  });
}
