import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { foodEntries, foodItems } from "@workspace/db/schema";
import { useMemo } from "react";

import { db } from "@/services/db";
import type { FoodEntry, FoodItem } from "@/types";

function rowToFood(row: typeof foodItems.$inferSelect): FoodItem {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    caloriesPer100g: row.caloriesPer100g,
    proteinPer100g: row.proteinPer100g,
    carbsPer100g: row.carbsPer100g,
    fatPer100g: row.fatPer100g,
    defaultServingG: row.defaultServingG ?? undefined,
    isCustom: !row.isPreset,
  };
}

function rowToEntry(row: typeof foodEntries.$inferSelect): FoodEntry {
  return {
    id: row.id,
    date: row.date instanceof Date ? row.date.getTime() : row.date,
    mealType: row.mealType,
    foodItemId: row.foodItemId,
    grams: row.grams,
  };
}

/**
 * All non-deleted foods (presets + custom), sorted by name.
 */
export function useAllFoods(): FoodItem[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(foodItems)
      .where(isNull(foodItems.deletedAt))
      .orderBy(asc(foodItems.name)),
  );
  return useMemo(() => (data ?? []).map(rowToFood), [data]);
}

/**
 * One food by id. Returns null if missing or soft-deleted.
 */
export function useFoodById(id: string | null | undefined): FoodItem | null {
  const query = useMemo(
    () =>
      db
        .select()
        .from(foodItems)
        .where(
          and(eq(foodItems.id, id ?? ""), isNull(foodItems.deletedAt)),
        )
        .limit(1),
    [id],
  );
  const { data } = useLiveQuery(query, [id]);
  if (!id) return null;
  const row = data?.[0];
  return row ? rowToFood(row) : null;
}

/**
 * Food entries, optionally filtered by a date range (`from`/`to` are
 * inclusive timestamps in ms). When neither is supplied, returns ALL
 * non-deleted entries — used by the home screen and the nutrition tab.
 */
export function useFoodEntries(
  opts: { from?: number; to?: number } = {},
): FoodEntry[] {
  const { from, to } = opts;
  const query = useMemo(() => {
    const filters = [isNull(foodEntries.deletedAt)];
    if (from !== undefined) filters.push(gte(foodEntries.date, new Date(from)));
    if (to !== undefined) filters.push(lte(foodEntries.date, new Date(to)));
    return db
      .select()
      .from(foodEntries)
      .where(and(...filters))
      .orderBy(asc(foodEntries.date));
  }, [from, to]);
  const { data } = useLiveQuery(query, [from, to]);
  return useMemo(() => (data ?? []).map(rowToEntry), [data]);
}
