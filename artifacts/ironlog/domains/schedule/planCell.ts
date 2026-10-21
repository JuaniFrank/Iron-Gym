/**
 * Pure rules behind the plan screen's numeric cells (weight / reps).
 *
 * The cell keeps its own draft text so half-typed input ("22.", "22,") is not
 * rewritten while the user is typing; the stored value only changes when the
 * text parses to a number.
 */

import { parseDecimal, parseWholeNumber } from "@/utils/parseNumber";

export type PlanCellKind = "weight" | "reps";

/** Text to number as typed, before range rules: blank → undefined, garbage → null. */
function parseRaw(text: string, kind: PlanCellKind): number | undefined | null {
  if (text.trim() === "") return undefined;
  return kind === "reps" ? parseWholeNumber(text) : parseDecimal(text);
}

/**
 * Value to store for the cell text. `undefined` clears the value, `null` means
 * "not a number (yet)": keep the previous value. Weight and reps are
 * clamped to >= 0.
 */
export function parsePlanCell(
  text: string,
  kind: PlanCellKind,
): number | undefined | null {
  const raw = parseRaw(text, kind);
  if (raw == null) return raw;
  return Math.max(0, raw);
}

/** Text to show after an edit: only rewritten when the stored value was clamped. */
export function normalizeCellText(text: string, kind: PlanCellKind): string {
  const raw = parseRaw(text, kind);
  const stored = parsePlanCell(text, kind);
  if (raw == null || stored == null || raw === stored) return text;
  return String(stored);
}

/**
 * True when the cell text no longer means `value` (the value was changed from
 * outside, e.g. autofill or a bulk edit) and must be re-rendered from it.
 * "22." still means 22, so a trailing separator is never eaten.
 */
export function isCellTextStale(
  text: string,
  value: number | undefined,
  kind: PlanCellKind,
): boolean {
  return parseRaw(text, kind) !== value;
}

export function cellTextForValue(value: number | undefined): string {
  return value != null ? String(value) : "";
}
