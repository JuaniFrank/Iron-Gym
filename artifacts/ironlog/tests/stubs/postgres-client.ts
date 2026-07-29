// Vitest stub for `lib/db/src/client/postgres.ts`. The real module
// throws on import unless DATABASE_URL is set — tests don't talk to
// postgres, so we replace it with no-op exports.

export const pool = null;
export const db = null;
export type DB = never;
