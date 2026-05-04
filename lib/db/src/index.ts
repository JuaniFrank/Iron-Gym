// Public barrel for `@workspace/db`.
//
// Default surface is the SQLite client (local-first IronLog runtime).
// Postgres lives under the `./postgres` sub-path export — opt-in for
// server-side callers — so Metro/Expo never follows `pg` (Node-only,
// requires `events` built-in not available in React Native).

export * from "./client/sqlite";
export * from "./migrations";
export * from "./seed";
export * as schema from "./schema";
