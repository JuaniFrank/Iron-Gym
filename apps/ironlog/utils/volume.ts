import type { Exercise, MuscleGroup, WorkoutSession } from "@/types";

/**
 * Counts effective sets per muscle group for a session range.
 *
 * - Warmup sets are excluded.
 * - Sets belonging to a `skippedExerciseIds` exercise are excluded.
 * - Each set contributes `1.0` to the *primary* muscle and `0.5` to each
 *   *secondary* muscle (a common, conservative weighting).
 * - Only sessions with at least one effective set count.
 *
 * Output is a `Record<MuscleGroup, number>` in *fractional sets/week*.
 * The UI rounds for display.
 */
export function volumeByMuscle(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  rangeStartMs: number,
  rangeEndMs: number,
): Record<MuscleGroup, number> {
  const totals: Record<MuscleGroup, number> = {
    chest: 0,
    back: 0,
    shoulders: 0,
    biceps: 0,
    triceps: 0,
    quadriceps: 0,
    hamstrings: 0,
    glutes: 0,
    calves: 0,
    abs: 0,
    forearms: 0,
  };

  const exerciseById = new Map(exercises.map((e) => [e.id, e]));

  for (const session of sessions) {
    // Use endedAt if present (finished), otherwise startedAt — covers in-flight
    // sessions that started inside the range.
    const sessionTs = session.endedAt ?? session.startedAt;
    if (sessionTs < rangeStartMs || sessionTs >= rangeEndMs) continue;

    const skipped = new Set(session.skippedExerciseIds ?? []);

    for (const set of session.sets) {
      if (set.isWarmup) continue;
      if (skipped.has(set.exerciseId)) continue;

      const exercise = exerciseById.get(set.exerciseId);
      if (!exercise) continue;

      totals[exercise.primaryMuscle] += 1;
      for (const secondary of exercise.secondaryMuscles) {
        totals[secondary] += 0.5;
      }
    }
  }

  return totals;
}

/**
 * Returns Monday 00:00:00.000 of the week containing `timestamp`, in local time.
 */
export function startOfWeekMs(timestamp: number): number {
  const d = new Date(timestamp);
  const day = (d.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

/**
 * Helper: current Mon-Sun week range as `[startMs, endMs)`.
 */
export function currentWeekRange(now: number = Date.now()): [number, number] {
  const start = startOfWeekMs(now);
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return [start, end];
}

export type VolumeZone = "below" | "effective" | "overload" | "excess";

export function volumeZone(
  sets: number,
  target: { mev: number; mav: number; mrv: number },
): VolumeZone {
  if (sets < target.mev) return "below";
  if (sets <= target.mav) return "effective";
  if (sets <= target.mrv) return "overload";
  return "excess";
}
