import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { exercises } from "./exercises";
import { workoutSessions } from "./workout_sessions";

/**
 * `completed_sets` — one row per logged set inside a workout session.
 *
 * Separated from `workout_sessions` (DDB-13) so volume / max queries can
 * use direct `MAX/GROUP BY` without parsing JSON.
 *
 * Cascade delete from `workout_sessions` (deleting a session deletes its
 * sets). Hard FK to `exercises` — never orphan a logged set, mutator
 * blocks exercise delete when references exist.
 *
 * Indexes:
 *   - `sets_by_ex_weight (exercise_id, weight)` for max-weight queries
 *     and PR detection (`useMaxWeightForExercise`).
 *   - `sets_by_session (session_id)` for active-workout reads.
 *
 * `is_warmup` is a hard boolean (NOT NULL) — historical analytics need
 * to filter warmup sets out of volume computations.
 */
export const completedSets = sqliteTable(
  "completed_sets",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    weight: real("weight").notNull(),
    reps: integer("reps").notNull(),
    rpe: real("rpe"),
    isWarmup: integer("is_warmup", { mode: "boolean" }).notNull(),
    setIndex: integer("set_index").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("sets_by_ex_weight").on(t.exerciseId, t.weight),
    index("sets_by_session").on(t.sessionId),
  ],
);

export type CompletedSet = typeof completedSets.$inferSelect;
export type NewCompletedSet = typeof completedSets.$inferInsert;
