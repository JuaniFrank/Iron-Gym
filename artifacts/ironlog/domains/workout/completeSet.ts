/**
 * Sequencing behind the active-workout check button: the rest timer may only
 * start once the set is really saved. A rejected save (validation, DB error)
 * must surface to the user instead of being swallowed while the timer runs as
 * if the set had been logged. A slot already being saved ignores further taps
 * (double tap = one set, one rest timer).
 */

export type SaveSetResult =
  | { ok: true }
  | { ok: false; error: unknown }
  | { ok: false; skipped: true };

export async function saveSetThenRest(args: {
  save: () => Promise<void>;
  isWarmup: boolean;
  startRest: () => void;
  /** Slots currently being saved; shared by every row of the screen. */
  inFlight?: Set<string>;
  /** Identifies the slot in `inFlight`. */
  key?: string;
}): Promise<SaveSetResult> {
  const { inFlight, key } = args;
  if (inFlight && key !== undefined) {
    if (inFlight.has(key)) return { ok: false, skipped: true };
    inFlight.add(key);
  }
  try {
    await args.save();
  } catch (error) {
    return { ok: false, error };
  } finally {
    if (inFlight && key !== undefined) inFlight.delete(key);
  }
  if (!args.isWarmup) args.startRest();
  return { ok: true };
}
