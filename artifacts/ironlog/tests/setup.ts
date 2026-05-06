// Per-file setup for the vitest suite. Loaded via `vitest.config.ts` →
// `setupFiles`.
//
// The mutators import `db` from `@/services/db`, which is the SINGLETON
// expo-sqlite handle wrapped by Drizzle. In tests we never want that
// connection — we want the better-sqlite3 in-memory DB created per test.
//
// Rather than rewriting every mutator to take a `db` parameter (huge
// surface area, breaks the production import contract), we redefine the
// `db` export at vi.mock level and provide a `useTestDb(testDb)` setter
// that the helper calls right after creating the in-memory instance.

import { vi } from "vitest";

let activeDb: unknown = null;

vi.mock("@/services/db", () => ({
  get db() {
    if (!activeDb) {
      throw new Error(
        "[ironlog tests] services/db accessed before useTestDb() — did you call createTestDb() in beforeEach?",
      );
    }
    return activeDb;
  },
}));

/**
 * Swap the active DB for the test. Called from `tests/helpers/db.ts` after
 * each `createTestDb()` so subsequent mutator imports resolve to it.
 */
export function useTestDb(db: unknown): void {
  activeDb = db;
}

export function clearTestDb(): void {
  activeDb = null;
}
