// Registry of the tables that participate in sync, in parent-before-child
// (foreign-key topological) order so the pull engine can apply parents first.
//
// `name` and `pk` are SQL names. Every syncable table has a single-column
// primary key; its text form is the outbox `row_id` and the remote document id.
// `tests/sync/tables.test.ts` keeps this list in lockstep with the capture
// triggers in the sync migration.

export type SyncTable = { readonly name: string; readonly pk: string };

export const SYNC_TABLES: readonly SyncTable[] = [
  { name: "exercises", pk: "id" },
  { name: "food_items", pk: "id" },
  { name: "routines", pk: "id" },
  { name: "routine_days", pk: "id" },
  { name: "routine_exercises", pk: "id" },
  { name: "workout_sessions", pk: "id" },
  { name: "completed_sets", pk: "id" },
  { name: "pr_records", pk: "id" },
  { name: "body_weights", pk: "id" },
  { name: "body_measurements", pk: "id" },
  { name: "progress_photos", pk: "id" },
  { name: "food_entries", pk: "id" },
  { name: "fitness_goals", pk: "id" },
  { name: "scheduled_routines", pk: "day_of_week" },
  { name: "schedule_overrides", pk: "date_key" },
  { name: "session_plans", pk: "date_key" },
  { name: "achievements_unlocked", pk: "id" },
  { name: "session_notes", pk: "id" },
  { name: "user_profile", pk: "id" },
];

const BY_NAME: ReadonlyMap<string, SyncTable> = new Map(
  SYNC_TABLES.map((t) => [t.name, t]),
);

/** Look up a syncable table by SQL name; `undefined` for anything else. */
export function getSyncTable(name: string): SyncTable | undefined {
  return BY_NAME.get(name);
}
