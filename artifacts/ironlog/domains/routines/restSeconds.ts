/** Pure helpers for rest durations (seconds). */

/**
 * Positive integer seconds from a stored/untrusted value, else `null`.
 * Accepts numbers and plain numeric strings (legacy rows stored text);
 * rejects zero, negatives, NaN/Infinity, decimals and garbage.
 */
export function parseRestSeconds(value: unknown): number | null {
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string" && /^\s*\d+\s*$/.test(value)) {
    n = Number(value.trim());
  } else {
    return null;
  }
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** 45 -> "45s", 90 -> "1:30", 180 -> "3m". */
export function formatRestSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  if (sec === 0) return `${min}m`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}
