import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `key_value` — catch-all table for singletons that don't justify their own
 * table (e.g. `default_rest_seconds`, `active_workout_id`). The `value` column
 * is stored as JSON so callers can persist primitives, objects, or arrays
 * without schema churn.
 *
 * `updatedAt` is included because these rows ARE part of the user state and
 * benefit from sync metadata. No `deletedAt` — deletion is physical (the row
 * either exists or it doesn't).
 */
export const keyValue = sqliteTable("key_value", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type KeyValue = typeof keyValue.$inferSelect;
export type NewKeyValue = typeof keyValue.$inferInsert;
