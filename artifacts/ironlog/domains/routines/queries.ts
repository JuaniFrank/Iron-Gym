import { and, asc, eq, isNull } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  routines as routinesTable,
  routineDays as routineDaysTable,
  routineExercises as routineExercisesTable,
} from "@workspace/db/schema";
import { useMemo } from "react";

import { db } from "@/services/db";
import type { Routine } from "@/types";

import { combineRoutineTree } from "./tree";

/**
 * Data of a live query once it has resolved at least once, `undefined`
 * before. `useLiveQuery` starts with `data = []` and sets `updatedAt` on the
 * first result, so `data` alone cannot tell "loading" from "empty".
 */
type Live<T> = { data: T[] | undefined; updatedAt?: Date };

function loadedData<T>(q: Live<T>) {
  return q.updatedAt ? q.data : undefined;
}

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

export interface RoutinesState {
  routines: Routine[];
  loaded: boolean;
}

const NO_ROUTINES: Routine[] = [];

function useRoutinesState(
  routinesQuery: Live<typeof routinesTable.$inferSelect>,
  daysQuery: Live<typeof routineDaysTable.$inferSelect>,
  exercisesQuery: Live<typeof routineExercisesTable.$inferSelect>,
): RoutinesState {
  const routinesData = loadedData(routinesQuery);
  const daysData = loadedData(daysQuery);
  const exercisesData = loadedData(exercisesQuery);
  return useMemo(() => {
    const tree = combineRoutineTree(routinesData, daysData, exercisesData);
    return tree
      ? { routines: tree, loaded: true }
      : { routines: NO_ROUTINES, loaded: false };
  }, [routinesData, daysData, exercisesData]);
}

/**
 * All non-deleted routines (presets + custom) with their days + exercises
 * hydrated. Replaces `useIronLog().allRoutines`. `loaded` is false until all
 * three subscriptions resolved — never a partial tree; screens that seed
 * state from the list must wait for it.
 */
export function useAllRoutinesState(): RoutinesState {
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

  return useRoutinesState(routinesQuery, daysQuery, exercisesQuery);
}

/** `useAllRoutinesState()` without the loaded flag (`[]` while loading). */
export function useAllRoutines(): Routine[] {
  return useAllRoutinesState().routines;
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

  return useRoutinesState(routinesQuery, daysQuery, exercisesQuery).routines;
}

/**
 * One routine by id with days + exercises. Returns `undefined` while any of
 * the three subscriptions is still loading (never a partial tree), `null`
 * when missing or soft-deleted. Each subscription is keyed off the id; React
 * triggers a re-render on any of the three table changes.
 */
export function useRoutineById(
  id: string | null | undefined,
): Routine | null | undefined {
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

  const routineData = loadedData(routineRes);
  const daysData = loadedData(daysRes);
  const exsData = loadedData(exsRes);

  return useMemo(() => {
    if (!id) return null;
    const tree = combineRoutineTree(routineData, daysData, exsData);
    if (!tree) return undefined;
    return tree[0] ?? null;
  }, [id, routineData, daysData, exsData]);
}
