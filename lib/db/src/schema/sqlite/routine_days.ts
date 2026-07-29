import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { routines } from "./routines";

/**
 * `routine_days` — ordered days within a routine (e.g. "Push", "Pull",
 * "Legs"). Cascade-deleted with the parent routine.
 *
 * `position INTEGER NOT NULL` + `UNIQUE(routine_id, position)` is the
 * order-integrity contract (DDB-10). Inserts use `MAX(position)+1`;
 * reorders use a temporary `position = -1` inside a transaction to dodge
 * the UNIQUE during the swap (cf. §1 detalle in db-integration.md).
 */
export const routineDays = sqliteTable(
  "routine_days",
  {
    id: text("id").primaryKey(),
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    unique("routine_days_routine_position_unique").on(
      t.routineId,
      t.position,
    ),
  ],
);

export type RoutineDay = typeof routineDays.$inferSelect;
export type NewRoutineDay = typeof routineDays.$inferInsert;
