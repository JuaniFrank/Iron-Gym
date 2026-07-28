import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `achievements_unlocked` — one row per unlocked achievement.
 *
 * The PK is the achievement's id (string, defined in
 * `constants/achievements.ts`). Insert is idempotent at the mutator
 * (`finishWorkout` filters out already-unlocked ids before insert) and
 * at the SQL layer (PK collision raises).
 *
 * No `deletedAt` — unlocking is monotonic; `resetAll` clears the table
 * physically.
 */
export const achievementsUnlocked = sqliteTable("achievements_unlocked", {
  /** Matches `Achievement.id` in `constants/achievements.ts`. */
  id: text("id").primaryKey(),
  unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" }).notNull(),
});

export type AchievementUnlocked = typeof achievementsUnlocked.$inferSelect;
export type NewAchievementUnlocked = typeof achievementsUnlocked.$inferInsert;
