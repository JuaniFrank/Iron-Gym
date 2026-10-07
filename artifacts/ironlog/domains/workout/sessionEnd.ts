/**
 * Runs `action` (finish / discard the session) with `flag` raised for its
 * whole duration, so autosaves of set drafts stop BEFORE the session closes
 * instead of racing it. If the action fails the flag is lowered again: the
 * session is still open and its drafts must keep saving.
 */
export async function withSessionEnding<T>(
  flag: { current: boolean },
  action: () => Promise<T>,
): Promise<T> {
  flag.current = true;
  try {
    return await action();
  } catch (error) {
    flag.current = false;
    throw error;
  }
}
