import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { ExerciseType, MuscleGroup } from "../shared/muscle";

/**
 * `exercises` — catalog of preset + user-defined exercises.
 *
 * `is_preset = true` rows ship from `constants/seed.ts` (DDB-14 + DDB-15).
 * Sync filters them out (`is_preset = 0`) so presets stay client-local.
 * Read-only in UI (DDB-16) — to edit a preset, the user duplicates it as a
 * custom exercise.
 *
 * `secondary_muscles` is a JSON-serialized `MuscleGroup[]`. `mode: "json"`
 * only (de)serializes; validation is the mutator's job (Zod boundary).
 *
 * `type` is a closed `ExerciseType` union stored as text — DB doesn't
 * enforce the constraint; mutator does.
 *
 * `byName` index supports `useExercisesByMuscle` filtering and exercise
 * picker autocomplete. Soft delete via `deletedAt` (DDB-5) so historical
 * `completed_sets`/`pr_records` keep their FK target.
 */
export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    primaryMuscle: text("primary_muscle").$type<MuscleGroup>().notNull(),
    secondaryMuscles: text("secondary_muscles", { mode: "json" })
      .$type<MuscleGroup[]>()
      .notNull()
      .default([]),
    type: text("type").$type<ExerciseType>().notNull(),
    isPreset: integer("is_preset", { mode: "boolean" })
      .notNull()
      .default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("exercises_by_name").on(t.name),
  ],
);

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
