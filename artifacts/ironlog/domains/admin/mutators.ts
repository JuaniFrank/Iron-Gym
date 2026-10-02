import { eq, inArray } from "drizzle-orm";
import {
  achievementsUnlocked,
  bodyMeasurements,
  bodyWeights,
  completedSets,
  exercises,
  featureDiscoveries,
  fitnessGoals,
  foodEntries,
  foodItems,
  keyValue,
  prRecords,
  progressPhotos,
  routineDays,
  routineExercises,
  routines,
  scheduledRoutines,
  scheduleOverrides,
  sessionNotes,
  sessionPlans,
  workoutSessions,
} from "@workspace/db/schema";

import { db } from "@/services/db";

/**
 * Wipe all user-mutable data and reset the seed gate so the next boot
 * re-seeds presets. Intended for development / testing — wired to the
 * "Reset all" action in the settings screen, gated behind a confirmation
 * Alert at the UI layer.
 *
 * Order matters: tables with FKs to others go first (children before
 * parents) even though we're doing physical deletes — minimizes the
 * window where an FK constraint could fail. The seed pipeline repopulates
 * `exercises` (presets), `food_items` (presets), `routines` + `routine_days`
 * + `routine_exercises` (presets), and the singleton `user_profile` on the
 * next boot.
 *
 * NOTE: also clears `_meta.seed_version` so reseed runs. The `seed_version`
 * row lives in `_meta`, which we leave alone here — `runSeedIfNeeded`
 * compares against `payload.version`, so resetting it requires a separate
 * write. Simpler: leave it; the next bumped SEED_VERSION will trigger the
 * reseed naturally. For pure dev resets, the user can also reinstall.
 */
export async function resetAll(): Promise<void> {
  await db.transaction((tx) => {
    // Children first (sets/notes/PRs cascade-deletable via session anyway,
    // but explicit deletes are safe).
    tx.delete(prRecords).run();
    tx.delete(sessionNotes).run();
    tx.delete(completedSets).run();
    tx.delete(workoutSessions).run();

    tx.delete(foodEntries).run();
    tx.delete(scheduledRoutines).run();
    tx.delete(scheduleOverrides).run();
    tx.delete(sessionPlans).run();
    tx.delete(achievementsUnlocked).run();
    tx.delete(featureDiscoveries).run();

    tx.delete(progressPhotos).run();
    tx.delete(bodyMeasurements).run();
    tx.delete(bodyWeights).run();
    tx.delete(fitnessGoals).run();

    // Custom catalog rows (preserve presets — seed will re-upsert them).
    // Find custom routine ids first to scope dependent deletes.
    const customRoutines = tx
      .select({ id: routines.id })
      .from(routines)
      .where(eq(routines.isPreset, false))
      .all();
    const customRoutineIds = customRoutines.map((r) => r.id);
    if (customRoutineIds.length > 0) {
      const customDays = tx
        .select({ id: routineDays.id })
        .from(routineDays)
        .where(inArray(routineDays.routineId, customRoutineIds))
        .all();
      const customDayIds = customDays.map((d) => d.id);
      if (customDayIds.length > 0) {
        tx
          .delete(routineExercises)
          .where(inArray(routineExercises.routineDayId, customDayIds)).run();
      }
      tx
        .delete(routineDays)
        .where(inArray(routineDays.routineId, customRoutineIds)).run();
      tx.delete(routines).where(eq(routines.isPreset, false)).run();
    }
    tx.delete(exercises).where(eq(exercises.isPreset, false)).run();
    tx.delete(foodItems).where(eq(foodItems.isPreset, false)).run();

    // Wipe key/value singletons (active workout id, default rest, etc.)
    tx.delete(keyValue).run();
  });
}
