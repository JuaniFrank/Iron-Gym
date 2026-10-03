import type { DraftAction } from "./draft";

/**
 * Tiny in-memory registry that lets a pushed screen (the exercise picker)
 * send actions to a routine draft owned by an earlier screen
 * (ironlog-routine-draft-editor T3). Not persisted, no subscriptions: the
 * owner registers its `dispatch` under a `draftKey` route param.
 */
type Dispatch = (action: DraftAction) => void;

const drafts = new Map<string, Dispatch>();

export function registerDraft(key: string, dispatch: Dispatch): void {
  drafts.set(key, dispatch);
}

/** Only removes the registration if it still belongs to `dispatch` (remount safe). */
export function unregisterDraft(key: string, dispatch: Dispatch): void {
  if (drafts.get(key) === dispatch) drafts.delete(key);
}

/** Returns whether a registered draft received the action. */
export function dispatchToDraft(key: string, action: DraftAction): boolean {
  const dispatch = drafts.get(key);
  if (!dispatch) return false;
  dispatch(action);
  return true;
}
