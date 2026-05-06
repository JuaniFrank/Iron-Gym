import { and, asc, eq, isNull } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  routines as routinesTable,
  routineDays as routineDaysTable,
  routineExercises as routineExercisesTable,
} from "@workspace/db/schema";
import { useMemo } from "react";

import { db } from "@/services/db";
import type { Routine, RoutineDay, RoutineExercise } from "@/types";

/**
 * Routines, days and exercises are normalized in 3 tables (DDB-9). The
 * legacy `Routine` type embeds `days[].exercises[]` so the UI consumes a
 * single tree.
 *
 * `useLiveQuery` only re-runs the query it's bound to — it does NOT
 * re-fetch related tables under the hood. For the legacy shape we need
 * three subscriptions and a memoized join. That's a tax we pay once: the
 * tree shape stays cheap and the UI doesn't change.
 *
 * Trade-off vs. relational query (`db.query.routines.findMany({ with: ... })`):
 * the relational API works under `useLiveQuery`, but its dep tracking is
 * coarse (the entire result invalidates on ANY child write). With three
 * separate subscriptions Drizzle invalidates only the affected slice and
 * React reconciliation drops the rebuild cost.
 */

function buildRoutineTree(
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
 * All non-deleted routines (presets + custom) with their days + exercises
 * hydrated. Replaces `useIronLog().allRoutines`.
 */
export function useAllRoutines(): Routine[] {
  const routinesQuery = useLiveQuery(
    db
      .select()
      .from(routinesTable)
      .where(isNull(routinesTable.deletedAt))
      .orderBy(asc(routinesTable.createdAt)),
  );
  const daysQuery = useLiveQuery(
    db
      .select()
      .from(routineDaysTable)
      .where(isNull(routineDaysTable.deletedAt))
      .orderBy(asc(routineDaysTable.position)),
  );
  const exercisesQuery = useLiveQuery(
    db
      .select()
      .from(routineExercisesTable)
      .where(isNull(routineExercisesTable.deletedAt))
      .orderBy(asc(routineExercisesTable.position)),
  );

  return useMemo(
    () =>
      buildRoutineTree(
        routinesQuery.data ?? [],
        daysQuery.data ?? [],
        exercisesQuery.data ?? [],
      ),
    [routinesQuery.data, daysQuery.data, exercisesQuery.data],
  );
}

/**
 * Custom routines only — same as `useAllRoutines()` filtered to
 * `is_preset = false`. Used by `app/(tabs)/workout.tsx` ("Mías" tab).
 */
export function useCustomRoutines(): Routine[] {
  const routinesQuery = useLiveQuery(
    db
      .select()
      .from(routinesTable)
      .where(
        and(
          eq(routinesTable.isPreset, false),
          isNull(routinesTable.deletedAt),
        ),
      )
      .orderBy(asc(routinesTable.createdAt)),
  );
  const daysQuery = useLiveQuery(
    db
      .select()
      .from(routineDaysTable)
      .where(isNull(routineDaysTable.deletedAt))
      .orderBy(asc(routineDaysTable.position)),
  );
  const exercisesQuery = useLiveQuery(
    db
      .select()
      .from(routineExercisesTable)
      .where(isNull(routineExercisesTable.deletedAt))
      .orderBy(asc(routineExercisesTable.position)),
  );

  return useMemo(
    () =>
      buildRoutineTree(
        routinesQuery.data ?? [],
        daysQuery.data ?? [],
        exercisesQuery.data ?? [],
      ),
    [routinesQuery.data, daysQuery.data, exercisesQuery.data],
  );
}

/**
 * One routine by id with days + exercises. Returns null when missing or
 * soft-deleted. Each subscription is keyed off the id; React triggers a
 * re-render on any of the three table changes.
 */
export function useRoutineById(id: string | null | undefined): Routine | null {
  const routineQuery = useMemo(
    () =>
      db
        .select()
        .from(routinesTable)
        .where(
          and(
            eq(routinesTable.id, id ?? ""),
            isNull(routinesTable.deletedAt),
          ),
        )
        .limit(1),
    [id],
  );
  const daysQ = useMemo(
    () =>
      db
        .select()
        .from(routineDaysTable)
        .where(
          and(
            eq(routineDaysTable.routineId, id ?? ""),
            isNull(routineDaysTable.deletedAt),
          ),
        )
        .orderBy(asc(routineDaysTable.position)),
    [id],
  );
  const exsQ = useMemo(
    () =>
      db
        .select({
          id: routineExercisesTable.id,
          routineDayId: routineExercisesTable.routineDayId,
          exerciseId: routineExercisesTable.exerciseId,
          position: routineExercisesTable.position,
          targetSets: routineExercisesTable.targetSets,
          targetReps: routineExercisesTable.targetReps,
          warmupSets: routineExercisesTable.warmupSets,
          supersetWith: routineExercisesTable.supersetWith,
          restSeconds: routineExercisesTable.restSeconds,
          notes: routineExercisesTable.notes,
          updatedAt: routineExercisesTable.updatedAt,
          deletedAt: routineExercisesTable.deletedAt,
        })
        .from(routineExercisesTable)
        .innerJoin(
          routineDaysTable,
          eq(routineExercisesTable.routineDayId, routineDaysTable.id),
        )
        .where(
          and(
            eq(routineDaysTable.routineId, id ?? ""),
            isNull(routineExercisesTable.deletedAt),
            isNull(routineDaysTable.deletedAt),
          ),
        )
        .orderBy(asc(routineExercisesTable.position)),
    [id],
  );

  const routineRes = useLiveQuery(routineQuery, [id]);
  const daysRes = useLiveQuery(daysQ, [id]);
  const exsRes = useLiveQuery(exsQ, [id]);

  return useMemo(() => {
    if (!id) return null;
    const routine = routineRes.data?.[0];
    if (!routine) return null;
    const tree = buildRoutineTree(
      [routine],
      daysRes.data ?? [],
      exsRes.data ?? [],
    );
    return tree[0] ?? null;
  }, [id, routineRes.data, daysRes.data, exsRes.data]);
}
