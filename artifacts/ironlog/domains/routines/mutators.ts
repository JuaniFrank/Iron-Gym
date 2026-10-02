import { and, asc, eq, isNull, max } from "drizzle-orm";
import {
  routineDays as routineDaysTable,
  routineExercises as routineExercisesTable,
  routines as routinesTable,
} from "@workspace/db/schema";
import { z } from "zod";

import { db } from "@/services/db";
import type { Routine, RoutineDay, RoutineExercise } from "@/types";
import { uid } from "@/utils/id";

const RoutineGoalSchema = z
  .enum(["strength", "hypertrophy", "cutting", "beginner"])
  .nullable();

const CreateRoutineInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const UpdateRoutineSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    goal: RoutineGoalSchema.optional(),
  })
  .strict();

const UpdateDaySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
  })
  .strict();

const UpdateExerciseSchema = z
  .object({
    targetSets: z.number().int().min(1).max(20).optional(),
    targetReps: z.number().int().min(1).max(100).optional(),
    warmupSets: z.number().int().min(0).max(10).optional(),
    restSeconds: z.number().int().min(0).max(900).optional(),
    notes: z.string().nullable().optional(),
    supersetWith: z.string().nullable().optional(),
    exerciseId: z.string().min(1).optional(),
  })
  .strict();

const DEFAULT_REST_SECONDS = 90;

/**
 * Convert a `routines` row into the legacy `Routine` shape. Days/exercises
 * are loaded separately because mutators rarely need the full tree.
 */
function rowToShallowRoutine(
  row: typeof routinesTable.$inferSelect,
): Routine {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    days: [],
    isPreset: row.isPreset,
    goal: row.goal ?? undefined,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

/**
 * Create a custom routine with one default day ("Día 1"). Mirrors the
 * legacy `createRoutine` which always seeded one day so the editor has
 * something to render.
 */
export async function createRoutine(
  input: { name: string; description?: string },
): Promise<Routine> {
  const validated = CreateRoutineInputSchema.parse(input);
  const id = uid();
  const dayId = uid();
  const now = new Date();
  await db.transaction((tx) => {
    tx.insert(routinesTable).values({
      id,
      name: validated.name,
      description: validated.description ?? null,
      goal: null,
      isPreset: false,
      createdAt: now,
      updatedAt: now,
    }).run();
    tx.insert(routineDaysTable).values({
      id: dayId,
      routineId: id,
      name: "Día 1",
      position: 0,
      updatedAt: now,
    }).run();
  });
  return {
    id,
    name: validated.name,
    description: validated.description,
    days: [{ id: dayId, name: "Día 1", exercises: [] }],
    isPreset: false,
    createdAt: now.getTime(),
  };
}

export async function updateRoutine(
  id: string,
  patch: Partial<Routine>,
): Promise<void> {
  const { days: _days, isPreset: _isPreset, createdAt: _createdAt, id: _id, ...rest } =
    patch as Partial<Routine>;
  void _days;
  void _isPreset;
  void _createdAt;
  void _id;
  const validated = UpdateRoutineSchema.parse(rest);
  if (Object.keys(validated).length === 0) return;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (validated.name !== undefined) updates.name = validated.name;
  if (validated.description !== undefined)
    updates.description = validated.description ?? null;
  if (validated.goal !== undefined) updates.goal = validated.goal ?? null;
  await db.update(routinesTable).set(updates).where(eq(routinesTable.id, id));
}

/**
 * Soft delete a routine + all its days + all its exercises (cascade-aware
 * soft delete — we set `deletedAt` on each level explicitly so reads
 * filtering on `deletedAt IS NULL` see a clean tree).
 */
export async function deleteRoutine(id: string): Promise<void> {
  const now = new Date();
  await db.transaction((tx) => {
    tx
      .update(routinesTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(routinesTable.id, id)).run();
    // Find all days first so we can soft-delete their exercises.
    const days = tx
      .select({ id: routineDaysTable.id })
      .from(routineDaysTable)
      .where(eq(routineDaysTable.routineId, id))
      .all();
    if (days.length > 0) {
      tx
        .update(routineDaysTable)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(routineDaysTable.routineId, id)).run();
      for (const day of days) {
        tx
          .update(routineExercisesTable)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(routineExercisesTable.routineDayId, day.id)).run();
      }
    }
  });
}

/**
 * Clone a routine (preset or custom) into a new custom routine. Days and
 * exercises are copied with fresh ids; positions are preserved (already
 * sequential thanks to the source).
 */
export async function cloneRoutine(id: string): Promise<Routine | null> {
  const newId = uid();
  const now = new Date();
  return await db.transaction((tx) => {
    const original = tx
      .select()
      .from(routinesTable)
      .where(and(eq(routinesTable.id, id), isNull(routinesTable.deletedAt)))
      .get();
    if (!original) return null;
    const days = tx
      .select()
      .from(routineDaysTable)
      .where(
        and(
          eq(routineDaysTable.routineId, id),
          isNull(routineDaysTable.deletedAt),
        ),
      )
      .orderBy(asc(routineDaysTable.position))
      .all();
    // Build day-id map (old → new) so we can re-anchor exercises + supersets.
    const dayIdMap = new Map<string, string>();
    for (const day of days) dayIdMap.set(day.id, uid());
    const dayIds = days.map((d) => d.id);
    const exs = dayIds.length
      ? tx
          .select()
          .from(routineExercisesTable)
          .where(
            and(
              isNull(routineExercisesTable.deletedAt),
              // Drizzle doesn't have IN here w/o sql.in; use OR via map.
              // Cheaper to filter in JS — typical day count is < 10.
            ),
          )
          .all()
      : [];
    const exsForRoutine = exs.filter((e) => dayIdMap.has(e.routineDayId));
    // Build exercise-id map (old → new) for superset rewiring.
    const exIdMap = new Map<string, string>();
    for (const ex of exsForRoutine) exIdMap.set(ex.id, uid());

    tx.insert(routinesTable).values({
      id: newId,
      name: `${original.name} (copia)`,
      description: original.description,
      goal: original.goal,
      isPreset: false,
      createdAt: now,
      updatedAt: now,
    }).run();
    for (const day of days) {
      tx.insert(routineDaysTable).values({
        id: dayIdMap.get(day.id)!,
        routineId: newId,
        name: day.name,
        position: day.position,
        updatedAt: now,
      }).run();
    }
    for (const ex of exsForRoutine) {
      tx.insert(routineExercisesTable).values({
        id: exIdMap.get(ex.id)!,
        routineDayId: dayIdMap.get(ex.routineDayId)!,
        exerciseId: ex.exerciseId,
        position: ex.position,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        warmupSets: ex.warmupSets,
        supersetWith: ex.supersetWith ? exIdMap.get(ex.supersetWith) ?? null : null,
        restSeconds: ex.restSeconds,
        notes: ex.notes,
        updatedAt: now,
      }).run();
    }
    return {
      ...rowToShallowRoutine({
        ...original,
        id: newId,
        name: `${original.name} (copia)`,
        isPreset: false,
        createdAt: now,
        updatedAt: now,
      }),
      // Days will be reloaded by the caller via `useAllRoutines`; this is
      // just enough to satisfy the legacy contract.
      days: [],
    };
  });
}

// ---------------------------------------------------------------------------
// Routine days
// ---------------------------------------------------------------------------

export async function addRoutineDay(
  routineId: string,
  name: string,
): Promise<RoutineDay> {
  z.string().min(1).parse(routineId);
  const validatedName = z.string().min(1).max(200).parse(name);
  const id = uid();
  const now = new Date();
  await db.transaction((tx) => {
    const row = tx
      .select({ p: max(routineDaysTable.position) })
      .from(routineDaysTable)
      .where(eq(routineDaysTable.routineId, routineId))
      .get();
    const position = (row?.p ?? -1) + 1;
    tx.insert(routineDaysTable).values({
      id,
      routineId,
      name: validatedName,
      position,
      updatedAt: now,
    }).run();
  });
  return { id, name: validatedName, exercises: [] };
}

export async function updateRoutineDay(
  _routineId: string,
  dayId: string,
  patch: Partial<RoutineDay>,
): Promise<void> {
  const { id: _id, exercises: _exercises, ...rest } = patch;
  void _id;
  void _exercises;
  const validated = UpdateDaySchema.parse(rest);
  if (Object.keys(validated).length === 0) return;
  await db
    .update(routineDaysTable)
    .set({ ...validated, updatedAt: new Date() })
    .where(eq(routineDaysTable.id, dayId));
}

export async function deleteRoutineDay(
  _routineId: string,
  dayId: string,
): Promise<void> {
  const now = new Date();
  await db.transaction((tx) => {
    tx
      .update(routineDaysTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(routineDaysTable.id, dayId)).run();
    tx
      .update(routineExercisesTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(routineExercisesTable.routineDayId, dayId)).run();
  });
}

/**
 * Reorder days within a routine. Uses position `-1` as a temporary slot to
 * dodge the `UNIQUE(routine_id, position)` constraint during the swap
 * (DDB-10 detail).
 *
 * `fromIndex` / `toIndex` reference the visible (non-deleted) days
 * sorted by position. Out-of-range indices are silently no-op.
 */
export async function reorderRoutineDays(
  routineId: string,
  fromIndex: number,
  toIndex: number,
): Promise<void> {
  if (fromIndex === toIndex) return;
  const now = new Date();
  await db.transaction((tx) => {
    const days = tx
      .select()
      .from(routineDaysTable)
      .where(
        and(
          eq(routineDaysTable.routineId, routineId),
          isNull(routineDaysTable.deletedAt),
        ),
      )
      .orderBy(asc(routineDaysTable.position))
      .all();
    if (fromIndex < 0 || fromIndex >= days.length) return;
    if (toIndex < 0 || toIndex >= days.length) return;
    const moved = days[fromIndex];
    const reordered = days.slice();
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    // Two-phase update to dodge `UNIQUE(routine_id, position)`:
    //   1. Park EVERY row at a negative position (offset by -1000) so no
    //      two rows ever share the same value during the rewrite.
    //      Single-row parking (only the moving row at -1) breaks when
    //      shifting forces another row to overwrite a still-occupied
    //      position — e.g. moving last-to-first with an ascending
    //      renumber loop collides on the second row.
    //   2. Renumber every row to its target index. Order of writes no
    //      longer matters because the source positions are all negative.
    for (let i = 0; i < reordered.length; i += 1) {
      tx
        .update(routineDaysTable)
        .set({ position: -1000 - i, updatedAt: now })
        .where(eq(routineDaysTable.id, reordered[i].id)).run();
    }
    for (let i = 0; i < reordered.length; i += 1) {
      tx
        .update(routineDaysTable)
        .set({ position: i, updatedAt: now })
        .where(eq(routineDaysTable.id, reordered[i].id)).run();
    }
  });
}

// ---------------------------------------------------------------------------
// Routine exercises
// ---------------------------------------------------------------------------

export async function addExerciseToDay(
  _routineId: string,
  dayId: string,
  exerciseId: string,
): Promise<RoutineExercise> {
  z.string().min(1).parse(dayId);
  z.string().min(1).parse(exerciseId);
  const id = uid();
  const now = new Date();
  await db.transaction((tx) => {
    const row = tx
      .select({ p: max(routineExercisesTable.position) })
      .from(routineExercisesTable)
      .where(eq(routineExercisesTable.routineDayId, dayId))
      .get();
    const position = (row?.p ?? -1) + 1;
    tx.insert(routineExercisesTable).values({
      id,
      routineDayId: dayId,
      exerciseId,
      position,
      targetSets: 3,
      targetReps: 10,
      warmupSets: 0,
      supersetWith: null,
      restSeconds: DEFAULT_REST_SECONDS,
      notes: null,
      updatedAt: now,
    }).run();
  });
  return {
    id,
    exerciseId,
    targetSets: 3,
    targetReps: 10,
    warmupSets: 0,
    restSeconds: DEFAULT_REST_SECONDS,
  };
}

export async function updateRoutineExercise(
  _routineId: string,
  _dayId: string,
  exerciseRowId: string,
  patch: Partial<RoutineExercise>,
): Promise<void> {
  const { id: _id, ...rest } = patch;
  void _id;
  const validated = UpdateExerciseSchema.parse(rest);
  if (Object.keys(validated).length === 0) return;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (validated.targetSets !== undefined)
    updates.targetSets = validated.targetSets;
  if (validated.targetReps !== undefined)
    updates.targetReps = validated.targetReps;
  if (validated.warmupSets !== undefined)
    updates.warmupSets = validated.warmupSets;
  if (validated.restSeconds !== undefined)
    updates.restSeconds = validated.restSeconds;
  if (validated.notes !== undefined) updates.notes = validated.notes ?? null;
  if (validated.supersetWith !== undefined)
    updates.supersetWith = validated.supersetWith ?? null;
  if (validated.exerciseId !== undefined)
    updates.exerciseId = validated.exerciseId;
  await db
    .update(routineExercisesTable)
    .set(updates)
    .where(eq(routineExercisesTable.id, exerciseRowId));
}

/**
 * Soft-delete a routine exercise. Also clears any superset-with references
 * that pointed to it (the partner pair drops back to a plain entry).
 */
export async function removeRoutineExercise(
  _routineId: string,
  _dayId: string,
  exerciseRowId: string,
): Promise<void> {
  const now = new Date();
  await db.transaction((tx) => {
    tx
      .update(routineExercisesTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(routineExercisesTable.id, exerciseRowId)).run();
    // Clear partner's supersetWith if it was pointing here.
    tx
      .update(routineExercisesTable)
      .set({ supersetWith: null, updatedAt: now })
      .where(eq(routineExercisesTable.supersetWith, exerciseRowId)).run();
  });
}

/**
 * Toggle a superset link between two exercises within the same day.
 * `withId = null` clears the link.
 *
 * Mutator-level invariant: when linking, the partner's `supersetWith` is
 * also set so the relation is symmetric (matches the legacy mutator). The
 * DB self-FK is plain text (not a real FK) — caller is responsible for
 * picking ids in the same day.
 */
export async function toggleSuperset(
  _routineId: string,
  _dayId: string,
  exerciseRowId: string,
  withId: string | null,
): Promise<void> {
  const now = new Date();
  await db.transaction((tx) => {
    if (withId == null) {
      // Find the previously-linked partner (if any) and clear its link too.
      const current = tx
        .select({ supersetWith: routineExercisesTable.supersetWith })
        .from(routineExercisesTable)
        .where(eq(routineExercisesTable.id, exerciseRowId))
        .get();
      tx
        .update(routineExercisesTable)
        .set({ supersetWith: null, updatedAt: now })
        .where(eq(routineExercisesTable.id, exerciseRowId)).run();
      if (current?.supersetWith) {
        tx
          .update(routineExercisesTable)
          .set({ supersetWith: null, updatedAt: now })
          .where(eq(routineExercisesTable.id, current.supersetWith)).run();
      }
      return;
    }
    tx
      .update(routineExercisesTable)
      .set({ supersetWith: withId, updatedAt: now })
      .where(eq(routineExercisesTable.id, exerciseRowId)).run();
    tx
      .update(routineExercisesTable)
      .set({ supersetWith: exerciseRowId, updatedAt: now })
      .where(eq(routineExercisesTable.id, withId)).run();
  });
}

