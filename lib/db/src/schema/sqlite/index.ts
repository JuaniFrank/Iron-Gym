// SQLite schema barrel.
// Tables are defined per-file in this directory (one `sqliteTable` + its
// inferred Insert/Select types per file) and re-exported here so that
// `import * as schema from "../schema/sqlite"` exposes the full set to
// `drizzle()` and to drizzle-kit's generator.

// --- bookkeeping ---
export * from "./_meta";
export * from "./key_value";
export * from "./_outbox";
export * from "./_sync_state";

// --- catalog (preset + custom) ---
export * from "./exercises";
export * from "./food_items";

// --- routines (DDB-9) ---
export * from "./routines";
export * from "./routine_days";
export * from "./routine_exercises";

// --- sessions ---
export * from "./workout_sessions";
export * from "./completed_sets";
export * from "./pr_records";

// --- body / progress ---
export * from "./body_weights";
export * from "./body_measurements";
export * from "./progress_photos";

// --- nutrition ---
export * from "./food_entries";

// --- goals + scheduling ---
export * from "./fitness_goals";
export * from "./scheduled_routines";
export * from "./schedule_overrides";
export * from "./session_plans";

// --- achievements + notes + discovery ---
export * from "./achievements_unlocked";
export * from "./session_notes";
export * from "./feature_discoveries";

// --- profile ---
export * from "./user_profile";
