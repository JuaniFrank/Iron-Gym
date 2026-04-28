import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BarRow } from "@/components/charts/BarRow";
import { MacroRing } from "@/components/charts/MacroRing";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
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
  const insets = useSafeAreaInsets();
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

  const dateLabel = dayOffset === 0 ? "Hoy" : formatDateLong(targetDate.getTime());

  return (
    <Screen scroll noPadding tabBarSpacing>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20 }}>
        <Row jc="space-between" style={{ paddingVertical: 14 }}>
          <Col gap={4}>
            <Text variant="h1">Nutrición</Text>
            <Text variant="body" muted style={{ textTransform: "capitalize" }}>
              {dateLabel}
            </Text>
          </Col>
          <Row gap={6}>
            <IconButton icon="chevron-left" onPress={() => setDayOffset((o) => o - 1)} />
            <IconButton
              icon="chevron-right"
              onPress={() => setDayOffset((o) => Math.min(0, o + 1))}
              disabled={dayOffset >= 0}
            />
          </Row>
        </Row>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {/* Macro hero */}
        <Card style={{ marginBottom: 12 }}>
          <Row gap={20} ai="center">
            <MacroRing consumed={totals.calories} goal={calorieGoal} />
            <Col gap={10} flex={1}>
              <Row gap={20}>
                <Col gap={2}>
                  <Text variant="tiny" color={colors.muted}>
                    CONSUMIDAS
                  </Text>
                  <Text variant="mono" color={colors.ink} style={{ fontSize: 18, fontWeight: "600" }}>
                    {Math.round(totals.calories).toLocaleString()}
                  </Text>
                </Col>
                <Col gap={2}>
                  <Text variant="tiny" color={colors.muted}>
                    META
                  </Text>
                  <Text variant="mono" color={colors.muted} style={{ fontSize: 18, fontWeight: "600" }}>
                    {calorieGoal.toLocaleString()}
                  </Text>
                </Col>
              </Row>
              <Col gap={6} style={{ marginTop: 4 }}>
                <BarRow
                  label="Proteína"
                  value={totals.protein}
                  max={macros.protein}
                  color={colors.ink}
                />
                <BarRow
                  label="Carbos"
                  value={totals.carbs}
                  max={macros.carbs}
                  color={colors.mEspalda}
                />
                <BarRow
                  label="Grasas"
                  value={totals.fat}
                  max={macros.fat}
                  color={colors.mHombros}
                />
              </Col>
            </Col>
          </Row>
        </Card>

        <Pressable
          onPress={() => router.push(`/food-add?date=${targetDate.getTime()}` as never)}
          style={({ pressed }) => ({
            height: 52,
            backgroundColor: colors.ink,
            borderRadius: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: pressed ? 0.92 : 1,
            marginBottom: 14,
          })}
        >
          <Feather name="plus" size={16} color={colors.bg} />
          <Text variant="title" color={colors.bg}>
            Añadir comida
          </Text>
        </Pressable>

        {/* Meals */}
        <Col gap={8}>
          {(Object.keys(MEAL_LABELS) as MealType[]).map((meal) => {
            const items = byMeal[meal];
            const mealCalories = items.reduce((s, e) => {
              const f = allFoods.find((x) => x.id === e.foodItemId);
              return f ? s + (f.caloriesPer100g * e.grams) / 100 : s;
            }, 0);
            return (
              <Card key={meal} padding={0}>
                <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                  <Row jc="space-between" style={{ marginBottom: items.length ? 12 : 0 }}>
                    <Row gap={12}>
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          backgroundColor: colors.accentSoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Feather name={MEAL_ICONS[meal]} size={18} color={colors.accentEdge} />
                      </View>
                      <Col gap={2}>
                        <Text variant="title">{MEAL_LABELS[meal]}</Text>
                        <Text variant="caption" muted>
                          {items.length === 0
                            ? "Vacío"
                            : `${items.length} ${
                                items.length === 1 ? "alimento" : "alimentos"
                              } · ${Math.round(mealCalories)} kcal`}
                        </Text>
                      </Col>
                    </Row>
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/food-add?date=${targetDate.getTime()}&meal=${meal}` as never,
                        )
                      }
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: colors.surfaceAlt,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Feather name="plus" size={14} color={colors.ink} />
                    </Pressable>
                  </Row>
                  {items.length > 0 ? (
                    <Col gap={4}>
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
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              backgroundColor: colors.surfaceAlt,
                              borderRadius: 10,
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                              {food.name}
                            </Text>
                            <Text
                              variant="caption"
                              color={colors.muted}
                              style={{ marginRight: 10 }}
                            >
                              {e.grams}g
                            </Text>
                            <Text
                              variant="mono"
                              color={colors.ink}
                              style={{ fontSize: 12, fontWeight: "600" }}
                            >
                              {Math.round(cal)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </Col>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </Col>

        {todaysEntries.length > 0 ? (
          <Text
            variant="caption"
            color={colors.mutedSoft}
            style={{ marginVertical: 20, textAlign: "center" }}
          >
            Mantén pulsado un alimento para eliminarlo
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
