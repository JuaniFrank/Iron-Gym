/**
 * Pure helpers behind the active-workout set row.
 *
 * The row seeds its text inputs once, on mount. The screen therefore renders
 * rows only after the plan and the drafts are loaded and computes the initial
 * strings here, instead of patching the inputs afterwards from effects.
 */

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
  /** Target values from the session plan. */
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
 * - Incomplete set, per field: draft > plan > previous session (RPE has no
 *   "previous").
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
    rpe: isWarmup ? "" : firstDefined(draft?.rpe, planned?.rpe),
  };
}

export interface ParsedDraftPatch {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
}

function finiteOrNull(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}

/** Input strings to the shape the draft mutator stores (blank/NaN → null). */
export function parseDraftPatch(
  weight: string,
  reps: string,
  rpe: string,
): ParsedDraftPatch {
  return {
    weight: finiteOrNull(parseFloat(weight)),
    reps: finiteOrNull(parseInt(reps, 10)),
    rpe: finiteOrNull(parseFloat(rpe)),
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
  const r = parseInt(reps, 10) || 0;
  if (r === 0) return null;
  return {
    weight: parseFloat(weight) || 0,
    reps: r,
    rpe: rpe ? parseFloat(rpe) : undefined,
  };
}
