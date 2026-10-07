/**
 * Pure loading decisions for the active workout session.
 *
 * `undefined` always means "still loading" and `null` means "loaded, and there
 * is none", so a screen never shows "no active session" while data is on its
 * way.
 */

export type ActiveSessionPhase = "loading" | "none" | "ready";

export function resolveActiveSessionPhase(args: {
  /** The `key_value.active_workout_id` query delivered its first result. */
  activeIdLoaded: boolean;
  activeId: string | null;
  /** Session, sets and prs queries delivered a result for `activeId`. */
  dataLoaded: boolean;
  /** Id of the session row the query returned (`undefined` = no row). */
  sessionRowId: string | undefined;
}): ActiveSessionPhase {
  if (!args.activeIdLoaded) return "loading";
  if (!args.activeId) return "none";
  if (!args.dataLoaded) return "loading";
  if (args.sessionRowId === undefined) return "none";
  // A row of a previous active id (a live query keeps its stale data until the
  // new result lands) must never be exposed as the current session.
  if (args.sessionRowId !== args.activeId) return "loading";
  return "ready";
}

export type ActiveScreenView = "loading" | "empty" | "session";

/**
 * `startPending`: the screen was opened with routine/day params and the
 * workout it asked to start has not shown up (or failed) yet.
 */
export function activeScreenView(args: {
  session: object | null | undefined;
  startPending: boolean;
}): ActiveScreenView {
  if (args.session) return "session";
  if (args.session === undefined || args.startPending) return "loading";
  return "empty";
}
