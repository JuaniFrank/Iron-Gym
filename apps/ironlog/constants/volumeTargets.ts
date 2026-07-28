import type { MuscleGroup, VolumeTarget } from "@/types";

/**
 * Default weekly volume targets per muscle group (sets/week).
 *
 * Numbers come from Renaissance Periodization ballparks for an intermediate
 * lifter focused on hypertrophy. They are *orientative*, not absolute truth —
 * the UI must communicate that.
 *
 * Override per user via `Profile.volumeTargets`.
 */
export const DEFAULT_VOLUME_TARGETS: Record<MuscleGroup, VolumeTarget> = {
  chest: { mev: 8, mav: 16, mrv: 22 },
  back: { mev: 10, mav: 18, mrv: 25 },
  shoulders: { mev: 8, mav: 16, mrv: 22 },
  biceps: { mev: 8, mav: 16, mrv: 24 },
  triceps: { mev: 6, mav: 14, mrv: 22 },
  quadriceps: { mev: 8, mav: 16, mrv: 22 },
  hamstrings: { mev: 6, mav: 14, mrv: 20 },
  glutes: { mev: 6, mav: 14, mrv: 20 },
  calves: { mev: 8, mav: 16, mrv: 25 },
  abs: { mev: 0, mav: 16, mrv: 25 },
  forearms: { mev: 0, mav: 8, mrv: 20 },
};

export function resolveVolumeTarget(
  muscle: MuscleGroup,
  override?: Partial<Record<MuscleGroup, VolumeTarget>>,
): VolumeTarget {
  return override?.[muscle] ?? DEFAULT_VOLUME_TARGETS[muscle];
}
