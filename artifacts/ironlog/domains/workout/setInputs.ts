/**
 * Pure helpers behind the active-workout set row.
 *
 * The row seeds its text inputs once, on mount. The screen therefore renders
 * rows only after the plan and the drafts are loaded and computes the initial
 * strings here, instead of patching the inputs afterwards from effects.
 */

import { clampNumber, parseDecimal, parseWholeNumber } from "@/utils/parseNumber";

export interface SetInputValues {
  weight?: number;
  reps?: number;
  rpe?: number;
}

export interface ResolveSetInputsArgs {
  /** The logged set occupying this slot (read-only row). */
  completed?: SetInputValues;
  /** Autosaved, not-yet-completed inputs of this slot. */
  draft?: SetInputValues;
  /**
   * Target values from the session plan. Only weight and reps are used: a
   * legacy stored plan may still carry an `rpe`, which is ignored (RPE is
   * recorded after the set, never planned).
   */
  planned?: SetInputValues;
  /** Same slot in the previous session (weight and reps only). */
  previous?: Pick<SetInputValues, "weight" | "reps">;
  isWarmup: boolean;
}

export interface SetInputStrings {
  weight: string;
  reps: string;
  rpe: string;
}

function firstDefined(...values: (number | undefined | null)[]): string {
  for (const v of values) {
    if (v != null) return String(v);
  }
  return "";
}

/**
 * Initial text of the weight / reps / RPE inputs.
 *
 * - Incomplete set, per field: draft > plan > previous session. RPE comes only
 *   from the draft: it is recorded after the set, never planned.
 * - Completed set: only what was logged, so a plan RPE is never shown as if it
 *   had been recorded.
 * - Warm-ups have no RPE input, so their RPE is always empty.
 */
export function resolveSetInputs(args: ResolveSetInputsArgs): SetInputStrings {
  const { completed, draft, planned, previous, isWarmup } = args;
  if (completed) {
    return {
      weight: firstDefined(completed.weight),
      reps: firstDefined(completed.reps),
      rpe: isWarmup ? "" : firstDefined(completed.rpe),
    };
  }
  return {
    weight: firstDefined(draft?.weight, planned?.weight, previous?.weight),
    reps: firstDefined(draft?.reps, planned?.reps, previous?.reps),
    rpe: isWarmup ? "" : firstDefined(draft?.rpe),
  };
}

export const RPE_MIN = 0;
export const RPE_MAX = 10;

/** RPE text to a number clamped to the 0..10 scale (blank/garbage → null). */
export function parseRpe(text: string): number | null {
  const n = parseDecimal(text);
  return n == null ? null : clampNumber(n, RPE_MIN, RPE_MAX);
}

/** Weight text to a non-negative number (blank/garbage → null). */
export function parseWeight(text: string): number | null {
  const n = parseDecimal(text);
  return n == null ? null : Math.max(0, n);
}

export interface ParsedDraftPatch {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
}

/** Input strings to the shape the draft mutator stores (blank/NaN → null). */
export function parseDraftPatch(
  weight: string,
  reps: string,
  rpe: string,
): ParsedDraftPatch {
  return {
    weight: parseWeight(weight),
    reps: parseWholeNumber(reps),
    rpe: parseRpe(rpe),
  };
}

/**
 * Values to log when the user taps the check, or `null` when the row is not a
 * valid set yet (no reps). A rejected completion must leave the row's pending
 * draft alone: it is still unfinished input.
 */
export function parseCompletion(
  weight: string,
  reps: string,
  rpe: string,
): { weight: number; reps: number; rpe: number | undefined } | null {
  const r = parseWholeNumber(reps) ?? 0;
  if (r === 0) return null;
  return {
    weight: parseWeight(weight) ?? 0,
    reps: r,
    rpe: parseRpe(rpe) ?? undefined,
  };
}
