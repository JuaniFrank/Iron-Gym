import { sql } from "drizzle-orm";

import type { AsyncDB } from "./client/asyncDb";

/** Shape of the bundle `drizzle-kit generate` emits for the `expo` driver. */
export interface MigrationsBundle {
  journal: { entries: { idx: number; tag: string; when: number; breakpoints?: boolean }[] };
  migrations: Record<string, string>;
}

const MIGRATIONS_TABLE = "__drizzle_migrations";

/**
 * Apply pending migrations through our async db. Mirrors drizzle's
 * `SQLiteAsyncDialect.migrate` + expo `readMigrationFiles` exactly (same
 * `__drizzle_migrations` table, empty hash, skip anything not newer than the
 * last recorded `created_at`) so installs migrated by drizzle's expo migrator
 * keep working. Unlike drizzle's, the apply step runs inside `db.transaction`,
 * so it holds our connection lock for the whole run.
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
        await tx.run(sql.raw(statement));
      }
      await tx.run(
        sql`INSERT INTO ${sql.identifier(MIGRATIONS_TABLE)} ("hash", "created_at") VALUES(${""}, ${migration.folderMillis})`,
      );
    }
  });
}
