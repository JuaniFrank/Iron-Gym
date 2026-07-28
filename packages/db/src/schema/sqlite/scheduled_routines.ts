import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { routineDays } from "./routine_days";
import { routines } from "./routines";

/**
 * `scheduled_routines` — weekly recurring schedule (one row per weekday).
 *
 * PK is `day_of_week` (1..7, Mon..Sun) — at most one entry per weekday.
 * Mutator `scheduleRoutine` upserts on the weekday; `unscheduleDay`
 * deletes physically (DDB-style: this is config, not user data, soft
 * delete is overkill — cf. §8 list of physical-delete cases).
 *
 * No `deletedAt`: physical delete only. `updatedAt` for sync.
 *
 * Both FKs (routine + routineDay) are NOT NULL — a scheduled day MUST
 * point to a real routine + day. Hard FK (no cascade): deleting a
 * routine with active schedule entries is blocked at the mutator
 * (caller must clear schedule first).
 */
export const scheduledRoutines = sqliteTable("scheduled_routines", {
  /** 1..7, Mon..Sun. */
  dayOfWeek: integer("day_of_week").primaryKey(),
  routineId: text("routine_id")
    .notNull()
    .references(() => routines.id),
  routineDayId: text("routine_day_id")
    .notNull()
    .references(() => routineDays.id),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type ScheduledRoutine = typeof scheduledRoutines.$inferSelect;
export type NewScheduledRoutine = typeof scheduledRoutines.$inferInsert;
