import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { exercises } from "./exercises";
import { routineDays } from "./routine_days";

/**
 * `routine_exercises` — ordered exercises within a `routine_day`.
 *
 * Decomposed table (DDB-9). Cascade delete from `routine_days`. Hard FK
 * (no cascade) to `exercises` so we never orphan a row by deleting an
 * exercise — the exercise mutator must reject deletes when references
 * exist (or repoint them).
 *
 * `position INTEGER NOT NULL` + `UNIQUE(routine_day_id, position)` keeps
 * order integrity at the DB layer (DDB-10).
 *
 * `superset_with` is a self-FK (NOT enforced at SQL level) pointing to
 * another `routine_exercises.id` within the SAME day. Stored as plain
 * `text` because Drizzle's reference resolver chokes on self-references
 * declared inline; mutator validates the cross-day invariant + existence.
 *
 * Defaults: targetSets/targetReps/restSeconds are required (mutator
 * supplies sensible defaults in `addExerciseToDay`). `warmupSets` defaults
 * to 0 at the SQL layer for legacy rows.
 */
export const routineExercises = sqliteTable(
  "routine_exercises",
  {
    id: text("id").primaryKey(),
    routineDayId: text("routine_day_id")
      .notNull()
      .references(() => routineDays.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    position: integer("position").notNull(),
    targetSets: integer("target_sets").notNull(),
    targetReps: integer("target_reps").notNull(),
    warmupSets: integer("warmup_sets").notNull().default(0),
    /** Self-FK by id, nullable. Not declared as a Drizzle reference: the
     *  table cannot reference itself in the same `sqliteTable` call.
     *  Existence + same-day invariant are validated at the mutator. */
    supersetWith: text("superset_with"),
    restSeconds: integer("rest_seconds").notNull(),
    notes: text("notes"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    unique("routine_exercises_day_position_unique").on(
      t.routineDayId,
      t.position,
    ),
  ],
);

export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;
