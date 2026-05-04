// Per-muscle volume target shape used by `user_profile.volume_targets`
// (JSON column).
//
// Keyed by `MuscleGroup` upstream — see `user_profile.ts` for the
// `Partial<Record<MuscleGroup, VolumeTarget>>` $type binding.

export interface VolumeTarget {
  /** Minimum effective volume — sets/week below this don't drive growth. */
  mev: number;
  /** Maximum adaptive volume — typical productive range upper bound. */
  mav: number;
  /** Maximum recoverable volume — exceeding it tends to break recovery. */
  mrv: number;
}
