import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { workoutSessions } from "./workout_sessions";

/**
 * `session_set_drafts` — borradores per-row de los inputs de una serie en
 * progreso. Existen mientras la serie NO está marcada como completada
 * (`completed_sets`).
 *
 * Por qué: los inputs del SetRow (kg/reps/rpe) vivían en local state — si
 * el user cerraba la app antes de tappear ✓, lo escrito se perdía. Persistir
 * en SQLite via autosave debounced (300ms) garantiza que sobreviva
 * background → kill → reopen.
 *
 * Clave de slot: `(session_id, exercise_id, set_index, is_warmup)`. Cuando
 * el user marca el set como completado, el mutator de `logSet` borra el
 * draft correspondiente; cuando lo descomplete (`removeSet`), reaparece
 * un slot vacío (no se restaura el draft anterior — el user puede
 * re-typear si quiere).
 *
 * Cascada desde `workout_sessions` (eliminar la sesión borra drafts).
 *
 * Indexes:
 *   - `drafts_by_session (session_id)` para el read principal del
 *     `useDraftsBySession` hook.
 *   - UNIQUE `(session_id, exercise_id, set_index, is_warmup)` para que
 *     el upsert no genere duplicados.
 *
 * Aditivo — no afecta datos existentes. Sessions/sets previos a esta
 * feature siguen funcionando exactamente igual.
 */
export const sessionSetDrafts = sqliteTable(
  "session_set_drafts",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull(),
    setIndex: integer("set_index").notNull(),
    isWarmup: integer("is_warmup", { mode: "boolean" }).notNull(),
    weight: real("weight"),
    reps: integer("reps"),
    rpe: real("rpe"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("drafts_by_session").on(t.sessionId),
    uniqueIndex("drafts_slot_uq").on(
      t.sessionId,
      t.exerciseId,
      t.setIndex,
      t.isWarmup,
    ),
  ],
);

export type SessionSetDraft = typeof sessionSetDrafts.$inferSelect;
export type NewSessionSetDraft = typeof sessionSetDrafts.$inferInsert;
