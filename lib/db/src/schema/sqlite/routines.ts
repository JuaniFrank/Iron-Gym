import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `routines` — user-defined and preset training routines.
 *
 * Decomposed across 3 tables (DDB-9): `routines` → `routine_days` →
 * `routine_exercises`. Mutators are already day-/exercise-granular, so
 * normalizing pays off (cascade delete, query inverse, no JSON parsing
 * in queries).
 *
 * `goal` is a free-form-ish text but in practice constrained to
 * `strength | hypertrophy | cutting | beginner` at the mutator boundary.
 * `is_preset` follows the unified seed pattern (DDB-14): seed inserts
 * with `is_preset = true`, read-only in UI (DDB-16).
 *
 * `created_at` is preserved here (and in the legacy `Routine` type) — it
 * drives sort order in the routines list. Most other tables only carry
 * `updated_at`.
 */
export const routines = sqliteTable("routines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  goal: text("goal").$type<
    "strength" | "hypertrophy" | "cutting" | "beginner"
  >(),
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;
