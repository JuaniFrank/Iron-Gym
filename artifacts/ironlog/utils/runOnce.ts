/**
 * Runs `action` unless a previous call is in flight or already succeeded
 * (`flag` is the lock). Meant for "pick and leave" handlers where a double tap
 * would repeat the side effect while the first call is still awaiting; the
 * lock is released only when the action fails, so the user can try again.
 */
export async function runOnce(
  flag: { current: boolean },
  action: () => Promise<void>,
): Promise<void> {
  if (flag.current) return;
  flag.current = true;
  try {
    await action();
  } catch (error) {
    flag.current = false;
    throw error;
  }
}
