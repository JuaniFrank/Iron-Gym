import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `_outbox` — pending local changes waiting to be pushed to the remote.
 *
 * Populated exclusively by AFTER INSERT/UPDATE/DELETE triggers on the syncable
 * tables (see the custom sync-capture migration). One pending entry per row:
 * the composite primary key `(table_name, row_id)` lets the triggers upsert, so
 * the latest `op` wins and `queued_at` (epoch ms) is refreshed.
 *
 * `row_id` is the row's primary key rendered as text. Every syncable table has
 * a single-column key (`id`, `date_key` or `day_of_week`), so the value is that
 * column cast to TEXT.
 *
 * `op` is `'upsert'` (insert or update) or `'delete'` (tombstone).
 *
 * Device-local bookkeeping: never synced itself.
 */
export const outbox = sqliteTable(
  "_outbox",
  {
    tableName: text("table_name").notNull(),
    rowId: text("row_id").notNull(),
    op: text("op", { enum: ["upsert", "delete"] }).notNull(),
    queuedAt: integer("queued_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tableName, t.rowId] })],
);

export type OutboxEntry = typeof outbox.$inferSelect;
export type NewOutboxEntry = typeof outbox.$inferInsert;
