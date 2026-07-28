import type { CompletedSet, WorkoutSession } from "@/types";

/**
 * Given the in-memory list of sessions (already hydrated with `sets[]`),
 * find the last finished session that contains a non-warmup set for
 * `exerciseId` and return those sets. Mirrors the legacy
 * `getLastSetsForExercise` from `IronLogContext`.
 *
 * Pure — used by screens that subscribed to `useSessions()` and need to
 * resolve "last sets" for many exercises in a single render (e.g. plan
 * screen, active workout screen). Calling `useLastSetsForExercise` once
 * per exercise would create N subscriptions; this single helper reuses
 * the already-fetched list.
 */
export function getLastSetsForExercise(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
  beforeSessionId?: string,
): CompletedSet[] {
  const candidates = sessions
    .filter(
      (s) =>
        s.endedAt &&
        s.id !== beforeSessionId &&
        s.sets.some((set) => set.exerciseId === exerciseId && !set.isWarmup),
    )
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  const last = candidates[0];
  if (!last) return [];
  return last.sets.filter((s) => s.exerciseId === exerciseId && !s.isWarmup);
}

/**
 * Maximum non-warmup weight for `exerciseId` across all hydrated sessions,
 * with optional exclusion of one session id (used by `finishWorkout` to
 * compare against pre-session history).
 */
export function getMaxWeightForExercise(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
  excludeSessionId?: string,
): number {
  let max = 0;
  for (const session of sessions) {
    if (excludeSessionId && session.id === excludeSessionId) continue;
    for (const set of session.sets) {
      if (set.exerciseId === exerciseId && !set.isWarmup && set.weight > max) {
        max = set.weight;
      }
    }
  }
  return max;
}
