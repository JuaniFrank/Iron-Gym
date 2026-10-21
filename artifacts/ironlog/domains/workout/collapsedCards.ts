/**
 * Pure helpers for the collapsed exercise cards of the active workout.
 *
 * The set of collapsed exercise ids is kept per session in the local-only
 * `key_value` table (never synced) as a JSON array of ids, so the cards stay
 * collapsed when the user leaves the workout screen and comes back.
 */

export type CollapsedByExercise = Record<string, boolean>;

export function collapsedKey(sessionId: string): string {
  return `workout_collapsed:${sessionId}`;
}

/** Stored JSON value to a lookup; anything unexpected means "nothing collapsed". */
export function parseCollapsed(value: unknown): CollapsedByExercise {
  const out: CollapsedByExercise = {};
  if (!Array.isArray(value)) return out;
  for (const id of value) {
    if (typeof id === "string" && id !== "") out[id] = true;
  }
  return out;
}

/** Lookup to the stored id list (only collapsed ids, sorted). */
export function serializeCollapsed(collapsed: CollapsedByExercise): string[] {
  return Object.keys(collapsed)
    .filter((id) => collapsed[id])
    .sort();
}

export function withCollapsed(
  collapsed: CollapsedByExercise,
  exerciseId: string,
  isCollapsed: boolean,
): CollapsedByExercise {
  const next = { ...collapsed };
  if (isCollapsed) next[exerciseId] = true;
  else delete next[exerciseId];
  return next;
}

/**
 * Collapsed state for the screen from a keyed live query result: `undefined`
 * only while still loading. A failed query or a missing row resolves to "none
 * collapsed" so the workout screen is never blocked by this local-only state.
 */
export function resolveCollapsed(args: {
  loaded: boolean;
  data: { value: unknown }[] | undefined;
  error: unknown;
}): CollapsedByExercise | undefined {
  if (args.loaded) return parseCollapsed(args.data?.[0]?.value);
  if (args.error != null) return {};
  return undefined;
}
