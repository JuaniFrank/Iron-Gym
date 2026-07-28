import { exercises as exercisesTable } from "@workspace/db/schema";
import { z } from "zod";

import { db } from "@/services/db";
import type { Exercise, ExerciseType, MuscleGroup } from "@/types";
import { uid } from "@/utils/id";

/**
 * Mutators for the `exercises` catalog (custom exercises only — presets are
 * read-only by DDB-16).
 */

const MUSCLES: readonly MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "forearms",
];

const TYPES: readonly ExerciseType[] = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
];

const ExerciseInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().default(""),
  primaryMuscle: z.enum(MUSCLES as [MuscleGroup, ...MuscleGroup[]]),
  secondaryMuscles: z
    .array(z.enum(MUSCLES as [MuscleGroup, ...MuscleGroup[]]))
    .default([]),
  type: z.enum(TYPES as [ExerciseType, ...ExerciseType[]]),
});

/**
 * Create a custom exercise (`is_preset = false`). Returns the legacy
 * `Exercise` shape so callers can hand the row to existing UI helpers
 * without a refetch.
 */
export async function createCustomExercise(
  input: Omit<Exercise, "id" | "isCustom">,
): Promise<Exercise> {
  const validated = ExerciseInputSchema.parse(input);
  const id = uid();
  const now = new Date();
  await db.insert(exercisesTable).values({
    id,
    name: validated.name,
    description: validated.description,
    primaryMuscle: validated.primaryMuscle,
    secondaryMuscles: validated.secondaryMuscles,
    type: validated.type,
    isPreset: false,
    updatedAt: now,
  });
  return {
    id,
    name: validated.name,
    description: validated.description,
    primaryMuscle: validated.primaryMuscle,
    secondaryMuscles: validated.secondaryMuscles,
    type: validated.type,
    isCustom: true,
  };
}
