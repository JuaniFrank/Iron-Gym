import { and, asc, eq, isNull } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { exercises as exercisesTable } from "@workspace/db/schema";
import { useMemo } from "react";

import { db } from "@/services/db";
import type { Exercise } from "@/types";

/**
 * Map a SQLite `exercises` row into the legacy `Exercise` shape consumed by
 * the UI. The DB column is `is_preset` (boolean); the legacy type uses
 * `isCustom?: boolean` (the inverse). We translate at this boundary so
 * pantallas que filtran `r => r.isPreset` siguen funcionando — see how
 * `app/(tabs)/workout.tsx` reads `r.isPreset`.
 */
function rowToExercise(row: typeof exercisesTable.$inferSelect): Exercise {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    primaryMuscle: row.primaryMuscle,
    secondaryMuscles: row.secondaryMuscles,
    type: row.type,
    isCustom: !row.isPreset,
  };
}

/**
 * All non-deleted exercises (presets + custom), sorted by name. Replaces
 * `useIronLog().allExercises` (which spread `EXERCISES` + custom). Now both
 * live in the DB so a single query covers it.
 */
export function useAllExercises(): Exercise[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(exercisesTable)
      .where(isNull(exercisesTable.deletedAt))
      .orderBy(asc(exercisesTable.name)),
  );
  return useMemo(() => (data ?? []).map(rowToExercise), [data]);
}

/**
 * One exercise by id. Returns null when missing or soft-deleted.
 *
 * `useLiveQuery` re-subscribes whenever the query reference changes, so the
 * builder MUST be stable across renders for a given `id`. We memoize the
 * select against `id`.
 */
export function useExerciseById(id: string | null | undefined): Exercise | null {
  const query = useMemo(
    () =>
      db
        .select()
        .from(exercisesTable)
        .where(
          and(
            eq(exercisesTable.id, id ?? ""),
            isNull(exercisesTable.deletedAt),
          ),
        )
        .limit(1),
    [id],
  );
  const { data } = useLiveQuery(query, [id]);
  if (!id) return null;
  const row = data?.[0];
  return row ? rowToExercise(row) : null;
}

/**
 * Custom (user-created) exercises only. Helps screens that distinguish
 * presets vs. custom (e.g. an "edit" button only on custom).
 */
export function useCustomExercises(): Exercise[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(exercisesTable)
      .where(
        and(
          eq(exercisesTable.isPreset, false),
          isNull(exercisesTable.deletedAt),
        ),
      )
      .orderBy(asc(exercisesTable.name)),
  );
  return useMemo(() => (data ?? []).map(rowToExercise), [data]);
}
