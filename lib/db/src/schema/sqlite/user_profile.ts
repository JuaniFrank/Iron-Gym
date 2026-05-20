import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { MuscleGroup } from "../shared/muscle";
import type { VolumeTarget } from "../shared/volume";

/**
 * `user_profile` — singleton row holding the local user's profile.
 *
 * Convention: a single row with `id = 'singleton'`. Column default is set
 * at the SQL layer so an empty insert stamps the literal — `updateProfile`
 * upserts on this constant id. Modeling profile as a singleton row instead
 * of one column-per-key in `_meta` lets us index typed columns and keeps
 * the JSON `volume_targets` blob isolated.
 *
 * `volume_targets` is a JSON column keyed by `MuscleGroup`. `mode: "json"`
 * only serializes; mutator (`updateProfile`) validates the payload via
 * Zod before writing.
 *
 * `featureDiscoveries` from the legacy `UserProfile` lives in its own
 * `feature_discoveries` table, NOT here.
 *
 * No `deletedAt` — singletons are not soft-deletable.
 */
export const userProfile = sqliteTable("user_profile", {
  /** Always `'singleton'`. Default keeps single-row invariant on insert. */
  id: text("id").primaryKey().default("singleton"),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  weightKg: real("weight_kg").notNull(),
  heightCm: real("height_cm").notNull(),
  sex: text("sex").$type<"male" | "female">().notNull(),
  activityLevel: text("activity_level")
    .$type<"sedentary" | "light" | "moderate" | "active" | "veryActive">()
    .notNull(),
  goal: text("goal").$type<"lose" | "maintain" | "gain" | "muscle">().notNull(),
  units: text("units").$type<"metric" | "imperial">().notNull(),
  theme: text("theme").$type<"system" | "light" | "dark">().notNull(),
  caloriesGoal: integer("calories_goal"),
  proteinGoalG: integer("protein_goal_g"),
  carbsGoalG: integer("carbs_goal_g"),
  fatGoalG: integer("fat_goal_g"),
  volumeTargets: text("volume_targets", { mode: "json" }).$type<
    Partial<Record<MuscleGroup, VolumeTarget>>
  >(),
  // Rest notification config — push notification al terminar el descanso
  // entre series. Aditivos (default values cubren usuarios pre-existentes).
  restNotificationEnabled: integer("rest_notification_enabled", {
    mode: "boolean",
  })
    .default(true)
    .notNull(),
  /** "sound_only" → solo sonido + haptic; "rich" → banner + sonido + haptic. */
  restNotificationType: text("rest_notification_type")
    .$type<"sound_only" | "rich">()
    .default("rich")
    .notNull(),
  /** "default" → sonido del sistema; "silent" → sin sonido (solo haptic +
   *  pulse visual). Más opciones de sound pack en próxima iteración (cf.
   *  push-notifications-system.md PN-Q1). */
  restNotificationSound: text("rest_notification_sound")
    .$type<"default" | "silent">()
    .default("default")
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type UserProfile = typeof userProfile.$inferSelect;
export type NewUserProfile = typeof userProfile.$inferInsert;
