import { and, eq, isNotNull, isNull, max, sql } from "drizzle-orm";
import {
  achievementsUnlocked,
  bodyWeights,
  completedSets,
  exercises as exercisesTable,
  keyValue,
  prRecords,
  routineDays as routineDaysTable,
  routineExercises as routineExercisesTable,
  routines as routinesTable,
  workoutSessions,
} from "@workspace/db/schema";
import { z } from "zod";

import { ACHIEVEMENTS } from "@/constants/achievements";
import { db } from "@/services/db";
import type {
  AchievementUnlock,
  CompletedSet,
  PRRecord,
  WorkoutSession,
} from "@/types";
import { dateKey } from "@/utils/date";
import { uid } from "@/utils/id";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTIVE_KEY = "active_workout_id";

function toMs(value: Date | number | null | undefined): number | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.getTime();
  return value;
}

function rowToSession(
  row: typeof workoutSessions.$inferSelect,
): WorkoutSession {
  return {
    id: row.id,
    routineId: row.routineId ?? undefined,
    routineDayId: row.routineDayId ?? undefined,
    routineName: row.routineName,
    dayName: row.dayName,
    startedAt: toMs(row.startedAt) ?? Date.now(),
    endedAt: toMs(row.endedAt),
    sets: [],
    exerciseOrder: row.exerciseOrder,
    skippedExerciseIds: row.skippedExerciseIds,
    totalVolumeKg: row.totalVolumeKg,
    prsAchieved: [],
    notes: row.notes ?? undefined,
  };
}

function rowToSet(row: typeof completedSets.$inferSelect): CompletedSet {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    weight: row.weight,
    reps: row.reps,
    rpe: row.rpe ?? undefined,
    isWarmup: row.isWarmup,
    setIndex: row.setIndex,
    completedAt: toMs(row.completedAt) ?? Date.now(),
  };
}

/**
 * Tx-agnostic helper: accepts either the top-level db handle or a
 * Drizzle transaction. The `Pick<...>` makes the parameter cover only the
 * methods we use, avoiding the `$client` mismatch between the SQLite db
 * type and the SQLiteTransaction type.
 */
type TxLike = Pick<typeof db, "delete" | "insert">;

function setActiveWorkoutId(
  tx: TxLike,
  id: string | null,
): void {
  const now = new Date();
  if (id == null) {
    tx.delete(keyValue).where(eq(keyValue.key, ACTIVE_KEY)).run();
    return;
  }
  tx.insert(keyValue)
    .values({ key: ACTIVE_KEY, value: id, updatedAt: now })
    .onConflictDoUpdate({
      target: keyValue.key,
      set: { value: id, updatedAt: now },
    })
    .run();
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * Start a workout from a routine + day. Resolves snapshot fields
 * (`routineName`, `dayName`) and the initial `exerciseOrder` from the
 * routine tree. Sets `active_workout_id` in the same transaction.
 */
export async function startWorkout(
  routineId: string,
  dayId: string,
): Promise<WorkoutSession> {
  z.string().min(1).parse(routineId);
  z.string().min(1).parse(dayId);
  const id = uid();
  const now = new Date();

  return await db.transaction((tx) => {
    const routine = tx
      .select({ name: routinesTable.name })
      .from(routinesTable)
      .where(eq(routinesTable.id, routineId))
      .get();
    const day = tx
      .select({ name: routineDaysTable.name })
      .from(routineDaysTable)
      .where(eq(routineDaysTable.id, dayId))
      .get();
    const exs = tx
      .select({ exerciseId: routineExercisesTable.exerciseId })
      .from(routineExercisesTable)
      .where(
        and(
          eq(routineExercisesTable.routineDayId, dayId),
          isNull(routineExercisesTable.deletedAt),
        ),
      )
      .orderBy(routineExercisesTable.position)
      .all();

    const exerciseOrder = exs.map((e) => e.exerciseId);
    const session = {
      id,
      routineId,
      routineDayId: dayId,
      routineName: routine?.name ?? "Sesión",
      dayName: day?.name ?? "Día",
      startedAt: now,
      endedAt: null,
      exerciseOrder,
      skippedExerciseIds: [] as string[],
      totalVolumeKg: 0,
      notes: null,
      updatedAt: now,
    };
    tx.insert(workoutSessions).values(session).run();
    setActiveWorkoutId(tx, id);

    return {
      id,
      routineId,
      routineDayId: dayId,
      routineName: session.routineName,
      dayName: session.dayName,
      startedAt: now.getTime(),
      sets: [],
      exerciseOrder,
      skippedExerciseIds: [],
      totalVolumeKg: 0,
      prsAchieved: [],
    };
  });
}

/**
 * Start an empty workout (no routine binding). `name` becomes the
 * `routineName` snapshot; `dayName` is forced to "Libre" (matches legacy).
 */
export async function startEmptyWorkout(
  name: string = "Sesión libre",
): Promise<WorkoutSession> {
  const id = uid();
  const now = new Date();
  return await db.transaction((tx) => {
    tx.insert(workoutSessions).values({
      id,
      routineId: null,
      routineDayId: null,
      routineName: name,
      dayName: "Libre",
      startedAt: now,
      endedAt: null,
      exerciseOrder: [],
      skippedExerciseIds: [],
      totalVolumeKg: 0,
      notes: null,
      updatedAt: now,
    }).run();
    setActiveWorkoutId(tx, id);
    return {
      id,
      routineName: name,
      dayName: "Libre",
      startedAt: now.getTime(),
      sets: [],
      exerciseOrder: [],
      skippedExerciseIds: [],
      totalVolumeKg: 0,
      prsAchieved: [],
    };
  });
}

/**
 * Cancel an in-progress session. Physical delete (sets cascade) — this
 * sets is acceptable as a v1 decision (cf. db-integration.md §8 list).
 * Clears `active_workout_id` in the same transaction.
 */
export async function cancelWorkout(sessionId: string): Promise<void> {
  z.string().min(1).parse(sessionId);
  await db.transaction((tx) => {
    tx.delete(workoutSessions).where(eq(workoutSessions.id, sessionId)).run();
    setActiveWorkoutId(tx, null);
  });
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

const LogSetSchema = z.object({
  exerciseId: z.string().min(1),
  weight: z.number().min(0),
  reps: z.number().int().min(0),
  rpe: z.number().min(0).max(10).optional(),
  isWarmup: z.boolean(),
  setIndex: z.number().int().min(0),
});

/**
 * Log a single set against a session. If the set's exerciseId is not yet
 * in `exerciseOrder`, append it (legacy behavior for "log without picking
 * order first"). Updates the session's `total_volume_kg` snapshot.
 */
export async function logSet(
  sessionId: string,
  set: Omit<CompletedSet, "id" | "completedAt">,
): Promise<void> {
  const validated = LogSetSchema.parse(set);
  const id = uid();
  const now = new Date();
  await db.transaction((tx) => {
    tx.insert(completedSets).values({
      id,
      sessionId,
      exerciseId: validated.exerciseId,
      weight: validated.weight,
      reps: validated.reps,
      rpe: validated.rpe ?? null,
      isWarmup: validated.isWarmup,
      setIndex: validated.setIndex,
      completedAt: now,
      updatedAt: now,
    }).run();
    // Append to exerciseOrder if missing.
    const session = tx
      .select({
        exerciseOrder: workoutSessions.exerciseOrder,
        skippedExerciseIds: workoutSessions.skippedExerciseIds,
      })
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .get();
    if (!session) return;
    const updates: Record<string, unknown> = { updatedAt: now };
    if (!session.exerciseOrder.includes(validated.exerciseId)) {
      updates.exerciseOrder = [
        ...session.exerciseOrder,
        validated.exerciseId,
      ];
    }
    // Recompute total volume excluding warmups + skipped.
    const allSets = tx
      .select({
        weight: completedSets.weight,
        reps: completedSets.reps,
        isWarmup: completedSets.isWarmup,
        exerciseId: completedSets.exerciseId,
      })
      .from(completedSets)
      .where(
        and(
          eq(completedSets.sessionId, sessionId),
          isNull(completedSets.deletedAt),
        ),
      )
      .all();
    const skipped = new Set(session.skippedExerciseIds);
    const volume = allSets
      .filter((s) => !s.isWarmup && !skipped.has(s.exerciseId))
      .reduce((sum, s) => sum + s.weight * s.reps, 0);
    updates.totalVolumeKg = Math.round(volume);
    tx
      .update(workoutSessions)
      .set(updates)
      .where(eq(workoutSessions.id, sessionId)).run();
  });
}

/**
 * Physical delete of a set. The legacy mutator did the same — sets are
 * granular log data, no soft-delete value. Recomputes session volume.
 */
export async function removeSet(
  sessionId: string,
  setId: string,
): Promise<void> {
  await db.transaction((tx) => {
    tx.delete(completedSets).where(eq(completedSets.id, setId)).run();
    const session = tx
      .select({
        skippedExerciseIds: workoutSessions.skippedExerciseIds,
      })
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .get();
    if (!session) return;
    const allSets = tx
      .select({
        weight: completedSets.weight,
        reps: completedSets.reps,
        isWarmup: completedSets.isWarmup,
        exerciseId: completedSets.exerciseId,
      })
      .from(completedSets)
      .where(
        and(
          eq(completedSets.sessionId, sessionId),
          isNull(completedSets.deletedAt),
        ),
      )
      .all();
    const skipped = new Set(session.skippedExerciseIds);
    const volume = allSets
      .filter((s) => !s.isWarmup && !skipped.has(s.exerciseId))
      .reduce((sum, s) => sum + s.weight * s.reps, 0);
    tx
      .update(workoutSessions)
      .set({ totalVolumeKg: Math.round(volume), updatedAt: new Date() })
      .where(eq(workoutSessions.id, sessionId)).run();
  });
}

// ---------------------------------------------------------------------------
// Exercise order management
// ---------------------------------------------------------------------------

export async function addExerciseToActiveWorkout(
  sessionId: string,
  exerciseId: string,
): Promise<void> {
  z.string().min(1).parse(exerciseId);
  await db.transaction((tx) => {
    const session = tx
      .select({ exerciseOrder: workoutSessions.exerciseOrder })
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .get();
    if (!session) return;
    if (session.exerciseOrder.includes(exerciseId)) return;
    tx
      .update(workoutSessions)
      .set({
        exerciseOrder: [...session.exerciseOrder, exerciseId],
        updatedAt: new Date(),
      })
      .where(eq(workoutSessions.id, sessionId)).run();
  });
}

export async function reorderSessionExercises(
  sessionId: string,
  fromIndex: number,
  toIndex: number,
): Promise<void> {
  if (fromIndex === toIndex) return;
  await db.transaction((tx) => {
    const session = tx
      .select({ exerciseOrder: workoutSessions.exerciseOrder })
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .get();
    if (!session) return;
    const order = session.exerciseOrder.slice();
    if (fromIndex < 0 || fromIndex >= order.length) return;
    if (toIndex < 0 || toIndex >= order.length) return;
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    tx
      .update(workoutSessions)
      .set({ exerciseOrder: order, updatedAt: new Date() })
      .where(eq(workoutSessions.id, sessionId)).run();
  });
}

/**
 * Replace one exercise in the session with another, preserving position.
 * Sets logged for the old exerciseId are UPDATED in place to point at the
 * new exerciseId — preserves the user's logged weight/reps and crucially
 * preserves `completedAt`. (Plain UPDATE, NOT delete+insert).
 *
 * If the target exercise was already elsewhere in the order, the duplicate
 * is dropped (mirrors legacy logic).
 */
export async function replaceSessionExercise(
  sessionId: string,
  fromExerciseId: string,
  toExerciseId: string,
): Promise<void> {
  if (fromExerciseId === toExerciseId) return;
  await db.transaction((tx) => {
    const session = tx
      .select({
        exerciseOrder: workoutSessions.exerciseOrder,
        skippedExerciseIds: workoutSessions.skippedExerciseIds,
      })
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .get();
    if (!session) return;
    const fromIdx = session.exerciseOrder.indexOf(fromExerciseId);
    if (fromIdx === -1) return;
    const newOrder = session.exerciseOrder
      .filter((x, i) => !(x === toExerciseId && i !== fromIdx))
      .map((x) => (x === fromExerciseId ? toExerciseId : x));
    const newSkipped = session.skippedExerciseIds.map((x) =>
      x === fromExerciseId ? toExerciseId : x,
    );
    const now = new Date();
    tx
      .update(workoutSessions)
      .set({
        exerciseOrder: newOrder,
        skippedExerciseIds: newSkipped,
        updatedAt: now,
      })
      .where(eq(workoutSessions.id, sessionId)).run();
    // Migrate sets in place — keeps `completedAt`/`id` so the user's recap is intact.
    tx
      .update(completedSets)
      .set({ exerciseId: toExerciseId, updatedAt: now })
      .where(
        and(
          eq(completedSets.sessionId, sessionId),
          eq(completedSets.exerciseId, fromExerciseId),
        ),
      ).run();
  });
}

export async function setSessionExerciseSkipped(
  sessionId: string,
  exerciseId: string,
  skipped: boolean,
): Promise<void> {
  await db.transaction((tx) => {
    const session = tx
      .select({
        skippedExerciseIds: workoutSessions.skippedExerciseIds,
      })
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .get();
    if (!session) return;
    const set = new Set(session.skippedExerciseIds);
    if (skipped) set.add(exerciseId);
    else set.delete(exerciseId);
    tx
      .update(workoutSessions)
      .set({
        skippedExerciseIds: Array.from(set),
        updatedAt: new Date(),
      })
      .where(eq(workoutSessions.id, sessionId)).run();
  });
}

/**
 * Remove an exercise from the session AND delete its logged sets. Mirrors
 * legacy `removeSessionExercise` which dropped the sets.
 */
export async function removeSessionExercise(
  sessionId: string,
  exerciseId: string,
): Promise<void> {
  await db.transaction((tx) => {
    const session = tx
      .select({
        exerciseOrder: workoutSessions.exerciseOrder,
        skippedExerciseIds: workoutSessions.skippedExerciseIds,
      })
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .get();
    if (!session) return;
    const newOrder = session.exerciseOrder.filter((x) => x !== exerciseId);
    const newSkipped = session.skippedExerciseIds.filter(
      (x) => x !== exerciseId,
    );
    const now = new Date();
    tx
      .update(workoutSessions)
      .set({
        exerciseOrder: newOrder,
        skippedExerciseIds: newSkipped,
        updatedAt: now,
      })
      .where(eq(workoutSessions.id, sessionId)).run();
    tx
      .delete(completedSets)
      .where(
        and(
          eq(completedSets.sessionId, sessionId),
          eq(completedSets.exerciseId, exerciseId),
        ),
      ).run();
    // Recompute total volume.
    const remaining = tx
      .select({
        weight: completedSets.weight,
        reps: completedSets.reps,
        isWarmup: completedSets.isWarmup,
        exerciseId: completedSets.exerciseId,
      })
      .from(completedSets)
      .where(
        and(
          eq(completedSets.sessionId, sessionId),
          isNull(completedSets.deletedAt),
        ),
      )
      .all();
    const skippedSet = new Set(newSkipped);
    const volume = remaining
      .filter((s) => !s.isWarmup && !skippedSet.has(s.exerciseId))
      .reduce((sum, s) => sum + s.weight * s.reps, 0);
    tx
      .update(workoutSessions)
      .set({ totalVolumeKg: Math.round(volume), updatedAt: now })
      .where(eq(workoutSessions.id, sessionId)).run();
  });
}

// ---------------------------------------------------------------------------
// Default rest seconds (key_value)
// ---------------------------------------------------------------------------

export async function setDefaultRest(seconds: number): Promise<void> {
  const validated = z.number().int().min(0).max(900).parse(seconds);
  const now = new Date();
  await db
    .insert(keyValue)
    .values({
      key: "default_rest_seconds",
      value: validated,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: keyValue.key,
      set: { value: validated, updatedAt: now },
    });
}

// ---------------------------------------------------------------------------
// finishWorkout (the big one)
// ---------------------------------------------------------------------------

/**
 * Finalize a session: stamp `endedAt` + `notes`, detect PRs against the
 * rest of the user's history, evaluate achievements, and clear
 * `active_workout_id`.
 *
 * PR detection (DDB-12):
 *   For each non-skipped exercise with at least one non-warmup set in the
 *   current session, compare the session's max weight against the
 *   per-exercise historical max (excluding the current session). If the
 *   current exceeds, insert a `pr_records` row with snapshot
 *   `exerciseName` + `previousValue`. UNIQUE(session_id, exercise_id, type)
 *   makes re-running this idempotent.
 *
 * Achievements (DDB-20):
 *   Run all `ACHIEVEMENTS.check(state)` against the loaded snapshot,
 *   filter out already-unlocked, insert the new ones.
 *
 * The whole op runs in a single transaction so partial finishes never
 * land.
 */
export async function finishWorkout(
  sessionId: string,
  notes?: string,
): Promise<{
  session: WorkoutSession;
  prs: PRRecord[];
  newAchievements: AchievementUnlock[];
}> {
  z.string().min(1).parse(sessionId);
  const now = new Date();

  return await db.transaction((tx) => {
    const session = tx
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .get();
    if (!session) {
      throw new Error(`finishWorkout: session ${sessionId} not found`);
    }

    const setRows = tx
      .select()
      .from(completedSets)
      .where(
        and(
          eq(completedSets.sessionId, sessionId),
          isNull(completedSets.deletedAt),
        ),
      )
      .all();
    const skipped = new Set(session.skippedExerciseIds);

    // ---- PR detection -----------------------------------------------------
    const detectedPrs: PRRecord[] = [];
    const exerciseIdsInSession = Array.from(
      new Set(setRows.map((s) => s.exerciseId)),
    );
    for (const exId of exerciseIdsInSession) {
      if (skipped.has(exId)) continue;
      const currentMax = setRows
        .filter((s) => s.exerciseId === exId && !s.isWarmup)
        .reduce((m, s) => Math.max(m, s.weight), 0);
      if (currentMax <= 0) continue;

      // Historical max — exclude this session, only finished sessions, only non-warmup.
      const histRow = tx
        .select({ m: max(completedSets.weight) })
        .from(completedSets)
        .innerJoin(
          workoutSessions,
          eq(completedSets.sessionId, workoutSessions.id),
        )
        .where(
          and(
            eq(completedSets.exerciseId, exId),
            eq(completedSets.isWarmup, false),
            isNull(completedSets.deletedAt),
            isNotNull(workoutSessions.endedAt),
            isNull(workoutSessions.deletedAt),
            sql`${workoutSessions.id} != ${sessionId}`,
          ),
        )
        .get();
      const previousMax = histRow?.m ?? 0;

      if (currentMax > previousMax) {
        const exRow = tx
          .select({ name: exercisesTable.name })
          .from(exercisesTable)
          .where(eq(exercisesTable.id, exId))
          .get();
        const exerciseName = exRow?.name ?? exId;
        detectedPrs.push({
          exerciseId: exId,
          exerciseName,
          type: "weight",
          value: currentMax,
          previousValue: previousMax > 0 ? previousMax : undefined,
          achievedAt: now.getTime(),
        });
      }
    }

    // ---- Compute total volume + finalize session row ---------------------
    const totalVolume = setRows
      .filter((s) => !s.isWarmup && !skipped.has(s.exerciseId))
      .reduce((sum, s) => sum + s.weight * s.reps, 0);
    tx
      .update(workoutSessions)
      .set({
        endedAt: now,
        notes: notes ?? session.notes ?? null,
        totalVolumeKg: Math.round(totalVolume),
        updatedAt: now,
      })
      .where(eq(workoutSessions.id, sessionId)).run();

    // ---- Insert PR rows (idempotent via UNIQUE) --------------------------
    for (const pr of detectedPrs) {
      tx
        .insert(prRecords)
        .values({
          id: uid(),
          sessionId,
          exerciseId: pr.exerciseId,
          exerciseName: pr.exerciseName,
          type: pr.type,
          value: pr.value,
          previousValue: pr.previousValue ?? null,
          achievedAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [prRecords.sessionId, prRecords.exerciseId, prRecords.type],
        }).run();
    }

    // ---- Clear active workout BEFORE achievements (so the loaded state
    //      reflects the just-finished session as a finished one). The session
    //      row is already updated above with endedAt, so loadAchievementState
    //      will pick it up.
    setActiveWorkoutId(tx, null);

    // ---- Achievements ----------------------------------------------------
    // Note: loadAchievementState uses `db` (the singleton handle), NOT `tx`.
    // We commit the session/pr writes via the surrounding transaction
    // before returning — the read here happens within the tx by virtue of
    // calling tx-aware helpers? Actually, loadAchievementState uses `db`,
    // which is the same SQLite connection. expo-sqlite serializes per
    // connection so the read sees the in-flight tx writes. To be safe and
    // explicit, we re-implement the load inline using `tx`.
    const sessionsRows = tx
      .select()
      .from(workoutSessions)
      .where(
        and(
          isNotNull(workoutSessions.endedAt),
          isNull(workoutSessions.deletedAt),
        ),
      )
      .all();
    const allSetsRows = tx
      .select()
      .from(completedSets)
      .where(isNull(completedSets.deletedAt))
      .all();
    const allPrsRows = tx
      .select()
      .from(prRecords)
      .where(isNull(prRecords.deletedAt))
      .all();
    // Body weights are needed for the `weight-tracker` achievement
    // (length >= 10). Load inside the tx to keep the snapshot consistent.
    const bodyWeightRows = tx
      .select()
      .from(bodyWeights)
      .where(isNull(bodyWeights.deletedAt))
      .all();
    const setsBySession = new Map<string, typeof allSetsRows>();
    for (const s of allSetsRows) {
      const arr = setsBySession.get(s.sessionId) ?? [];
      arr.push(s);
      setsBySession.set(s.sessionId, arr);
    }
    const sessionsForCheck: WorkoutSession[] = sessionsRows.map((row) => ({
      ...rowToSession(row),
      sets: (setsBySession.get(row.id) ?? []).map(rowToSet),
    }));
    const prsForCheck: PRRecord[] = allPrsRows.map((row) => ({
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      type: row.type,
      value: row.value,
      previousValue: row.previousValue ?? undefined,
      achievedAt: toMs(row.achievedAt) ?? Date.now(),
    }));
    // Compute streak inside the tx — small projection, cheap.
    const streakRows = tx
      .select({ endedAt: workoutSessions.endedAt })
      .from(workoutSessions)
      .where(
        and(
          isNotNull(workoutSessions.endedAt),
          isNull(workoutSessions.deletedAt),
        ),
      )
      .all();
    const trainedKeys = new Set<string>();
    for (const row of streakRows) {
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

    const stateForCheck = {
      sessions: sessionsForCheck,
      bodyWeights: bodyWeightRows.map((r) => ({
        id: r.id,
        date: r.date instanceof Date ? r.date.getTime() : r.date,
        weightKg: r.weightKg,
      })),
      streak,
      prs: prsForCheck,
    };

    const alreadyUnlocked = new Set(
      (tx.select({ id: achievementsUnlocked.id }).from(achievementsUnlocked).all())
        .map((a) => a.id),
    );
    const newUnlocks: AchievementUnlock[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (alreadyUnlocked.has(ach.id)) continue;
      try {
        if (ach.check(stateForCheck)) {
          newUnlocks.push({ id: ach.id, unlockedAt: now.getTime() });
        }
      } catch {
        // A buggy check fn shouldn't break finishWorkout — skip it.
      }
    }
    if (newUnlocks.length > 0) {
      for (const a of newUnlocks) {
        tx
          .insert(achievementsUnlocked)
          .values({ id: a.id, unlockedAt: now })
          .onConflictDoNothing({ target: achievementsUnlocked.id }).run();
      }
    }

    // ---- Build return payload --------------------------------------------
    const finalSession: WorkoutSession = {
      ...rowToSession({
        ...session,
        endedAt: now,
        notes: notes ?? session.notes ?? null,
        totalVolumeKg: Math.round(totalVolume),
      }),
      sets: setRows.map(rowToSet),
      prsAchieved: detectedPrs,
    };

    return {
      session: finalSession,
      prs: detectedPrs,
      newAchievements: newUnlocks,
    };
  });
}
