// Sync scheduling, kept free of React and platform APIs so it is unit-testable
// with fake timers: the event sources are injected (see SyncProvider.tsx for
// the AppState / visibilitychange / expo-sqlite adapters).
//
// Triggers while running: immediately on start (sign-in), on foreground,
// debounced after local writes, and on a fixed interval. `syncNow` is the
// engine's single-flight entry point, so overlapping triggers coalesce.

export const DEFAULT_DEBOUNCE_MS = 2000;
export const DEFAULT_INTERVAL_MS = 60_000;

export type SyncTriggerOptions = {
  syncNow: () => unknown;
  /** Subscribe to "app became active/visible". Returns an unsubscribe. */
  subscribeForeground: (cb: () => void) => () => void;
  /** Subscribe to "local data changed". Returns an unsubscribe. */
  subscribeLocalWrites: (cb: () => void) => () => void;
  debounceMs?: number;
  intervalMs?: number;
};

/** Start all triggers; returns a stop function that releases everything. */
export function startSyncTriggers({
  syncNow,
  subscribeForeground,
  subscribeLocalWrites,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  intervalMs = DEFAULT_INTERVAL_MS,
}: SyncTriggerOptions): () => void {
  let stopped = false;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const fire = () => {
    if (stopped) return;
    try {
      // `syncNow` never rejects in the engine; this guards other callers.
      void Promise.resolve(syncNow()).catch(() => undefined);
    } catch {
      // Swallow: a trigger must never crash its event source.
    }
  };

  const onWrite = () => {
    if (stopped) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      fire();
    }, debounceMs);
  };

  const unsubscribeForeground = subscribeForeground(fire);
  const unsubscribeWrites = subscribeLocalWrites(onWrite);
  const interval = setInterval(fire, intervalMs);
  fire();

  return () => {
    stopped = true;
    if (debounce) clearTimeout(debounce);
    clearInterval(interval);
    unsubscribeForeground();
    unsubscribeWrites();
  };
}
