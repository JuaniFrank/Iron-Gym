import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `food_items` — catalog of preset + user-defined foods.
 *
 * Same `is_preset` pattern as `exercises` (DDB-14): seed loads
 * `FOOD_DATABASE` with `is_preset = true`; user-created foods land with
 * `is_preset = false`. UI presets are read-only (DDB-16).
 *
 * Macros are normalized per 100g so `food_entries.grams` × ratio gives
 * the actual intake. `defaultServingG` is purely a UX hint (preselected
 * portion size), not used in any computed query.
 */
export const foodItems = sqliteTable("food_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand"),
  caloriesPer100g: real("calories_per_100g").notNull(),
  proteinPer100g: real("protein_per_100g").notNull(),
  carbsPer100g: real("carbs_per_100g").notNull(),
  fatPer100g: real("fat_per_100g").notNull(),
  defaultServingG: real("default_serving_g"),
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export type FoodItem = typeof foodItems.$inferSelect;
export type NewFoodItem = typeof foodItems.$inferInsert;
