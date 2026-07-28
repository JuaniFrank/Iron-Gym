import { asc, isNull } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { fitnessGoals } from "@workspace/db/schema";
import { useMemo } from "react";

import { db } from "@/services/db";
import type { FitnessGoal } from "@/types";

function rowToGoal(row: typeof fitnessGoals.$inferSelect): FitnessGoal {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    targetDate:
      row.targetDate instanceof Date ? row.targetDate.getTime() : row.targetDate,
    exerciseId: row.exerciseId ?? undefined,
    targetWeight: row.targetWeight ?? undefined,
    completed: row.completed,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
  };
}

/**
 * All non-deleted goals, sorted by `createdAt ASC` (insertion order — the
 * legacy context never sorted them, callers do at consumption time).
 */
export function useGoals(): FitnessGoal[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(fitnessGoals)
      .where(isNull(fitnessGoals.deletedAt))
      .orderBy(asc(fitnessGoals.createdAt)),
  );
  return useMemo(() => (data ?? []).map(rowToGoal), [data]);
}
