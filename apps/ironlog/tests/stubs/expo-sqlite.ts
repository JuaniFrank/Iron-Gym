// Vitest stub for `expo-sqlite`. The mutators don't hit this module
// directly — they go through `services/db.ts`, which we rewire in
// `tests/setup.ts` to point at a `better-sqlite3` instance. But the prod
// `services/db.ts` calls `SQLite.openDatabaseSync()` at module-eval time,
// so we need *some* function that doesn't blow up before the rewire takes
// effect. The returned object is never queried in tests.

export function openDatabaseSync(_name: string): unknown {
  return {
    // expo-sqlite SQLiteDatabase surface stub — never called in tests.
    execSync: () => {},
    runSync: () => ({ changes: 0, lastInsertRowId: 0 }),
    getAllSync: () => [],
    getFirstSync: () => null,
    closeSync: () => {},
  };
}
