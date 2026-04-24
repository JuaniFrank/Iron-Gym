import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { BarRow } from "@/components/charts/BarRow";
import { MacroRing } from "@/components/charts/MacroRing";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { MealType } from "@/types";
import { calorieGoalForGoal, calculateTDEE, macroSplitForGoal } from "@/utils/calculations";
import { dateKey, formatDateLong } from "@/utils/date";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  snack: "Snack",
  dinner: "Cena",
  other: "Otros",
};

const MEAL_ICONS: Record<MealType, keyof typeof Feather.glyphMap> = {
  breakfast: "coffee",
  lunch: "sun",
  snack: "package",
  dinner: "moon",
  other: "more-horizontal",
};

export default function NutritionScreen() {
  const colors = useThemeColors();
  const { profile, foodEntries, allFoods, removeFoodEntry } = useIronLog();
  const [dayOffset, setDayOffset] = useState(0);

  const targetDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset]);

  const targetKey = dateKey(targetDate.getTime());
  const todaysEntries = foodEntries.filter((e) => dateKey(e.date) === targetKey);

  const tdee = calculateTDEE(profile);
  const calorieGoal = profile.caloriesGoal ?? calorieGoalForGoal(tdee, profile.goal);
  const macros = useMemo(
    () =>
      profile.proteinGoalG && profile.carbsGoalG && profile.fatGoalG
        ? {
            protein: profile.proteinGoalG,
            carbs: profile.carbsGoalG,
            fat: profile.fatGoalG,
          }
        : macroSplitForGoal(calorieGoal, profile.weightKg, profile.goal),
    [profile, calorieGoal],
  );

  const totals = todaysEntries.reduce(
    (acc, e) => {
      const food = allFoods.find((f) => f.id === e.foodItemId);
      if (!food) return acc;
      const factor = e.grams / 100;
      return {
        calories: acc.calories + food.caloriesPer100g * factor,
        protein: acc.protein + food.proteinPer100g * factor,
        carbs: acc.carbs + food.carbsPer100g * factor,
        fat: acc.fat + food.fatPer100g * factor,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const byMeal: Record<MealType, typeof todaysEntries> = {
    breakfast: [],
    lunch: [],
    snack: [],
    dinner: [],
    other: [],
  };
  for (const e of todaysEntries) byMeal[e.mealType].push(e);

  return (
    <Screen scroll>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <View>
          <Text variant="h1">Nutrición</Text>
          <Text variant="body" muted style={{ textTransform: "capitalize" }}>
            {dayOffset === 0 ? "Hoy" : formatDateLong(targetDate.getTime())}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <IconButton icon="chevron-left" onPress={() => setDayOffset((o) => o - 1)} size={36} />
          <IconButton
            icon="chevron-right"
            onPress={() => setDayOffset((o) => Math.min(0, o + 1))}
            size={36}
            disabled={dayOffset >= 0}
          />
        </View>
      </View>

      {/* Calories ring */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <MacroRing consumed={totals.calories} goal={calorieGoal} size={140} thickness={12} />
          <View style={{ flex: 1, marginLeft: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Text variant="tiny" muted>
                  CONSUMIDAS
                </Text>
                <Text variant="h3">{Math.round(totals.calories)}</Text>
              </View>
              <View>
                <Text variant="tiny" muted>
                  META
                </Text>
                <Text variant="h3">{calorieGoal}</Text>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <BarRow
                label="Proteína"
                value={totals.protein}
                max={macros.protein}
                color={colors.primary}
                format={(v) => v.toFixed(0)}
                secondaryLabel={`/ ${macros.protein}g`}
              />
              <BarRow
                label="Carbos"
                value={totals.carbs}
                max={macros.carbs}
                color={colors.warning}
                format={(v) => v.toFixed(0)}
                secondaryLabel={`/ ${macros.carbs}g`}
              />
              <BarRow
                label="Grasas"
                value={totals.fat}
                max={macros.fat}
                color={colors.backColor}
                format={(v) => v.toFixed(0)}
                secondaryLabel={`/ ${macros.fat}g`}
              />
            </View>
          </View>
        </View>
      </Card>

      {/* Add food button */}
      <Pressable
        onPress={() =>
          router.push(`/food-add?date=${targetDate.getTime()}` as never)
        }
        style={({ pressed }) => ({
          marginTop: 12,
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: colors.radius,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Feather name="plus" size={18} color={colors.primaryForeground} />
        <Text variant="title" color={colors.primaryForeground}>
          Añadir comida
        </Text>
      </Pressable>

      {/* Meals */}
      <View style={{ marginTop: 16, gap: 10 }}>
        {(Object.keys(MEAL_LABELS) as MealType[]).map((meal) => {
          const items = byMeal[meal];
          const mealCalories = items.reduce((s, e) => {
            const f = allFoods.find((x) => x.id === e.foodItemId);
            return f ? s + (f.caloriesPer100g * e.grams) / 100 : s;
          }, 0);
          return (
            <Card key={meal}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Feather name={MEAL_ICONS[meal]} size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="title">{MEAL_LABELS[meal]}</Text>
                  <Text variant="caption" muted>
                    {items.length === 0
                      ? "Vacío"
                      : `${items.length} ${items.length === 1 ? "alimento" : "alimentos"} · ${Math.round(mealCalories)} kcal`}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    router.push(`/food-add?date=${targetDate.getTime()}&meal=${meal}` as never)
                  }
                  hitSlop={8}
                  style={({ pressed }) => ({
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.secondary,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Feather name="plus" size={16} color={colors.foreground} />
                </Pressable>
              </View>
              {items.length > 0 ? (
                <View style={{ marginTop: 8, gap: 6 }}>
                  {items.map((e) => {
                    const food = allFoods.find((f) => f.id === e.foodItemId);
                    if (!food) return null;
                    const cal = (food.caloriesPer100g * e.grams) / 100;
                    return (
                      <Pressable
                        key={e.id}
                        onLongPress={() => removeFoodEntry(e.id)}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          backgroundColor: colors.secondary,
                          borderRadius: 8,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                          {food.name}
                        </Text>
                        <Text variant="caption" muted style={{ marginRight: 8 }}>
                          {e.grams}g
                        </Text>
                        <Text variant="label" weight="semibold">
                          {Math.round(cal)} kcal
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>

      {todaysEntries.length === 0 ? (
        <Text variant="caption" muted style={{ marginTop: 12, textAlign: "center" }}>
          Mantén pulsado un alimento para eliminarlo
        </Text>
      ) : null}
    </Screen>
  );
}
