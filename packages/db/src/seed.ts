import { eq } from "drizzle-orm";

import type { DB } from "./client/sqlite";
import { exercises } from "./schema/sqlite/exercises";
import { foodItems } from "./schema/sqlite/food_items";
import { meta } from "./schema/sqlite/_meta";
import { routineDays } from "./schema/sqlite/routine_days";
import { routineExercises } from "./schema/sqlite/routine_exercises";
import { routines } from "./schema/sqlite/routines";
import type { NewExercise } from "./schema/sqlite/exercises";
import type { NewFoodItem } from "./schema/sqlite/food_items";
import type { NewUserProfile } from "./schema/sqlite/user_profile";
import { userProfile } from "./schema/sqlite/user_profile";

/**
 * Schema version recorded in `_meta.schema_version`. Bumped when the
 * Drizzle schema changes in a way the runtime needs to detect at boot
 * (cf. DDB-8). NOT the same as `seed_version` (which gates re-running the
 * preset insert pipeline — DDB-15).
 */
export const SCHEMA_VERSION = 1;

/**
 * Ensure `_meta.schema_version` is persisted. Idempotent — if the row
 * already exists, leaves it alone (future migrations are responsible for
 * bumping the value via additive migration steps when needed).
 *
 * Called from `bootDatabase()` AFTER `runMigrations()` so we only stamp
 * the version once the schema is materialized.
 */
export async function ensureSchemaVersion(db: DB): Promise<void> {
  const stored = await db
    .select()
    .from(meta)
    .where(eq(meta.key, "schema_version"))
    .get();

  if (!stored) {
    await db.insert(meta).values({
      key: "schema_version",
      value: String(SCHEMA_VERSION),
    });
  }
}

// ---------------------------------------------------------------------------
// Seed payload contract.
//
// The package `@workspace/db` does NOT depend on `@workspace/ironlog` (it's
// the other way around). So instead of importing EXERCISES / FOOD_DATABASE /
// PRESET_ROUTINES here, the caller (in `bootDatabase()`) passes them in via
// `SeedPayload`. This keeps the dependency graph clean and lets tests inject
// minimal fixtures.
// ---------------------------------------------------------------------------

/** Legacy `Exercise` shape from `apps/ironlog/constants/exercises.ts`. */
export interface SeedExerciseInput {
  id: string;
  name: string;
  description: string;
  primaryMuscle: NewExercise["primaryMuscle"];
  secondaryMuscles: NewExercise["secondaryMuscles"];
  type: NewExercise["type"];
}

/** Legacy `FoodItem` shape from `apps/ironlog/constants/foods.ts`. */
export interface SeedFoodInput {
  id: string;
  name: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  defaultServingG?: number;
}

export interface SeedRoutineExerciseInput {
  /**
   * Optional stable id from the legacy preset. If absent, the seed derives a
   * deterministic id (`<routineDayId>:ex:<position>`) so reseeds upsert the
   * same row instead of duplicating it.
   */
  id?: string;
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  warmupSets?: number;
  restSeconds: number;
  /** Reference to another `routine_exercises.id` within the SAME day. */
  supersetWith?: string;
  notes?: string;
}

export interface SeedRoutineDayInput {
  /** Legacy day id. May not be globally unique across routines (e.g. "day-A"
   *  appears in multiple routines), so the seed prefixes with `routineId:` to
   *  build the row id. */
  id: string;
  name: string;
  exercises: SeedRoutineExerciseInput[];
}

export interface SeedRoutineInput {
  id: string;
  name: string;
  description?: string;
  goal?: "strength" | "hypertrophy" | "cutting" | "beginner";
  /** Legacy `createdAt` (ms). 0 / undefined → `Date.now()` at seed time. */
  createdAt?: number;
  days: SeedRoutineDayInput[];
}

export interface SeedPayload {
  /** Bumping this re-runs the seed (upsert by id). Compared against
   *  `_meta.seed_version`. */
  version: number;
  exercises: readonly SeedExerciseInput[];
  foods: readonly SeedFoodInput[];
  routines: readonly SeedRoutineInput[];
  /** Defaults for the singleton `user_profile` row. The seed only inserts on
   *  first boot — subsequent reseeds leave the existing profile untouched. */
  profileDefaults: Omit<NewUserProfile, "id" | "updatedAt">;
}

/**
 * Build the deterministic id for a `routine_days` row. Day legacy ids are
 * NOT globally unique (e.g. "day-A" recurs in different routines) so we
 * namespace by routine.
 */
function buildRoutineDayId(routineId: string, dayId: string): string {
  return `${routineId}:${dayId}`;
}

/**
 * Build the deterministic id for a `routine_exercises` row. The legacy
 * factory in `presetRoutines.ts` generates random suffixes which break
 * idempotent upsert, so the seed normalizes to a position-based id.
 */
function buildRoutineExerciseId(
  routineDayId: string,
  position: number,
  fallbackId?: string,
): string {
  return fallbackId ?? `${routineDayId}:ex:${position}`;
}

/**
 * Run the seed pipeline if the stored `_meta.seed_version` is older than
 * `payload.version` (DDB-14 + DDB-15). All work happens inside a single
 * transaction — partial seeds never land.
 *
 * Pattern for catalog tables (`exercises`, `food_items`, `routines`):
 * upsert by id with `is_preset = true`. Custom (user-created) rows have
 * `is_preset = false` and a different id space, so they're never touched.
 *
 * `user_profile` is inserted ONLY on first boot — once the user customizes
 * it, subsequent reseeds preserve their changes (via `onConflictDoNothing`).
 *
 * `routine_days` and `routine_exercises` use deterministic derived ids so
 * reseeds upsert in place. Cascade delete is set on the FKs but never
 * triggered here — we only ever upsert.
 */
export async function runSeedIfNeeded(
  db: DB,
  payload: SeedPayload,
): Promise<void> {
  const stored = await db
    .select()
    .from(meta)
    .where(eq(meta.key, "seed_version"))
    .get();

  const storedVersion = stored ? Number.parseInt(stored.value, 10) : 0;
  if (Number.isFinite(storedVersion) && storedVersion >= payload.version) {
    return;
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    // ---- exercises ------------------------------------------------------
    for (const ex of payload.exercises) {
      const row: NewExercise = {
        id: ex.id,
        name: ex.name,
        description: ex.description,
        primaryMuscle: ex.primaryMuscle,
        secondaryMuscles: ex.secondaryMuscles,
        type: ex.type,
        isPreset: true,
        updatedAt: now,
      };
      await tx
        .insert(exercises)
        .values(row)
        .onConflictDoUpdate({
          target: exercises.id,
          set: {
            name: row.name,
            description: row.description,
            primaryMuscle: row.primaryMuscle,
            secondaryMuscles: row.secondaryMuscles,
            type: row.type,
            isPreset: true,
            updatedAt: now,
            // Re-seed should resurrect a soft-deleted preset (the user
            // can't delete presets via the UI — DDB-16 — so this only
            // matters for stale dev DBs).
            deletedAt: null,
          },
        });
    }

    // ---- food_items -----------------------------------------------------
    for (const food of payload.foods) {
      const row: NewFoodItem = {
        id: food.id,
        name: food.name,
        brand: food.brand,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        defaultServingG: food.defaultServingG,
        isPreset: true,
        updatedAt: now,
      };
      await tx
        .insert(foodItems)
        .values(row)
        .onConflictDoUpdate({
          target: foodItems.id,
          set: {
            name: row.name,
            brand: row.brand ?? null,
            caloriesPer100g: row.caloriesPer100g,
            proteinPer100g: row.proteinPer100g,
            carbsPer100g: row.carbsPer100g,
            fatPer100g: row.fatPer100g,
            defaultServingG: row.defaultServingG ?? null,
            isPreset: true,
            updatedAt: now,
            deletedAt: null,
          },
        });
    }

    // ---- routines + routine_days + routine_exercises -------------------
    for (const routine of payload.routines) {
      const createdAt = routine.createdAt
        ? new Date(routine.createdAt)
        : now;

      await tx
        .insert(routines)
        .values({
          id: routine.id,
          name: routine.name,
          description: routine.description,
          goal: routine.goal,
          isPreset: true,
          createdAt,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: routines.id,
          set: {
            name: routine.name,
            description: routine.description ?? null,
            goal: routine.goal ?? null,
            isPreset: true,
            updatedAt: now,
            deletedAt: null,
          },
        });

      // First pass: insert all days + exercises with deterministic ids.
      // Superset references resolve in this same pass because the target
      // row was already inserted earlier in the loop (same day, lower
      // position) — for routines where `supersetWith` points forward,
      // a second pass would be needed. Currently no preset uses supersets
      // (cf. `constants/presetRoutines.ts`), so the simple ordering holds.
      for (let dayIdx = 0; dayIdx < routine.days.length; dayIdx += 1) {
        const day = routine.days[dayIdx];
        const dayRowId = buildRoutineDayId(routine.id, day.id);

        await tx
          .insert(routineDays)
          .values({
            id: dayRowId,
            routineId: routine.id,
            name: day.name,
            position: dayIdx,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: routineDays.id,
            set: {
              name: day.name,
              position: dayIdx,
              updatedAt: now,
              deletedAt: null,
            },
          });

        for (let exIdx = 0; exIdx < day.exercises.length; exIdx += 1) {
          const re = day.exercises[exIdx];
          const reId = buildRoutineExerciseId(dayRowId, exIdx, re.id);
          // Resolve the superset reference into the deterministic row id
          // space. The legacy preset payload uses the same legacy id
          // namespace, so we re-apply the same id builder.
          const supersetWith = re.supersetWith
            ? buildRoutineExerciseId(dayRowId, exIdx, re.supersetWith)
            : null;

          await tx
            .insert(routineExercises)
            .values({
              id: reId,
              routineDayId: dayRowId,
              exerciseId: re.exerciseId,
              position: exIdx,
              targetSets: re.targetSets,
              targetReps: re.targetReps,
              warmupSets: re.warmupSets ?? 0,
              supersetWith,
              restSeconds: re.restSeconds,
              notes: re.notes,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: routineExercises.id,
              set: {
                routineDayId: dayRowId,
                exerciseId: re.exerciseId,
                position: exIdx,
                targetSets: re.targetSets,
                targetReps: re.targetReps,
                warmupSets: re.warmupSets ?? 0,
                supersetWith,
                restSeconds: re.restSeconds,
                notes: re.notes ?? null,
                updatedAt: now,
                deletedAt: null,
              },
            });
        }
      }
    }

    // ---- user_profile (singleton, only on first boot) -------------------
    await tx
      .insert(userProfile)
      .values({
        id: "singleton",
        ...payload.profileDefaults,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: userProfile.id });

    // ---- _meta.seed_version --------------------------------------------
    await tx
      .insert(meta)
      .values({ key: "seed_version", value: String(payload.version) })
      .onConflictDoUpdate({
        target: meta.key,
        set: { value: String(payload.version) },
      });
  });
}
