/**
 * Pure arithmetic of the rest timer. The countdown is always derived from an
 * absolute `endsAt` timestamp (never from a decremented counter), so time spent
 * in background counts and a re-render can never drift the display.
 */

/** Milliseconds left, never negative. */
export function remainingMs(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

/** Whole seconds left, rounded up (0:01 until the very end), floor 0. */
export function remainingSeconds(endsAt: number, now: number): number {
  return Math.ceil(remainingMs(endsAt, now) / 1000);
}

/** No whole second is left. */
export function isFinished(endsAt: number, now: number): boolean {
  return remainingSeconds(endsAt, now) === 0;
}

/** The clock the display reads: frozen at the pause snapshot while paused. */
export function effectiveNow(pausedAt: number | null, now: number): number {
  return pausedAt ?? now;
}

/** New end after resuming: shifted by the time that was spent paused. */
export function resumeEndsAt(endsAt: number, pausedAt: number, now: number): number {
  return endsAt + Math.max(0, now - pausedAt);
}

/**
 * New end after a ±N seconds adjustment.
 *
 * The result never lands before the floor (`pausedAt` while paused, `now`
 * otherwise), so -15 ends the rest instead of going into the past. When the end
 * is already behind the floor (the timer finished) the adjustment starts from
 * the floor: +15 after reaching 0 gives a fresh 15 seconds from now.
 */
export function adjustEndsAt(args: {
  endsAt: number;
  deltaSec: number;
  pausedAt: number | null;
  now: number;
}): number {
  const floor = args.pausedAt ?? args.now;
  const base = Math.max(args.endsAt, floor);
  return Math.max(floor, base + args.deltaSec * 1000);
}

/** Remaining fraction of the original duration, clamped to 0..1. */
export function progress(remainingMillis: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.max(0, Math.min(1, remainingMillis / (durationSeconds * 1000)));
}

/**
 * Timer to start after a set, or `null` when there is no rest to take (a 0 s
 * rest means "no rest"; a timer started at 0 would just sit at 0:00).
 */
export function planRestStart(
  seconds: number,
  now: number,
): { endsAt: number; durationSeconds: number } | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return { endsAt: now + seconds * 1000, durationSeconds: seconds };
}
