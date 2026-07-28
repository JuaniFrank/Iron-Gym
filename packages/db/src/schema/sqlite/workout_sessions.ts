import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { routineDays } from "./routine_days";
import { routines } from "./routines";

/**
 * `workout_sessions` — one row per training session (active or finished).
 *
 * `routineId` / `routineDayId` are NULLABLE (empty workouts via
 * `startEmptyWorkout`). `routineName` / `dayName` are SNAPSHOT fields
 * (DDB-12 convention applied to sessions, cf. §8) so renaming or deleting
 * a routine does not corrupt a finished session's display.
 *
 * `prsAchieved` is REMOVED (DDB-12). PRs live in `pr_records` with a
 * cascade FK to `workout_sessions`. The summary screen does
 * `SELECT * FROM pr_records WHERE session_id = ?`.
 *
 * `exerciseOrder` (`string[]`) and `skippedExerciseIds` (`string[]`) are
 * JSON columns — they are session-local UI ordering / skipping state, not
 * relational data. `mode: "json"` only serializes; mutator validates.
 *
 * `endedAt` NULL marks the active session (queryable via
 * `useActiveSession`).
 */
export const workoutSessions = sqliteTable("workout_sessions", {
  id: text("id").primaryKey(),
  routineId: text("routine_id").references(() => routines.id),
  routineDayId: text("routine_day_id").references(() => routineDays.id),
  /** Snapshot of `routines.name` at session start (survives renames). */
  routineName: text("routine_name").notNull(),
  /** Snapshot of `routine_days.name` at session start. */
  dayName: text("day_name").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  exerciseOrder: text("exercise_order", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  skippedExerciseIds: text("skipped_exercise_ids", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  totalVolumeKg: integer("total_volume_kg").notNull().default(0),
  notes: text("notes"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type NewWorkoutSession = typeof workoutSessions.$inferInsert;
