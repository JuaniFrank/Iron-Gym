/**
 * Pure core of `useKeyedLiveQuery`.
 *
 * drizzle's `useLiveQuery(query, deps)` keeps the previous deps' `data` and
 * `updatedAt` when `deps` change, starts with `data = []` (indistinguishable
 * from "no rows") and never cancels: a read started for old deps can resolve
 * after the deps changed and overwrite the state. Screens that gate on
 * "loaded" therefore see empty/stale data as loaded right when the key
 * (session id, date, routine id) arrives. Here every result is tagged with the
 * key it was started for, and "loaded" only means "a result for the CURRENT
 * key arrived".
 */

export interface KeyedResult<K, T> {
  key: K;
  data: T;
}

/** Latest accepted result, `undefined` until the first one. */
export type KeyedState<K, T> = KeyedResult<K, T> | undefined;

/** Latest result wins (same key: a reload; other key: it was adopted). */
export function applyKeyedResult<K, T>(
  _state: KeyedState<K, T>,
  result: KeyedResult<K, T>,
): KeyedState<K, T> {
  return { key: result.key, data: result.data };
}

/**
 * `data` is `undefined` and `loaded` false until a result for `currentKey`
 * arrived; a result of any other key is never exposed.
 */
export function selectKeyed<K, T>(
  state: KeyedState<K, T>,
  currentKey: K,
): { data: T | undefined; loaded: boolean } {
  if (state && Object.is(state.key, currentKey)) {
    return { data: state.data, loaded: true };
  }
  return { data: undefined, loaded: false };
}

export interface KeyedLiveQueryOptions<K, T> {
  /** Key this subscription was started for. */
  key: K;
  /** Runs the query (called once at start and once per database change). */
  load: () => PromiseLike<T>;
  /** Registers `onChange` for the relevant tables; returns its disposer. */
  subscribe: (onChange: () => void) => { remove(): void };
  onResult: (result: KeyedResult<K, T>) => void;
  onError: (error: unknown) => void;
}

/**
 * Starts the query and keeps it fresh until the returned cleanup runs (React
 * effect cleanup = key change or unmount). Nothing is reported after cleanup,
 * and a read that finishes after a newer read of the same subscription was
 * already reported is dropped.
 */
export function startKeyedLiveQuery<K, T>(
  opts: KeyedLiveQueryOptions<K, T>,
): () => void {
  let cancelled = false;
  let started = 0;
  let applied = 0;

  const run = () => {
    if (cancelled) return;
    const seq = ++started;
    Promise.resolve(opts.load()).then(
      (data) => {
        if (cancelled || seq < applied) return;
        applied = seq;
        opts.onResult({ key: opts.key, data });
      },
      (error) => {
        if (cancelled) return;
        opts.onError(error);
      },
    );
  };

  run();
  const subscription = opts.subscribe(run);
  return () => {
    cancelled = true;
    subscription.remove();
  };
}
