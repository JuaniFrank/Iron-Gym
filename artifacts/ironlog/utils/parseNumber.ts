/**
 * Locale-safe parsing of numeric text inputs.
 *
 * iOS decimal pads follow the device region (es-AR types "22,5"), and
 * `parseFloat("22,5")` silently yields 22. Every free-text numeric field goes
 * through these helpers instead of calling `parseFloat` / `parseInt` directly.
 */

/** Decimal text ("22.5" or "22,5") to a finite number; blank/garbage → null. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "") return null;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Whole-number text to an integer (a fractional part is dropped); else null. */
export function parseWholeNumber(text: string): number | null {
  const n = parseInt(text.trim().replace(",", "."), 10);
  return Number.isFinite(n) ? n : null;
}

/** Constrain `n` to `[min, max]`. */
export function clampNumber(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** `parseDecimal` for quantities that cannot be negative (clamped to 0). */
export function parseNonNegativeDecimal(text: string): number | null {
  const n = parseDecimal(text);
  return n == null ? null : Math.max(0, n);
}

/** `parseWholeNumber` for quantities that cannot be negative (clamped to 0). */
export function parseNonNegativeWhole(text: string): number | null {
  const n = parseWholeNumber(text);
  return n == null ? null : Math.max(0, n);
}
