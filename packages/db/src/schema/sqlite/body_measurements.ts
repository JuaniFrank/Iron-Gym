import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `body_measurements` — periodic anthropometric snapshots (waist, chest,
 * arms, thighs, neck, shoulders).
 *
 * All fields except `id`/`date`/`updatedAt` are nullable: a measurement
 * row only carries the metrics the user actually recorded that day.
 */
export const bodyMeasurements = sqliteTable("body_measurements", {
  id: text("id").primaryKey(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  waist: real("waist"),
  chest: real("chest"),
  hips: real("hips"),
  leftArm: real("left_arm"),
  rightArm: real("right_arm"),
  leftThigh: real("left_thigh"),
  rightThigh: real("right_thigh"),
  neck: real("neck"),
  shoulders: real("shoulders"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type NewBodyMeasurement = typeof bodyMeasurements.$inferInsert;
