// Types for the `session_plans.exercises` JSON column (cf. DDB-11).
//
// `mode: "json"` only serializes; validation must happen in the mutator
// (Zod). These TS types feed `$type<PlannedExercise[]>()` so callers see a
// concrete shape when reading the column.

/**
 * Pre-defined values for one set, before the user actually performs it.
 * Any field can be omitted: e.g. plan only reps, leave weight to feel out.
 */
export interface PlannedSet {
  weight?: number;
  reps?: number;
  rpe?: number;
  isWarmup: boolean;
}

export interface PlannedExercise {
  exerciseId: string;
  sets: PlannedSet[];
  notes?: string;
}
