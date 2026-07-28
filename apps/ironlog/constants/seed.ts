import type { UserProfile } from "@/types";

/**
 * Seed version recorded in `_meta.seed_version` (cf. DDB-15).
 *
 * Bump this constant when EXERCISES, FOOD_DATABASE, or PRESET_ROUTINES change
 * (additions, edits, deletions). The next boot detects the version skew and
 * re-runs `runSeedIfNeeded` (upsert by id), applying only the diff. Code review
 * makes the bump visible — forgetting it doesn't break anything (existing
 * presets stay), it just doesn't ship the new ones.
 *
 * NOT the same as `_meta.schema_version` (which gates Drizzle migrations).
 */
export const SEED_VERSION = 1;

/**
 * Default singleton profile inserted on first boot.
 *
 * Mirrors the legacy `DEFAULT_PROFILE` in `IronLogContext` — same shape so the
 * UI/onboarding flows behave identically once they switch to reading from DB
 * (Step 4). `volumeTargets` stays undefined here; consumers fall back to
 * `constants/volumeTargets.DEFAULT_VOLUME_TARGETS` via `resolveVolumeTarget`.
 *
 * `featureDiscoveries` lives in its own table (`feature_discoveries`) and is
 * NOT part of the singleton row.
 */
export const DEFAULT_PROFILE: UserProfile = {
  name: "Atleta",
  age: 28,
  weightKg: 75,
  heightCm: 175,
  sex: "male",
  activityLevel: "moderate",
  goal: "muscle",
  units: "metric",
  theme: "system",
  caloriesGoal: 2500,
  proteinGoalG: 150,
  carbsGoalG: 280,
  fatGoalG: 80,
};
