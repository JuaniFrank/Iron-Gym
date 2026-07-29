import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { MealType } from "../shared/nutrition";
import { foodItems } from "./food_items";

/**
 * `food_entries` — one row per food the user logged (per meal/per day).
 *
 * FK to `food_items` is hard (no cascade): mutator must reject deleting
 * a `food_items` row that is referenced. `meal_type` is a closed
 * `MealType` union (validated at mutator).
 *
 * `removeFoodEntry` deletes physically (cf. §8 — entries are
 * day-scoped UI noise; soft delete is overkill).
 */
export const foodEntries = sqliteTable("food_entries", {
  id: text("id").primaryKey(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  mealType: text("meal_type").$type<MealType>().notNull(),
  foodItemId: text("food_item_id")
    .notNull()
    .references(() => foodItems.id),
  grams: real("grams").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export type FoodEntry = typeof foodEntries.$inferSelect;
export type NewFoodEntry = typeof foodEntries.$inferInsert;
