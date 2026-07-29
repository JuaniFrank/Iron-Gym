import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { exercises } from "./exercises";

/**
 * `fitness_goals` — user-defined goals (e.g. "bench 100kg by July").
 *
 * `exerciseId` is OPTIONAL — goals can be untethered ("lose 5kg"). FK is
 * hard (no cascade) so deleting an exercise with attached goals is
 * blocked at the mutator.
 *
 * `created_at` is preserved (the goals list sorts by it). `completed`
 * defaults to `false`; `toggleGoal` flips it.
 */
export const fitnessGoals = sqliteTable("fitness_goals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  targetDate: integer("target_date", { mode: "timestamp_ms" }).notNull(),
  exerciseId: text("exercise_id").references(() => exercises.id),
  targetWeight: real("target_weight"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export type FitnessGoal = typeof fitnessGoals.$inferSelect;
export type NewFitnessGoal = typeof fitnessGoals.$inferInsert;
