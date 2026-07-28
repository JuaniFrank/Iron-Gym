import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { routineDays } from "./routine_days";
import { routines } from "./routines";

/**
 * `schedule_overrides` — per-date override of the weekly schedule.
 *
 * PK is `date_key` (YYYY-MM-DD string), so each calendar date can have
 * at most one override. Both FKs are NULLABLE: `routine_id IS NULL`
 * means "explicit rest override" (user converted a planned training
 * day into rest for one date).
 *
 * `clearOverrideForDate` deletes physically — overrides are
 * date-scoped configuration, not user data. Soft delete carries
 * `deletedAt` here anyway because `swapDates` may need to introspect
 * recent changes; physical delete remains the default at mutator level.
 */
export const scheduleOverrides = sqliteTable("schedule_overrides", {
  /** YYYY-MM-DD. */
  dateKey: text("date_key").primaryKey(),
  routineId: text("routine_id").references(() => routines.id),
  routineDayId: text("routine_day_id").references(() => routineDays.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export type ScheduleOverride = typeof scheduleOverrides.$inferSelect;
export type NewScheduleOverride = typeof scheduleOverrides.$inferInsert;
