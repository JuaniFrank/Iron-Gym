// Vitest stub for `drizzle-orm/expo-sqlite`.
//
// In tests we never use the expo-sqlite drizzle driver — we use
// `drizzle-orm/better-sqlite3` via `tests/helpers/db.ts`. But the prod
// `lib/db/src/client/sqlite.ts` and `lib/db/src/migrations.ts` import
// from `drizzle-orm/expo-sqlite` at module-eval time, which transitively
// pulls in `expo-sqlite`. We can't load the real expo-sqlite under
// node (it expects a React Native runtime), so this stub provides
// just-enough surface for the imports to resolve.
//
// `drizzle()` and `migrate()` here are NOT meant to be called from
// tests — if a test does call them, that's a bug in the test setup
// (it should be using `createTestDb()` instead). The functions throw
// loudly to surface the misuse.

export function drizzle(..._args: unknown[]): never {
  throw new Error(
    "[ironlog tests] drizzle-orm/expo-sqlite stub: use tests/helpers/db.ts (better-sqlite3)",
  );
}

export function migrate(..._args: unknown[]): never {
  throw new Error(
    "[ironlog tests] drizzle-orm/expo-sqlite stub: migrations apply via tests/helpers/db.ts",
  );
}

export function useLiveQuery(..._args: unknown[]): never {
  throw new Error(
    "[ironlog tests] drizzle-orm/expo-sqlite stub: useLiveQuery is a React hook, never invoked from tests",
  );
}
