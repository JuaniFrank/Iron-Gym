// Vitest stub for `drizzle-orm/expo-sqlite`.
//
// Only `useLiveQuery` (a React hook that imports expo-sqlite for its change
// listener) is consumed from this entry point; the db itself is the
// sqlite-proxy driver over expo's async API (`lib/db/src/client`), and tests
// use `tests/helpers/db.ts` (better-sqlite3 behind the same `createAsyncDb`).
// The stub just lets the imports resolve under node, and throws loudly if a
// test ever invokes the hook.

export function useLiveQuery(..._args: unknown[]): never {
  throw new Error(
    "[ironlog tests] drizzle-orm/expo-sqlite stub: useLiveQuery is a React hook, never invoked from tests",
  );
}
