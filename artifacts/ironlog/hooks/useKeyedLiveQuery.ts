import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";

import {
  applyKeyedResult,
  selectKeyed,
  startKeyedLiveQuery,
  type KeyedState,
} from "@/utils/keyedLive";

/**
 * Live query whose "loaded" flag is bound to a key (session id, date, routine
 * id...). Replacement for drizzle's `useLiveQuery` wherever a screen gates on
 * loaded data: see `utils/keyedLive.ts` for why `updatedAt` / `data` of
 * `useLiveQuery` cannot be trusted across key changes.
 *
 * - `data` is `undefined` and `loaded` false until a result for the CURRENT
 *   `key` arrived (never the previous key's, never drizzle's initial `[]`);
 * - results are re-read whenever one of `tables` changes;
 * - results of a previous key that resolve late are ignored.
 *
 * `query` must be derived from `key` (memoized on it): the subscription is
 * only restarted when `key` changes, like `useLiveQuery(query, [key])`.
 */
export function useKeyedLiveQuery<T>(
  query: PromiseLike<T[]>,
  tables: readonly SQLiteTable[],
  key: string,
): { data: T[] | undefined; loaded: boolean; error: unknown } {
  const [state, setState] = useState<KeyedState<string, T[]>>(undefined);
  const [error, setError] = useState<unknown>(undefined);

  useEffect(() => {
    const names = new Set(tables.map((t) => getTableConfig(t).name));
    return startKeyedLiveQuery<string, T[]>({
      key,
      load: () => query,
      subscribe: (onChange) =>
        addDatabaseChangeListener(({ tableName }) => {
          if (names.has(tableName)) onChange();
        }),
      onResult: (result) => {
        setError(undefined);
        setState((prev) => applyKeyedResult(prev, result));
      },
      onError: setError,
    });
    // `query` and `tables` are derived from `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(() => {
    const { data, loaded } = selectKeyed(state, key);
    return { data, loaded, error };
  }, [state, key, error]);
}
