import { eq, isNull } from "drizzle-orm";
import {
  scheduledRoutines,
  scheduleOverrides,
  sessionPlans,
} from "@workspace/db/schema";
import { z } from "zod";

import { db } from "@/services/db";
import type {
  PlannedExercise,
  ResolvedPlan,
  ScheduledRoutine,
  SessionPlan,
} from "@/types";
import { dateKey, getDayOfWeek } from "@/utils/date";

// ---------------------------------------------------------------------------
// Weekly schedule
// ---------------------------------------------------------------------------

const ScheduledRoutineSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  routineId: z.string().min(1),
  routineDayId: z.string().min(1),
});

/**
 * Upsert a weekly-schedule entry by `dayOfWeek`. PK collision means the
 * day already had an entry; replace it.
 */
export async function scheduleRoutine(
  entry: ScheduledRoutine,
): Promise<void> {
  const validated = ScheduledRoutineSchema.parse(entry);
  const now = new Date();
  await db
    .insert(scheduledRoutines)
    .values({
      dayOfWeek: validated.dayOfWeek,
      routineId: validated.routineId,
      routineDayId: validated.routineDayId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: scheduledRoutines.dayOfWeek,
      set: {
        routineId: validated.routineId,
        routineDayId: validated.routineDayId,
        updatedAt: now,
      },
    });
}

/**
 * Physical delete by `dayOfWeek` — schedule entries are config, not data
 * (cf. db-integration.md §8 list).
 */
export async function unscheduleDay(dayOfWeek: number): Promise<void> {
  z.number().int().min(0).max(6).parse(dayOfWeek);
  await db
    .delete(scheduledRoutines)
    .where(eq(scheduledRoutines.dayOfWeek, dayOfWeek));
}

// ---------------------------------------------------------------------------
// Per-date overrides
// ---------------------------------------------------------------------------

export interface ScheduleOverridePlan {
  routineId: string;
  routineDayId: string;
}

const OverridePlanSchema = z
  .object({
    routineId: z.string().min(1),
    routineDayId: z.string().min(1),
  })
  .nullable();

/**
 * Upsert a per-date override. `plan = null` records an explicit "rest"
 * override on a day that would otherwise resolve to a training session.
 *
 * The overrides table carries `deletedAt` (cf. schema/sqlite/schedule_overrides
 * comment) but the legacy mutator never used it — we preserve that, doing a
 * physical upsert.
 */
export async function setOverrideForDate(
  timestamp: number,
  plan: ScheduleOverridePlan | null,
): Promise<void> {
  const validated = OverridePlanSchema.parse(plan);
  const k = dateKey(timestamp);
  const now = new Date();
  await db
    .insert(scheduleOverrides)
    .values({
      dateKey: k,
      routineId: validated?.routineId ?? null,
      routineDayId: validated?.routineDayId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: scheduleOverrides.dateKey,
      set: {
        routineId: validated?.routineId ?? null,
        routineDayId: validated?.routineDayId ?? null,
        updatedAt: now,
        deletedAt: null,
      },
    });
}

/**
 * Physical delete by date — overrides are config (cf. §8 list).
 */
export async function clearOverrideForDate(
  timestamp: number,
): Promise<void> {
  const k = dateKey(timestamp);
  await db.delete(scheduleOverrides).where(eq(scheduleOverrides.dateKey, k));
}

/**
 * Swap the resolved plans of two dates by writing overrides on both.
 * Resolves each side from the CURRENT schedule + overrides snapshot inside
 * a single transaction — guarantees the two writes are consistent (no
 * stale read between them).
 *
 * Mirrors the legacy logic in `IronLogContext.swapDates`.
 */
export async function swapDates(
  timestampA: number,
  timestampB: number,
): Promise<void> {
  if (dateKey(timestampA) === dateKey(timestampB)) return;
  const kA = dateKey(timestampA);
  const kB = dateKey(timestampB);
  const now = new Date();

  await db.transaction(async (tx) => {
    const overrides = await tx
      .select()
      .from(scheduleOverrides)
      .where(isNull(scheduleOverrides.deletedAt))
      .all();
    const schedule = await tx.select().from(scheduledRoutines).all();

    const resolve = (ts: number): ResolvedPlan => {
      const k = dateKey(ts);
      const ov = overrides.find((o) => o.dateKey === k);
      if (ov) {
        if (ov.routineId && ov.routineDayId) {
          return {
            kind: "training",
            routineId: ov.routineId,
            routineDayId: ov.routineDayId,
            isOverride: true,
          };
        }
        return { kind: "rest", isOverride: true };
      }
      const dow = getDayOfWeek(ts);
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
    };

    const planA = resolve(timestampA);
    const planB = resolve(timestampB);

    const writePlan = async (
      k: string,
      plan: ResolvedPlan,
    ): Promise<void> => {
      const routineId = plan.kind === "training" ? plan.routineId : null;
      const routineDayId =
        plan.kind === "training" ? plan.routineDayId : null;
      await tx
        .insert(scheduleOverrides)
        .values({
          dateKey: k,
          routineId,
          routineDayId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: scheduleOverrides.dateKey,
          set: {
            routineId,
            routineDayId,
            updatedAt: now,
            deletedAt: null,
          },
        });
    };

    // A receives B's resolved plan, B receives A's resolved plan.
    await writePlan(kA, planB);
    await writePlan(kB, planA);
  });
}

// ---------------------------------------------------------------------------
// Per-date session plans (DDB-11)
// ---------------------------------------------------------------------------

const PlannedSetSchema = z.object({
  weight: z.number().min(0).optional(),
  reps: z.number().int().min(0).optional(),
  rpe: z.number().min(0).max(10).optional(),
  isWarmup: z.boolean(),
});

const PlannedExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.array(PlannedSetSchema),
  notes: z.string().optional(),
});

const PlannedExercisesSchema: z.ZodType<PlannedExercise[]> = z.array(
  PlannedExerciseSchema,
);

const SessionPlanInputSchema = z.object({
  dateKey: z.string().min(1),
  routineId: z.string().min(1),
  routineDayId: z.string().min(1),
  exercises: PlannedExercisesSchema,
});

/**
 * Upsert a session plan by `dateKey`. JSON `exercises` is validated via Zod
 * BEFORE insert (DDB-11 — `mode: "json"` only serializes, never validates).
 */
export async function upsertSessionPlan(
  plan: Omit<SessionPlan, "updatedAt">,
): Promise<void> {
  const validated = SessionPlanInputSchema.parse(plan);
  const now = new Date();
  await db
    .insert(sessionPlans)
    .values({
      dateKey: validated.dateKey,
      routineId: validated.routineId,
      routineDayId: validated.routineDayId,
      exercises: validated.exercises,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: sessionPlans.dateKey,
      set: {
        routineId: validated.routineId,
        routineDayId: validated.routineDayId,
        exercises: validated.exercises,
        updatedAt: now,
      },
    });
}

/**
 * Physical delete by `dateKey`. Session plans are derived configuration
 * (no historical value once the date passes).
 */
export async function deleteSessionPlan(date: string): Promise<void> {
  z.string().min(1).parse(date);
  await db.delete(sessionPlans).where(eq(sessionPlans.dateKey, date));
}
