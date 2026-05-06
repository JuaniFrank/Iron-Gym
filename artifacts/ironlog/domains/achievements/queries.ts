import { isNotNull, isNull } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  achievementsUnlocked,
  bodyWeights,
  completedSets,
  prRecords,
  workoutSessions,
} from "@workspace/db/schema";
import { useMemo } from "react";

import type { DB } from "@workspace/db";

import { db } from "@/services/db";
import type {
  AchievementUnlock,
  AppStateForAchievements,
  BodyWeightEntry,
  PRRecord,
  WorkoutSession,
} from "@/types";
import { dateKey } from "@/utils/date";

function rowToUnlock(
  row: typeof achievementsUnlocked.$inferSelect,
): AchievementUnlock {
  return {
    id: row.id,
    unlockedAt:
      row.unlockedAt instanceof Date
        ? row.unlockedAt.getTime()
        : row.unlockedAt,
  };
}

/**
 * All unlocked achievements. The legacy context exposed this slice as
 * `state.achievements` (an array of `{ id, unlockedAt }`).
 *
 * Note (DDB-20): the achievement check function lives in JS
 * (`constants/achievements.ts`); writes happen inside `finishWorkout` (Step
 * 5 mutator). This hook is the read side only.
 */
export function useAchievements(): AchievementUnlock[] {
  const { data } = useLiveQuery(db.select().from(achievementsUnlocked));
  return useMemo(() => (data ?? []).map(rowToUnlock), [data]);
}

// ---------------------------------------------------------------------------
// Achievement state snapshot — used by `finishWorkout` mutator (cf. DDB-20).
// ---------------------------------------------------------------------------

function toMs(value: Date | number | null | undefined): number | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.getTime();
  return value;
}

/**
 * Compute the user's current consecutive-day streak (training days ending
 * today). Pure helper — runs in JS over a small snapshot of finished
 * sessions.
 *
 * DDB-20 floats the option of moving this to SQL but the JS version is
 * trivial against `loadAchievementState`'s already-fetched rows; revisit
 * if profiling surfaces a hot path.
 */
export async function computeStreak(database: DB): Promise<number> {
  const rows = await database
    .select({ endedAt: workoutSessions.endedAt })
    .from(workoutSessions)
    .where(isNotNull(workoutSessions.endedAt))
    .all();
  const trainedKeys = new Set<string>();
  for (const row of rows) {
    const ts = toMs(row.endedAt);
    if (ts) trainedKeys.add(dateKey(ts));
  }
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (trainedKeys.has(dateKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Load the snapshot fed to `Achievement.check(state)` (cf. DDB-20).
 *
 * The snapshot mirrors the legacy `AppStateForAchievements` shape:
 *   - `sessions` — finished sessions hydrated with their non-deleted sets.
 *     Ach checks only inspect `sessions.length` and PRs against the array,
 *     so we project the minimal fields needed (id + endedAt + sets array).
 *   - `bodyWeights` — non-deleted body-weight entries.
 *   - `prs` — all PR records (non-deleted).
 *   - `streak` — consecutive training-day streak ending today.
 *
 * Runs as 4 parallel queries (`Promise.all`). Cold path — invoked once per
 * `finishWorkout`. The SQL hits indexed columns only.
 */
export async function loadAchievementState(
  database: DB,
): Promise<AppStateForAchievements> {
  const [sessionsRows, setsRows, weightsRows, prsRows, streak] =
    await Promise.all([
      database
        .select()
        .from(workoutSessions)
        .where(isNotNull(workoutSessions.endedAt))
        .all(),
      database
        .select()
        .from(completedSets)
        .where(isNull(completedSets.deletedAt))
        .all(),
      database
        .select()
        .from(bodyWeights)
        .where(isNull(bodyWeights.deletedAt))
        .all(),
      database
        .select()
        .from(prRecords)
        .where(isNull(prRecords.deletedAt))
        .all(),
      computeStreak(database),
    ]);

  // Filter out soft-deleted sessions in JS — the achievement checks only ever
  // touch `sessions.length`, so we can avoid a join.
  const liveSessions = sessionsRows.filter((s) => s.deletedAt == null);

  const setsBySession = new Map<string, typeof setsRows>();
  for (const set of setsRows) {
    const arr = setsBySession.get(set.sessionId) ?? [];
    arr.push(set);
    setsBySession.set(set.sessionId, arr);
  }

  const sessions: WorkoutSession[] = liveSessions.map((row) => ({
    id: row.id,
    routineId: row.routineId ?? undefined,
    routineDayId: row.routineDayId ?? undefined,
    routineName: row.routineName,
    dayName: row.dayName,
    startedAt: toMs(row.startedAt) ?? Date.now(),
    endedAt: toMs(row.endedAt),
    sets: (setsBySession.get(row.id) ?? []).map((s) => ({
      id: s.id,
      exerciseId: s.exerciseId,
      weight: s.weight,
      reps: s.reps,
      rpe: s.rpe ?? undefined,
      isWarmup: s.isWarmup,
      setIndex: s.setIndex,
      completedAt: toMs(s.completedAt) ?? Date.now(),
    })),
    exerciseOrder: row.exerciseOrder,
    skippedExerciseIds: row.skippedExerciseIds,
    totalVolumeKg: row.totalVolumeKg,
    prsAchieved: [],
    notes: row.notes ?? undefined,
  }));

  const weights: BodyWeightEntry[] = weightsRows.map((row) => ({
    id: row.id,
    date: toMs(row.date) ?? 0,
    weightKg: row.weightKg,
  }));

  const prs: PRRecord[] = prsRows.map((row) => ({
    exerciseId: row.exerciseId,
    exerciseName: row.exerciseName,
    type: row.type,
    value: row.value,
    previousValue: row.previousValue ?? undefined,
    achievedAt: toMs(row.achievedAt) ?? Date.now(),
  }));

  return {
    sessions,
    bodyWeights: weights,
    streak,
    prs,
  };
}
