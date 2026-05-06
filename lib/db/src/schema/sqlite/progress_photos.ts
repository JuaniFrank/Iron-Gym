import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `progress_photos` — body-progress photos with optional weight + notes.
 *
 * `uri` points to a stable path under `documentDirectory + progress_photos/`
 * (DDB-17). The DB row is the source of truth (DDB-21); cleanup of the
 * underlying file is best-effort on delete (`deletePhotoFile` swallows
 * errors so an FS hiccup never blocks the soft delete).
 */
export const progressPhotos = sqliteTable("progress_photos", {
  id: text("id").primaryKey(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  /** Absolute path under `documentDirectory + progress_photos/{id}.{ext}`. */
  uri: text("uri").notNull(),
  weightKg: real("weight_kg"),
  notes: text("notes"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type NewProgressPhoto = typeof progressPhotos.$inferInsert;
