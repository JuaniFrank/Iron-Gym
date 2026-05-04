// Shared schema barrel.
//
// Types reused across SQLite and Postgres schemas (DDB-3). They feed two
// surfaces:
//   1. `$type<T>()` bindings for JSON columns (e.g. `secondary_muscles`,
//      `volume_targets`, `session_plans.exercises`). Drizzle stores JSON as
//      a TEXT column; the type is purely a TS hint, validation lives at the
//      mutator boundary (Zod, DDB-11).
//   2. Closed-set unions for `text` columns we constrain semantically but
//      not at the SQL layer (e.g. `feature_discoveries.status`,
//      `session_notes.category`).
//
// DDB-6: once the runtime migrates fully, domain types come from
// `$inferSelect` of each table. These shared unions remain because they
// are not derivable from a column's storage type — they ARE the storage
// type's logical domain.

export * from "./muscle";
export * from "./planning";
export * from "./volume";
export * from "./notes";
export * from "./nutrition";
export * from "./discovery";
