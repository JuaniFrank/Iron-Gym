import type {
  routines as routinesTable,
  routineDays as routineDaysTable,
  routineExercises as routineExercisesTable,
} from "@workspace/db/schema";

import type { Routine, RoutineDay, RoutineExercise } from "@/types";

export function buildRoutineTree(
  routines: readonly (typeof routinesTable.$inferSelect)[],
  days: readonly (typeof routineDaysTable.$inferSelect)[],
  exs: readonly (typeof routineExercisesTable.$inferSelect)[],
): Routine[] {
  const exsByDay = new Map<string, RoutineExercise[]>();
  for (const ex of exs) {
    const arr = exsByDay.get(ex.routineDayId) ?? [];
    arr.push({
      id: ex.id,
      exerciseId: ex.exerciseId,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      warmupSets: ex.warmupSets,
      supersetWith: ex.supersetWith ?? undefined,
      restSeconds: ex.restSeconds,
      notes: ex.notes ?? undefined,
    });
    exsByDay.set(ex.routineDayId, arr);
  }
  // Each list is already sorted by `position` thanks to the ORDER BY in the
  // exercises query — preserve the array order received here.

  const daysByRoutine = new Map<string, RoutineDay[]>();
  for (const day of days) {
    const arr = daysByRoutine.get(day.routineId) ?? [];
    arr.push({
      id: day.id,
      name: day.name,
      exercises: exsByDay.get(day.id) ?? [],
    });
    daysByRoutine.set(day.routineId, arr);
  }

  return routines.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    days: daysByRoutine.get(r.id) ?? [],
    isPreset: r.isPreset,
    goal: r.goal ?? undefined,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt,
  }));
}

/**
 * Builds the tree only when all three live queries have delivered at least
 * one result. While any is still `undefined` the join would be partial
 * (routine present, days/exercises empty) and screens that seed local state
 * from it would freeze that partial view. `undefined` means "still loading";
 * an empty array means "loaded, nothing there".
 */
export function combineRoutineTree(
  routines: readonly (typeof routinesTable.$inferSelect)[] | undefined,
  days: readonly (typeof routineDaysTable.$inferSelect)[] | undefined,
  exs: readonly (typeof routineExercisesTable.$inferSelect)[] | undefined,
): Routine[] | undefined {
  if (!routines || !days || !exs) return undefined;
  return buildRoutineTree(routines, days, exs);
}
