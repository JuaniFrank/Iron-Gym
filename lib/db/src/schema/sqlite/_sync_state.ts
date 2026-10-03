import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `_sync_state` — device-local key/value state for the sync engine.
 *
 * Seeded with `applying = '0'`. The sync engine sets it to `'1'` while applying
 * pulled remote changes so the capture triggers do not echo them back into
 * `_outbox`. Later tasks also keep per-table pull cursors here.
 *
 * Never synced.
 */
export const syncState = sqliteTable("_sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type SyncState = typeof syncState.$inferSelect;
export type NewSyncState = typeof syncState.$inferInsert;
