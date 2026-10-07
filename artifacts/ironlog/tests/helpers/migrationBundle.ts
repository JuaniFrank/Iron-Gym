// Builds the same `{ journal, migrations }` bundle the prod `migrations.js`
// exposes, but straight from disk (vitest cannot inline `.sql` imports).
// Lets tests run the REAL migrations through `migrateAsync` — the prod
// upgrade path — instead of `sqlite.exec` on raw files.

import { readFileSync } from "node:fs";
import path from "node:path";

import type { MigrationsBundle } from "@workspace/db";

export const MIGRATIONS_DIR = path.resolve(
  __dirname,
  "../../../../lib/db/src/migrations/sqlite",
);

export function loadRealBundle(): MigrationsBundle {
  const journal = JSON.parse(
    readFileSync(path.join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8"),
  ) as MigrationsBundle["journal"];
  const migrations: Record<string, string> = {};
  for (const entry of journal.entries) {
    migrations[`m${entry.idx.toString().padStart(4, "0")}`] = readFileSync(
      path.join(MIGRATIONS_DIR, `${entry.tag}.sql`),
      "utf8",
    );
  }
  return { journal, migrations };
}

/** The real bundle truncated to its first `count` entries. */
export function bundleUpTo(count: number): MigrationsBundle {
  const full = loadRealBundle();
  return { journal: { entries: full.journal.entries.slice(0, count) }, migrations: full.migrations };
}
