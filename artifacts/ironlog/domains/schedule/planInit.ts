import { getLastSetsForExercise } from "@/domains/workout/helpers";
import type {
  CompletedSet,
  PlannedExercise,
  PlannedSet,
  RoutineDay,
  RoutineExercise,
  SessionPlan,
  WorkoutSession,
} from "@/types";

/**
 * The plan screen seeds its local state once. Both live inputs (routine tree
 * and the persisted plan for the date) are `undefined` while loading.
 */
export function isPlanDataLoaded(
  routine: unknown,
  existing: unknown,
): boolean {
  return routine !== undefined && existing !== undefined;
}

export function initialPlanExercises(
  day: RoutineDay | undefined,
  existing: SessionPlan | null,
  sessions: readonly WorkoutSession[],
): PlannedExercise[] {
  if (existing) return existing.exercises;
  if (!day) return [];
  return day.exercises.map((re) => ({
    exerciseId: re.exerciseId,
    sets: buildInitialSets(re, getLastSetsForExercise(sessions, re.exerciseId)),
  }));
}

/**
 * Auto-save only user edits: the state is saved when it is no longer the
 * array the screen was initialized with, so a "look and leave" (or a live
 * re-emission of the routine) never persists a plan.
 */
export function shouldAutoSavePlan(
  exercises: PlannedExercise[] | null,
  baseline: PlannedExercise[] | null,
): boolean {
  return exercises !== null && exercises !== baseline;
}

export function buildInitialSets(
  re: RoutineExercise,
  lastSets: CompletedSet[],
): PlannedSet[] {
  const sets: PlannedSet[] = [];
  for (let i = 0; i < re.warmupSets; i++) {
    sets.push({ isWarmup: true });
  }
  // Seed work sets from last session if available, falling back to routine
  // targets. This makes the first edit feel like "preset for me" rather than
  // a blank slate.
  for (let i = 0; i < re.targetSets; i++) {
    const ref = lastSets[i] ?? lastSets[lastSets.length - 1];
    sets.push({
      isWarmup: false,
      weight: ref?.weight,
      reps: ref?.reps ?? re.targetReps,
      rpe: ref?.rpe,
    });
  }
  return sets;
}
