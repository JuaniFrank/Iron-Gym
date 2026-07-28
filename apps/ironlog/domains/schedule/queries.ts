import { and, asc, eq, isNull } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  scheduledRoutines,
  scheduleOverrides,
  sessionPlans,
} from "@workspace/db/schema";
import { useMemo } from "react";

import { db } from "@/services/db";
import type {
  ResolvedPlan,
  ScheduledRoutine,
  ScheduleOverride,
  SessionPlan,
} from "@/types";
import { dateKey, getDayOfWeek } from "@/utils/date";

function rowToScheduled(
  row: typeof scheduledRoutines.$inferSelect,
): ScheduledRoutine {
  return {
    dayOfWeek: row.dayOfWeek,
    routineId: row.routineId,
    routineDayId: row.routineDayId,
  };
}

function rowToOverride(
  row: typeof scheduleOverrides.$inferSelect,
): ScheduleOverride {
  return {
    dateKey: row.dateKey,
    routineId: row.routineId,
    routineDayId: row.routineDayId,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
  };
}

function rowToPlan(row: typeof sessionPlans.$inferSelect): SessionPlan {
  return {
    dateKey: row.dateKey,
    routineId: row.routineId,
    routineDayId: row.routineDayId,
    exercises: row.exercises,
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt.getTime() : row.updatedAt,
  };
}

/**
 * Weekly schedule. PK is `day_of_week` (1..7) so the row count is bounded.
 * No soft-delete column on this table — `unscheduleDay` deletes physically
 * (cf. db-integration.md §8).
 */
export function useSchedule(): ScheduledRoutine[] {
  const { data } = useLiveQuery(
    db.select().from(scheduledRoutines).orderBy(asc(scheduledRoutines.dayOfWeek)),
  );
  return useMemo(() => (data ?? []).map(rowToScheduled), [data]);
}

/**
 * All non-deleted overrides. Schema does carry `deletedAt` (mutator
 * sometimes soft-deletes from `swapDates`); filter at this layer so
 * consumers don't see ghost rows.
 */
export function useScheduleOverrides(): ScheduleOverride[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(scheduleOverrides)
      .where(isNull(scheduleOverrides.deletedAt)),
  );
  return useMemo(() => (data ?? []).map(rowToOverride), [data]);
}

/**
 * Per-date `SessionPlan`. The legacy `getSessionPlan(dateKey, routineId?,
 * routineDayId?)` returns `undefined` when the plan exists but its routine
 * + day mismatch the caller's pinned context (used to ignore stale plans
 * after a swap). We replicate that here.
 */
export function useSessionPlan(
  date: string | null | undefined,
  routineId?: string,
  routineDayId?: string,
): SessionPlan | null {
  const query = useMemo(
    () =>
      db
        .select()
        .from(sessionPlans)
        .where(eq(sessionPlans.dateKey, date ?? ""))
        .limit(1),
    [date],
  );
  const { data } = useLiveQuery(query, [date]);
  return useMemo(() => {
    if (!date) return null;
    const row = data?.[0];
    if (!row) return null;
    if (routineId && row.routineId !== routineId) return null;
    if (routineDayId && row.routineDayId !== routineDayId) return null;
    return rowToPlan(row);
  }, [data, date, routineId, routineDayId]);
}

/**
 * Resolves the plan for a given calendar date: override > weekly schedule
 * > rest. Mirror of legacy `getPlanForDate(timestamp)`. Subscribes to both
 * tables so writes on either side surface here.
 */
export function usePlanForDate(timestamp: number): ResolvedPlan {
  const overrides = useScheduleOverrides();
  const schedule = useSchedule();
  return useMemo<ResolvedPlan>(() => {
    const k = dateKey(timestamp);
    const override = overrides.find((o) => o.dateKey === k);
    if (override) {
      if (override.routineId && override.routineDayId) {
        return {
          kind: "training",
          routineId: override.routineId,
          routineDayId: override.routineDayId,
          isOverride: true,
        };
      }
      return { kind: "rest", isOverride: true };
    }
    const dow = getDayOfWeek(timestamp);
    const sched = schedule.find((s) => s.dayOfWeek === dow);
    if (sched) {
      return {
        kind: "training",
        routineId: sched.routineId,
        routineDayId: sched.routineDayId,
        isOverride: false,
      };
    }
    return { kind: "rest", isOverride: false };
  }, [timestamp, overrides, schedule]);
}

export interface NextTrainingDay {
  timestamp: number;
  dateKey: string;
  routineId: string;
  routineDayId: string;
  isToday: boolean;
}

/**
 * First training day in the calendar window
 * `[startOffsetDays, startOffsetDays + daysAhead)`. Defaults: today + 14d
 * window. Returns `null` if no training day is found.
 *
 * Mirrors the legacy `getNextTrainingDay` — same window semantics, same
 * resolution rules.
 */
export function useNextTrainingDay(
  opts: { daysAhead?: number; startOffsetDays?: number } = {},
): NextTrainingDay | null {
  const { daysAhead = 14, startOffsetDays = 0 } = opts;
  const overrides = useScheduleOverrides();
  const schedule = useSchedule();
  return useMemo<NextTrainingDay | null>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = startOffsetDays; i < startOffsetDays + daysAhead; i += 1) {
      const cursor = new Date(today);
      cursor.setDate(cursor.getDate() + i);
      const ts = cursor.getTime();
      const k = dateKey(ts);
      const ov = overrides.find((o) => o.dateKey === k);
      let routineId: string | null = null;
      let routineDayId: string | null = null;
      if (ov) {
        routineId = ov.routineId;
        routineDayId = ov.routineDayId;
      } else {
        const dow = getDayOfWeek(ts);
        const sched = schedule.find((s) => s.dayOfWeek === dow);
        if (sched) {
          routineId = sched.routineId;
          routineDayId = sched.routineDayId;
        }
      }
      if (routineId && routineDayId) {
        return {
          timestamp: ts,
          dateKey: k,
          routineId,
          routineDayId,
          isToday: i === 0,
        };
      }
    }
    return null;
  }, [overrides, schedule, daysAhead, startOffsetDays]);
}

/**
 * Imperative helper for consumers that need to resolve a plan inside a
 * computation (`useMemo`) where calling `usePlanForDate` for every
 * candidate isn't ergonomic. Receives pre-fetched `overrides` and
 * `schedule` slices. Pure — no DB access, no React.
 */
export function resolvePlanFor(
  timestamp: number,
  overrides: readonly ScheduleOverride[],
  schedule: readonly ScheduledRoutine[],
): ResolvedPlan {
  const k = dateKey(timestamp);
  const override = overrides.find((o) => o.dateKey === k);
  if (override) {
    if (override.routineId && override.routineDayId) {
      return {
        kind: "training",
        routineId: override.routineId,
        routineDayId: override.routineDayId,
        isOverride: true,
      };
    }
    return { kind: "rest", isOverride: true };
  }
  const dow = getDayOfWeek(timestamp);
  const sched = schedule.find((s) => s.dayOfWeek === dow);
  if (sched) {
    return {
      kind: "training",
      routineId: sched.routineId,
      routineDayId: sched.routineDayId,
      isOverride: false,
    };
  }
  return { kind: "rest", isOverride: false };
}
