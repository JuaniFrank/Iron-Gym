// Schedule · rules of the "day swap" sheet (pure, no React / DB).
//
// The sheet shows the current Mon-Sun week. Everything it decides lives here so
// it can be tested without a renderer: the status of each day, which days can
// be dragged / dropped on / picked, which actions a tap offers, and which
// schedule mutation each interaction maps to.
//
// Invariants:
// - Past days are immutable history: never a drag source, a drop target, a
//   picker target or the subject of skip / reset.
// - A completed day (a finished session exists for that date) is never a
//   target and never moved.
// - "Moving" training to another day is always `swapDates` (so the source ends
//   up with the target's plan), except from a missed PAST day, which only
//   writes an override on the destination.

import type { ResolvedPlan } from "@/types";
import { dateKey, getDayOfWeek } from "@/utils/date";

export type DayStatus =
  | "today" //      today + training pending
  | "todayRest" //  today + rest (natural or override)
  | "completed" //  a session finished on that date
  | "missed" //     past + training + no finished session
  | "skipped" //    rest override on a day that is not today
  | "rest" //       natural rest
  | "scheduled"; // future + training

export interface DayInfo {
  ts: number;
  /** Position inside the week (0 = Monday). */
  index: number;
  plan: ResolvedPlan;
  status: DayStatus;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
  /** Can be picked up and dragged elsewhere (today/future training, not completed). */
  draggable: boolean;
  /** Can receive a drop (today/future, not completed). The source is excluded separately. */
  droppable: boolean;
}

export interface OverridePlan {
  routineId: string;
  routineDayId: string;
}

/** The one schedule mutation an interaction maps to. */
export type DayMutation =
  | { kind: "swap"; fromTs: number; toTs: number }
  | { kind: "setOverride"; ts: number; plan: OverridePlan | null }
  | { kind: "clearOverride"; ts: number };

export type DayAction =
  | "start"
  | "reschedule"
  | "skip"
  | "makeToday"
  | "cancelSkip"
  | "resetOriginal";

export type PickerReason = "source" | "past" | "completed" | "occupied";

export interface PickerTargetState {
  enabled: boolean;
  reason: PickerReason | null;
}

/** Monday..Sunday (local midnight timestamps) of the week containing `todayTs`. */
export function weekDatesFor(todayTs: number): number[] {
  const monday = new Date(todayTs);
  monday.setDate(monday.getDate() - getDayOfWeek(todayTs));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.getTime();
  });
}

export function deriveDayStatus(args: {
  ts: number;
  todayTs: number;
  plan: ResolvedPlan;
  hasFinishedSession: boolean;
}): DayStatus {
  const { ts, todayTs, plan, hasFinishedSession } = args;
  if (hasFinishedSession) return "completed";
  if (ts === todayTs) return plan.kind === "training" ? "today" : "todayRest";
  if (plan.kind === "rest") return plan.isOverride ? "skipped" : "rest";
  return ts < todayTs ? "missed" : "scheduled";
}

/**
 * `finishedAt`: `endedAt` timestamps of the finished sessions (any date); the
 * ones landing on a date of the week mark it as completed.
 */
export function buildWeekDays(args: {
  todayTs: number;
  planFor: (ts: number) => ResolvedPlan;
  finishedAt: readonly number[];
}): DayInfo[] {
  const { todayTs, planFor, finishedAt } = args;
  const finishedKeys = new Set(finishedAt.map((t) => dateKey(t)));
  return weekDatesFor(todayTs).map((ts, index) => {
    const plan = planFor(ts);
    const isPast = ts < todayTs;
    const isToday = ts === todayTs;
    const status = deriveDayStatus({
      ts,
      todayTs,
      plan,
      hasFinishedSession: finishedKeys.has(dateKey(ts)),
    });
    const editable = !isPast && status !== "completed";
    return {
      ts,
      index,
      plan,
      status,
      isPast,
      isToday,
      isFuture: ts > todayTs,
      draggable: editable && plan.kind === "training",
      droppable: editable,
    };
  });
}

export function isValidDropTarget(
  target: DayInfo,
  sourceTs: number,
  todayTs: number,
): boolean {
  if (target.ts === sourceTs) return false;
  if (target.ts < todayTs) return false;
  if (target.status === "completed") return false;
  return true;
}

/** Picker (move to a free day): only rest days that are today/future and not completed. */
export function pickerTargetState(
  target: DayInfo,
  sourceTs: number,
  todayTs: number,
): PickerTargetState {
  if (target.ts === sourceTs) return { enabled: false, reason: "source" };
  if (target.ts < todayTs) return { enabled: false, reason: "past" };
  if (target.status === "completed") return { enabled: false, reason: "completed" };
  if (target.plan.kind === "training") return { enabled: false, reason: "occupied" };
  return { enabled: true, reason: null };
}

function planOf(day: DayInfo): OverridePlan | null {
  return day.plan.kind === "training"
    ? { routineId: day.plan.routineId, routineDayId: day.plan.routineDayId }
    : null;
}

/** Drag & drop: swap the source with any valid target (training, rest or skipped). */
export function dropMutation(
  from: DayInfo,
  to: DayInfo,
  todayTs: number,
): DayMutation | null {
  if (!from.draggable) return null;
  if (!isValidDropTarget(to, from.ts, todayTs)) return null;
  return { kind: "swap", fromTs: from.ts, toTs: to.ts };
}

/** Picker: move training to a free day. Missed past days never get rewritten. */
export function rescheduleMutation(
  from: DayInfo,
  to: DayInfo,
  todayTs: number,
): DayMutation | null {
  const plan = planOf(from);
  if (!plan) return null;
  if (from.status === "completed") return null;
  if (!pickerTargetState(to, from.ts, todayTs).enabled) return null;
  if (from.isPast) return { kind: "setOverride", ts: to.ts, plan };
  return { kind: "swap", fromTs: from.ts, toTs: to.ts };
}

/** Skip a pending training day (today / future): explicit rest override. */
export function skipMutation(day: DayInfo): DayMutation | null {
  if (day.status !== "today" && day.status !== "scheduled") return null;
  return { kind: "setOverride", ts: day.ts, plan: null };
}

/** Drop the override of a date (cancel a skip / restore the original plan). */
export function resetMutation(day: DayInfo): DayMutation {
  return { kind: "clearOverride", ts: day.ts };
}

/** "Hacer hoy" from a missed day: override TODAY with that plan; the past is untouched. */
export function makeTodayMutation(
  source: DayInfo,
  todayTs: number,
): DayMutation | null {
  if (source.status !== "missed") return null;
  const plan = planOf(source);
  if (!plan) return null;
  return { kind: "setOverride", ts: todayTs, plan };
}

/** Actions offered by tapping a day, in display order. Empty = tap does nothing. */
export function availableActions(day: DayInfo): DayAction[] {
  const actions: DayAction[] = [];
  switch (day.status) {
    case "today":
      actions.push("start", "reschedule", "skip");
      break;
    case "scheduled":
      actions.push("reschedule", "skip");
      break;
    case "missed":
      actions.push("makeToday", "reschedule");
      break;
    case "skipped":
      actions.push("cancelSkip");
      break;
    default:
      break;
  }
  if (
    day.plan.kind === "training" &&
    day.plan.isOverride &&
    !day.isPast &&
    day.status !== "completed"
  ) {
    actions.push("resetOriginal");
  }
  return actions;
}

/**
 * Row under the finger while dragging, from the vertical translation. Runs on
 * the UI thread inside gesture worklets, hence the directive.
 */
export function dropIndexFor(
  sourceIndex: number,
  translationY: number,
  rowPitch: number,
  count: number,
): number {
  "worklet";
  if (!(rowPitch > 0)) return sourceIndex;
  const candidate = sourceIndex + Math.round(translationY / rowPitch);
  return Math.max(0, Math.min(count - 1, candidate));
}
