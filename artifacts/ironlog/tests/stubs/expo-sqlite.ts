// Vitest stub for `expo-sqlite`. The mutators don't hit this module
// directly — they go through `services/db.ts`, which we rewire in
// `tests/setup.ts` to point at a `better-sqlite3` instance. The prod
// `lib/db` client imports it at module-eval time, so we need *some*
// `openDatabaseAsync` that doesn't blow up before the rewire takes effect.
// The returned object is never queried in tests.

export function openDatabaseAsync(_name: string): Promise<unknown> {
  return Promise.resolve({
    // expo-sqlite SQLiteDatabase surface stub — never called in tests.
    execAsync: async () => {},
    runAsync: async () => ({ changes: 0, lastInsertRowId: 0 }),
    prepareAsync: async () => ({
      executeForRawResultAsync: async () => ({ getAllAsync: async () => [] }),
      finalizeAsync: async () => {},
    }),
    closeAsync: async () => {},
  });
}

export function addDatabaseChangeListener(_listener: unknown): { remove(): void } {
  return { remove() {} };
}
