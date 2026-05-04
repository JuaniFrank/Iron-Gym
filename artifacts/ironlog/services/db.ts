import { createSqliteDb, type DB } from "@workspace/db";

/**
 * Process-wide IronLog SQLite handle.
 *
 * Created at module evaluation time so every consumer (mutators, queries,
 * `bootDatabase()` in `app/_layout.tsx`) shares the SAME connection. Never
 * call `createSqliteDb()` from a component or a per-request path — that would
 * open a second handle to the same file and break `useLiveQuery` change
 * notifications (which fan out per-DB-instance, not per-file).
 *
 * The schema migrations and seed bootstrap run AFTER this assignment, from
 * `bootDatabase()` in `app/_layout.tsx`. Until that promise resolves, the
 * tables don't exist yet — never query `db` outside the boot pipeline before
 * the gate flips.
 */
export const db: DB = createSqliteDb();
