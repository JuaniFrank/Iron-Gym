import {
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import type { BodyPart, NoteCategory, NoteSource } from "../shared/notes";
import { completedSets } from "./completed_sets";
import { exercises } from "./exercises";
import { workoutSessions } from "./workout_sessions";

/**
 * `session_notes` — structured notes attached to a session, optionally to a
 * specific set or exercise (cf. notes-system.md).
 *
 * FK behavior:
 *   - `session_id` cascade deletes (notes are session-scoped).
 *   - `set_id` `set null` on delete: when a set is removed, the note
 *     survives but loses its set anchor (still discoverable by session +
 *     exercise).
 *   - `exercise_id` hard FK (no cascade): mutator denormalizes from the
 *     set when present; deleting an exercise with attached notes is
 *     blocked at the mutator.
 *
 * Indexes:
 *   - `notes_by_session` / `notes_by_exercise` for the obvious lookups;
 *   - `notes_by_created` for "all notes" feed (DESC);
 *   - `notes_pain_active (body_part, severity, created_at)` accelerates
 *     `useActivePainNotes` (`category = 'pain' AND resolved = 0 AND
 *     deleted_at IS NULL`). SQLite doesn't support partial indexes via
 *     drizzle-kit declaration today — if perf demands it, the partial
 *     can be added in a future raw SQL migration.
 *
 * Audio uri only set when `source = 'voice'` (path under
 * `documentDirectory`, same convention as `progress_photos`).
 */
export const sessionNotes = sqliteTable(
  "session_notes",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    setId: text("set_id").references(() => completedSets.id, {
      onDelete: "set null",
    }),
    exerciseId: text("exercise_id").references(() => exercises.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    category: text("category").$type<NoteCategory>().notNull(),
    bodyPart: text("body_part").$type<BodyPart>(),
    /** 1..10. Stored raw; UI maps to per-category labels (D-19). */
    severity: integer("severity"),
    resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    text: text("text").notNull(),
    source: text("source").$type<NoteSource>().notNull(),
    /** Path in `documentDirectory`. Only set when `source === 'voice'`. */
    audioUri: text("audio_uri"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("notes_by_session").on(t.sessionId),
    index("notes_by_exercise").on(t.exerciseId),
    index("notes_by_created").on(t.createdAt),
    /** Helps `useActivePainNotes`. Promote to a partial index in raw SQL
     *  if profiling shows scan cost over the full table. */
    index("notes_pain_active").on(t.bodyPart, t.severity, t.createdAt),
  ],
);

export type SessionNote = typeof sessionNotes.$inferSelect;
export type NewSessionNote = typeof sessionNotes.$inferInsert;
