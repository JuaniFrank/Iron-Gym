import { eq } from "drizzle-orm";
import { foodEntries, foodItems } from "@workspace/db/schema";
import { z } from "zod";

import { db } from "@/services/db";
import type { FoodEntry, FoodItem, MealType } from "@/types";
import { uid } from "@/utils/id";

const MEAL_TYPES: readonly MealType[] = [
  "breakfast",
  "lunch",
  "snack",
  "dinner",
  "other",
];

const FoodEntryInputSchema = z.object({
  date: z.number().int(),
  mealType: z.enum(MEAL_TYPES as [MealType, ...MealType[]]),
  foodItemId: z.string().min(1),
  grams: z.number().positive(),
});

const FoodItemInputSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(200).optional(),
  caloriesPer100g: z.number().min(0),
  proteinPer100g: z.number().min(0),
  carbsPer100g: z.number().min(0),
  fatPer100g: z.number().min(0),
  defaultServingG: z.number().positive().optional(),
});

/**
 * Log a food entry. The legacy mutator allowed passing the date raw — we
 * preserve that (no `startOfDay` normalization) because nutrition entries
 * are timestamped to the meal, not the day.
 */
export async function logFood(entry: Omit<FoodEntry, "id">): Promise<void> {
  const validated = FoodEntryInputSchema.parse(entry);
  const now = new Date();
  await db.insert(foodEntries).values({
    id: uid(),
    date: new Date(validated.date),
    mealType: validated.mealType,
    foodItemId: validated.foodItemId,
    grams: validated.grams,
    updatedAt: now,
  });
}

/**
 * Physical delete — food entries are day-scoped UI noise; soft delete is
 * overkill (cf. db-integration.md §8 — list of physical-delete cases).
 */
export async function removeFoodEntry(id: string): Promise<void> {
  await db.delete(foodEntries).where(eq(foodEntries.id, id));
}

/**
 * Create a custom food item (`is_preset = false`).
 */
export async function createCustomFood(
  input: Omit<FoodItem, "id" | "isCustom">,
): Promise<FoodItem> {
  const validated = FoodItemInputSchema.parse(input);
  const id = uid();
  const now = new Date();
  await db.insert(foodItems).values({
    id,
    name: validated.name,
    brand: validated.brand ?? null,
    caloriesPer100g: validated.caloriesPer100g,
    proteinPer100g: validated.proteinPer100g,
    carbsPer100g: validated.carbsPer100g,
    fatPer100g: validated.fatPer100g,
    defaultServingG: validated.defaultServingG ?? null,
    isPreset: false,
    updatedAt: now,
  });
  return {
    id,
    name: validated.name,
    brand: validated.brand,
    caloriesPer100g: validated.caloriesPer100g,
    proteinPer100g: validated.proteinPer100g,
    carbsPer100g: validated.carbsPer100g,
    fatPer100g: validated.fatPer100g,
    defaultServingG: validated.defaultServingG,
    isCustom: true,
  };
}
