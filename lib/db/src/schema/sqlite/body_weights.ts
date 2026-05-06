import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `body_weights` — daily body-weight log entries.
 *
 * No FK — fully standalone. `date` is a `timestamp_ms`; the dedup invariant
 * (one entry per calendar date) lives in the mutator (`logBodyWeight`
 * upserts on the date), not at the SQL level.
 */
export const bodyWeights = sqliteTable("body_weights", {
  id: text("id").primaryKey(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  weightKg: real("weight_kg").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export type BodyWeight = typeof bodyWeights.$inferSelect;
export type NewBodyWeight = typeof bodyWeights.$inferInsert;
