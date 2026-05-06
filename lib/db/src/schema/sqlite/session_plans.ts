import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { PlannedExercise } from "../shared/planning";
import { routineDays } from "./routine_days";
import { routines } from "./routines";

/**
 * `session_plans` — pre-defined plan for a specific calendar date
 * (DDB-11).
 *
 * PK is `date_key` (YYYY-MM-DD) — one plan per date. The exercise list
 * lives in a single JSON column (`exercises: PlannedExercise[]`) instead
 * of a normalized table because:
 *   - mutators are blob-level (overwrite total, never partial);
 *   - data volume is minimal (a handful of exercises × dates);
 *   - analytics over plans run client-side, no aggregation needed.
 *
 * Validation MUST happen in the mutator via Zod (`mode: "json"` only
 * serializes — DDB-11 detalle).
 *
 * `deleteSessionPlan` deletes physically (config-shaped, cf. §8). Only
 * `updatedAt` is tracked (no `deletedAt`).
 */
export const sessionPlans = sqliteTable("session_plans", {
  /** YYYY-MM-DD. */
  dateKey: text("date_key").primaryKey(),
  routineId: text("routine_id")
    .notNull()
    .references(() => routines.id),
  routineDayId: text("routine_day_id")
    .notNull()
    .references(() => routineDays.id),
  exercises: text("exercises", { mode: "json" })
    .$type<PlannedExercise[]>()
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type SessionPlan = typeof sessionPlans.$inferSelect;
export type NewSessionPlan = typeof sessionPlans.$inferInsert;
