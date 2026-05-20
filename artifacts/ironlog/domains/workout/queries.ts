import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  completedSets,
  keyValue,
  prRecords,
  sessionSetDrafts,
  workoutSessions,
} from "@workspace/db/schema";
import { useMemo } from "react";

import { db } from "@/services/db";
import type { CompletedSet, PRRecord, WorkoutSession } from "@/types";
import { dateKey } from "@/utils/date";

// ---------------------------------------------------------------------------
// Row → legacy shape mappers
// ---------------------------------------------------------------------------

function toMs(value: Date | number | null | undefined): number | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.getTime();
  return value;
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

function rowToPR(row: typeof prRecords.$inferSelect): PRRecord {
  return {
    exerciseId: row.exerciseId,
    exerciseName: row.exerciseName,
    type: row.type,
    value: row.value,
    previousValue: row.previousValue ?? undefined,
    achievedAt: toMs(row.achievedAt) ?? Date.now(),
  };
}

interface SessionRow {
  id: string;
  routineId: string | null;
  routineDayId: string | null;
  routineName: string;
  dayName: string;
  startedAt: Date | number;
  endedAt: Date | number | null;
  exerciseOrder: string[];
  skippedExerciseIds: string[];
  totalVolumeKg: number;
  notes: string | null;
}

function buildSession(
  row: SessionRow,
  sets: readonly (typeof completedSets.$inferSelect)[],
  prs: readonly (typeof prRecords.$inferSelect)[],
): WorkoutSession {
  return {
    id: row.id,
    routineId: row.routineId ?? undefined,
    routineDayId: row.routineDayId ?? undefined,
    routineName: row.routineName,
    dayName: row.dayName,
    startedAt: toMs(row.startedAt) ?? Date.now(),
    endedAt: toMs(row.endedAt),
    sets: sets.map(rowToSet),
    exerciseOrder: row.exerciseOrder,
    skippedExerciseIds: row.skippedExerciseIds,
    totalVolumeKg: row.totalVolumeKg,
    prsAchieved: prs.map(rowToPR),
    notes: row.notes ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Active workout session (or null when no `active_workout_id` is set OR the
 * referenced session no longer exists).
 *
 * Two-step subscription pattern: read `key_value.active_workout_id`, then
 * subscribe to that session + its sets + prs. The legacy context cached
 * `activeWorkoutId` as a state slice; here it's a row in `key_value`.
 */
export function useActiveSession(): WorkoutSession | null {
  // Active workout id from key_value.
  const activeIdQ = useLiveQuery(
    db
      .select()
      .from(keyValue)
      .where(eq(keyValue.key, "active_workout_id"))
      .limit(1),
  );
  const activeId = useMemo<string | null>(() => {
    const row = activeIdQ.data?.[0];
    if (!row) return null;
    if (typeof row.value === "string") return row.value;
    if (row.value && typeof row.value === "object" && "id" in row.value) {
      const id = (row.value as { id: unknown }).id;
      return typeof id === "string" ? id : null;
    }
    return null;
  }, [activeIdQ.data]);

  // Subscribe to the session itself, sets, and prs filtered by sessionId.
  const sessionQ = useMemo(
    () =>
      db
        .select()
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.id, activeId ?? ""),
            isNull(workoutSessions.deletedAt),
          ),
        )
        .limit(1),
    [activeId],
  );
  const setsQ = useMemo(
    () =>
      db
        .select()
        .from(completedSets)
        .where(
          and(
            eq(completedSets.sessionId, activeId ?? ""),
            isNull(completedSets.deletedAt),
          ),
        )
        .orderBy(asc(completedSets.completedAt)),
    [activeId],
  );
  const prsQ = useMemo(
    () =>
      db
        .select()
        .from(prRecords)
        .where(
          and(
            eq(prRecords.sessionId, activeId ?? ""),
            isNull(prRecords.deletedAt),
          ),
        ),
    [activeId],
  );

  const session = useLiveQuery(sessionQ, [activeId]);
  const sets = useLiveQuery(setsQ, [activeId]);
  const prs = useLiveQuery(prsQ, [activeId]);

  return useMemo(() => {
    if (!activeId) return null;
    const row = session.data?.[0];
    if (!row) return null;
    return buildSession(row, sets.data ?? [], prs.data ?? []);
  }, [activeId, session.data, sets.data, prs.data]);
}

/**
 * All workout sessions (active + finished) hydrated with sets + prs. The
 * legacy context exposed `state.sessions` as an unsorted array; we sort
 * DESC by `startedAt` so consumers that take `slice(-3).reverse()` (home
 * screen pattern) still see the latest first AFTER a `.slice(0, 3)`.
 *
 * Performance: this loads ALL sets and ALL prs in two queries, then groups
 * in memory. With ~hundreds of sets per session and N sessions this is
 * O(N+S) per render. If perf becomes an issue, switch to a windowed query
 * + per-session subscription, but that's a Step 5+ concern.
 */
export function useSessions(): WorkoutSession[] {
  const sessionsQ = useLiveQuery(
    db
      .select()
      .from(workoutSessions)
      .where(isNull(workoutSessions.deletedAt))
      .orderBy(asc(workoutSessions.startedAt)),
  );
  const setsQ = useLiveQuery(
    db
      .select()
      .from(completedSets)
      .where(isNull(completedSets.deletedAt))
      .orderBy(asc(completedSets.completedAt)),
  );
  const prsQ = useLiveQuery(
    db.select().from(prRecords).where(isNull(prRecords.deletedAt)),
  );

  return useMemo(() => {
    const setsBySession = new Map<
      string,
      (typeof completedSets.$inferSelect)[]
    >();
    for (const s of setsQ.data ?? []) {
      const arr = setsBySession.get(s.sessionId) ?? [];
      arr.push(s);
      setsBySession.set(s.sessionId, arr);
    }
    const prsBySession = new Map<string, (typeof prRecords.$inferSelect)[]>();
    for (const p of prsQ.data ?? []) {
      const arr = prsBySession.get(p.sessionId) ?? [];
      arr.push(p);
      prsBySession.set(p.sessionId, arr);
    }
    return (sessionsQ.data ?? []).map((row) =>
      buildSession(
        row,
        setsBySession.get(row.id) ?? [],
        prsBySession.get(row.id) ?? [],
      ),
    );
  }, [sessionsQ.data, setsQ.data, prsQ.data]);
}

/**
 * One session by id — hydrated with its sets + prs. Returns null when
 * missing.
 */
export function useSessionById(
  id: string | null | undefined,
): WorkoutSession | null {
  const sessionQ = useMemo(
    () =>
      db
        .select()
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.id, id ?? ""),
            isNull(workoutSessions.deletedAt),
          ),
        )
        .limit(1),
    [id],
  );
  const setsQ = useMemo(
    () =>
      db
        .select()
        .from(completedSets)
        .where(
          and(
            eq(completedSets.sessionId, id ?? ""),
            isNull(completedSets.deletedAt),
          ),
        )
        .orderBy(asc(completedSets.completedAt)),
    [id],
  );
  const prsQ = useMemo(
    () =>
      db
        .select()
        .from(prRecords)
        .where(
          and(eq(prRecords.sessionId, id ?? ""), isNull(prRecords.deletedAt)),
        ),
    [id],
  );

  const session = useLiveQuery(sessionQ, [id]);
  const sets = useLiveQuery(setsQ, [id]);
  const prs = useLiveQuery(prsQ, [id]);

  return useMemo(() => {
    if (!id) return null;
    const row = session.data?.[0];
    if (!row) return null;
    return buildSession(row, sets.data ?? [], prs.data ?? []);
  }, [id, session.data, sets.data, prs.data]);
}

/**
 * Sets from the most recent finished session that contains a non-warmup
 * set for `exerciseId`. Mirrors `getLastSetsForExercise` from the legacy
 * context — used by the active workout screen to pre-fill weight hints.
 *
 * Implementation: subscribe to all finished sessions + all sets, then
 * compute. Cheap unless the user has thousands of sessions.
 */
export function useLastSetsForExercise(
  exerciseId: string | null | undefined,
  beforeSessionId?: string,
): CompletedSet[] {
  const sessionsQ = useLiveQuery(
    db
      .select()
      .from(workoutSessions)
      .where(
        and(
          isNotNull(workoutSessions.endedAt),
          isNull(workoutSessions.deletedAt),
        ),
      )
      .orderBy(desc(workoutSessions.endedAt)),
  );
  const setsQ = useMemo(
    () =>
      db
        .select()
        .from(completedSets)
        .where(
          and(
            eq(completedSets.exerciseId, exerciseId ?? ""),
            eq(completedSets.isWarmup, false),
            isNull(completedSets.deletedAt),
          ),
        ),
    [exerciseId],
  );
  const sets = useLiveQuery(setsQ, [exerciseId]);

  return useMemo(() => {
    if (!exerciseId) return [];
    const setsBySession = new Map<string, CompletedSet[]>();
    for (const s of sets.data ?? []) {
      const arr = setsBySession.get(s.sessionId) ?? [];
      arr.push(rowToSet(s));
      setsBySession.set(s.sessionId, arr);
    }
    for (const session of sessionsQ.data ?? []) {
      if (beforeSessionId && session.id === beforeSessionId) continue;
      const arr = setsBySession.get(session.id);
      if (arr && arr.length > 0) return arr;
    }
    return [];
  }, [exerciseId, beforeSessionId, sessionsQ.data, sets.data]);
}

/**
 * Maximum non-warmup weight ever logged for `exerciseId`. Optionally
 * exclude one session (used by `finishWorkout` to compare against pre-
 * session history).
 */
export function useMaxWeightForExercise(
  exerciseId: string | null | undefined,
  excludeSessionId?: string,
): number {
  const setsQ = useMemo(
    () =>
      db
        .select()
        .from(completedSets)
        .where(
          and(
            eq(completedSets.exerciseId, exerciseId ?? ""),
            eq(completedSets.isWarmup, false),
            isNull(completedSets.deletedAt),
          ),
        ),
    [exerciseId],
  );
  const { data } = useLiveQuery(setsQ, [exerciseId]);
  return useMemo(() => {
    if (!exerciseId) return 0;
    let max = 0;
    for (const s of data ?? []) {
      if (excludeSessionId && s.sessionId === excludeSessionId) continue;
      if (s.weight > max) max = s.weight;
    }
    return max;
  }, [exerciseId, excludeSessionId, data]);
}

/**
 * Streak — consecutive days (ending today) with at least one finished
 * session. DDB-20 calls for SQL but the equivalent JS implementation is
 * trivial against the already-subscribed finished-sessions slice and
 * keeps `useLiveQuery` boundary-clean. We can revisit if profiling
 * surfaces a bottleneck.
 */
export function useStreak(): number {
  const { data } = useLiveQuery(
    db
      .select({ endedAt: workoutSessions.endedAt })
      .from(workoutSessions)
      .where(
        and(
          isNotNull(workoutSessions.endedAt),
          isNull(workoutSessions.deletedAt),
        ),
      ),
  );
  return useMemo(() => {
    const trainedKeys = new Set<string>();
    for (const row of data ?? []) {
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
  }, [data]);
}

/**
 * PR records attached to a specific session. Returned in achievement order
 * (`achievedAt ASC`). Used by `app/workout/summary.tsx`.
 */
export function usePRsForSession(
  sessionId: string | null | undefined,
): PRRecord[] {
  const query = useMemo(
    () =>
      db
        .select()
        .from(prRecords)
        .where(
          and(
            eq(prRecords.sessionId, sessionId ?? ""),
            isNull(prRecords.deletedAt),
          ),
        )
        .orderBy(asc(prRecords.achievedAt)),
    [sessionId],
  );
  const { data } = useLiveQuery(query, [sessionId]);
  return useMemo(() => {
    if (!sessionId) return [];
    return (data ?? []).map(rowToPR);
  }, [data, sessionId]);
}

/**
 * Synthetic `activeWorkoutId` slice — replaces `useIronLog().activeWorkoutId`
 * for screens that only need the id (not the hydrated session).
 */
/**
 * Drafts (kg/reps/rpe autosaved) de los slots no-completados de la sesión
 * activa. Devuelve un Map con clave `${exerciseId}::${setIndex}::${isWarmup}`
 * para lookup O(1) desde el render del SetRow.
 *
 * Si `sessionId` es null/undefined → Map vacío estable (referencia se mantiene
 * mientras `data` no cambie, sirve para `useMemo` deps en el caller).
 */
export interface DraftValues {
  weight?: number;
  reps?: number;
  rpe?: number;
}

function draftKey(
  exerciseId: string,
  setIndex: number,
  isWarmup: boolean,
): string {
  return `${exerciseId}::${setIndex}::${isWarmup ? 1 : 0}`;
}

export function buildDraftKey(
  exerciseId: string,
  setIndex: number,
  isWarmup: boolean,
): string {
  return draftKey(exerciseId, setIndex, isWarmup);
}

export function useDraftsBySession(
  sessionId: string | null | undefined,
): Map<string, DraftValues> {
  const query = useMemo(
    () =>
      db
        .select()
        .from(sessionSetDrafts)
        .where(eq(sessionSetDrafts.sessionId, sessionId ?? "")),
    [sessionId],
  );
  const { data } = useLiveQuery(query, [sessionId]);
  return useMemo(() => {
    const map = new Map<string, DraftValues>();
    if (!sessionId) return map;
    for (const row of data ?? []) {
      map.set(
        draftKey(row.exerciseId, row.setIndex, row.isWarmup),
        {
          weight: row.weight ?? undefined,
          reps: row.reps ?? undefined,
          rpe: row.rpe ?? undefined,
        },
      );
    }
    return map;
  }, [data, sessionId]);
}

export function useActiveWorkoutId(): string | null {
  const { data } = useLiveQuery(
    db
      .select()
      .from(keyValue)
      .where(eq(keyValue.key, "active_workout_id"))
      .limit(1),
  );
  return useMemo<string | null>(() => {
    const row = data?.[0];
    if (!row) return null;
    if (typeof row.value === "string") return row.value;
    if (row.value && typeof row.value === "object" && "id" in row.value) {
      const id = (row.value as { id: unknown }).id;
      return typeof id === "string" ? id : null;
    }
    return null;
  }, [data]);
}
