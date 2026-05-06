import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { exercises } from "./exercises";
import { workoutSessions } from "./workout_sessions";

/**
 * `pr_records` — one row per PR achieved in a session (DDB-12).
 *
 * Replaces the legacy `WorkoutSession.prsAchieved` blob. Benefits:
 *   - immutable audit trail with FK + cascade on session delete;
 *   - indexed by `(exercise_id, type, value)` for top-PR lookups;
 *   - UNIQUE(session_id, exercise_id, type) makes `finishWorkout`
 *     idempotent (re-running on the same session won't double-insert).
 *
 * Snapshot fields:
 *   - `exercise_name` survives `exercises` renames + soft deletes.
 *   - `previous_value` records the prior PR for trend rendering even if
 *     the older session is later deleted.
 *
 * `type` is a closed `'weight' | 'volume' | 'reps'` union enforced by the
 * mutator (DB stores plain text).
 */
export const prRecords = sqliteTable(
  "pr_records",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    /** Snapshot — survives rename/delete of the source `exercises` row. */
    exerciseName: text("exercise_name").notNull(),
    /** `'weight' | 'volume' | 'reps'` (validated at mutator). */
    type: text("type").$type<"weight" | "volume" | "reps">().notNull(),
    value: real("value").notNull(),
    /** Snapshot of the previous record's value at PR time. */
    previousValue: real("previous_value"),
    achievedAt: integer("achieved_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("pr_by_exercise").on(t.exerciseId, t.type, t.value),
    index("pr_by_session").on(t.sessionId),
    unique("pr_session_exercise_type_unique").on(
      t.sessionId,
      t.exerciseId,
      t.type,
    ),
  ],
);

export type PRRecord = typeof prRecords.$inferSelect;
export type NewPRRecord = typeof prRecords.$inferInsert;
