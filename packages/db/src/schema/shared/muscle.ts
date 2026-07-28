// Muscle group + exercise type unions used by the SQLite `exercises` table
// (and by Postgres later via DDB-3 dialect-paralleled schemas).
//
// These are NOT enforced at the SQL layer — Drizzle stores them as `text`
// and validation happens at the mutator boundary (Zod). They live in
// `schema/shared/` because the same union shows up in:
//   - `exercises.primary_muscle` and `exercises.secondary_muscles[]`
//   - `user_profile.volume_targets` (keyed by MuscleGroup)
//   - eventually the Postgres mirror schema.
//
// DDB-6 will migrate the domain types to derive from `$inferSelect`. Until
// Step 5 lands, these unions remain the source for `$type<T>()` in JSON
// columns.

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quadriceps"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "abs"
  | "forearms";

export type ExerciseType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight";
