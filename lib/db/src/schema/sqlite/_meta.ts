import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `_meta` — singleton key/value table for runtime versioning state.
 * Holds rows like `schema_version`, `seed_version`, `seeded_at` (cf. DDB-8 +
 * DDB-15 in `artifacts/ironlog/db-integration.md`).
 *
 * No `updatedAt` / `deletedAt` here on purpose: this is bookkeeping for the
 * migrations + seed pipelines, never synced and never soft-deleted.
 */
export const meta = sqliteTable("_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Meta = typeof meta.$inferSelect;
export type NewMeta = typeof meta.$inferInsert;
