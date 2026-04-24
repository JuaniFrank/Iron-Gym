import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { FoodItem, MealType } from "@/types";

export default function FoodAddScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ date?: string; meal?: MealType }>();
  const { allFoods, logFood } = useIronLog();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState("100");
  const [meal, setMeal] = useState<MealType>(params.meal ?? "breakfast");

  const targetDate = params.date ? parseInt(params.date, 10) : Date.now();

  const filtered = useMemo(
    () =>
      allFoods
        .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 50),
    [allFoods, search],
  );

  const gramsNum = parseFloat(grams) || 0;
  const factor = gramsNum / 100;

  if (selected) {
    const cal = selected.caloriesPer100g * factor;
    const pro = selected.proteinPer100g * factor;
    const car = selected.carbsPer100g * factor;
    const fat = selected.fatPer100g * factor;

    return (
      <Screen noPadding>
        <Header title={selected.name} back onBack={() => setSelected(null)} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <Card>
            <Text variant="tiny" muted style={{ marginBottom: 6 }}>
              POR 100G
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <MacroPill label="Kcal" value={selected.caloriesPer100g.toFixed(0)} color={colors.primary} />
              <MacroPill label="Prot" value={`${selected.proteinPer100g.toFixed(1)}g`} color={colors.success} />
              <MacroPill label="Carb" value={`${selected.carbsPer100g.toFixed(1)}g`} color={colors.warning} />
              <MacroPill label="Grasa" value={`${selected.fatPer100g.toFixed(1)}g`} color={colors.backColor} />
            </View>
          </Card>

          <Input
            label="Cantidad (gramos)"
            value={grams}
            onChangeText={setGrams}
            keyboardType="decimal-pad"
            rightAdornment={<Text variant="caption" muted>g</Text>}
          />

          <Card>
            <Text variant="tiny" muted style={{ marginBottom: 8 }}>
              TOTAL
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text variant="title">Calorías</Text>
              <Text variant="title" color={colors.primary}>
                {Math.round(cal)}
              </Text>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-around", paddingTop: 8 }}>
              <View style={{ alignItems: "center" }}>
                <Text variant="caption" muted>P</Text>
                <Text variant="label" weight="semibold">{pro.toFixed(1)}g</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text variant="caption" muted>C</Text>
                <Text variant="label" weight="semibold">{car.toFixed(1)}g</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text variant="caption" muted>G</Text>
                <Text variant="label" weight="semibold">{fat.toFixed(1)}g</Text>
              </View>
            </View>
          </Card>

          <View>
            <Text variant="label" muted style={{ marginBottom: 8 }}>
              Comida
            </Text>
            <SegmentedControl
              options={[
                { label: "Desayuno", value: "breakfast" as const },
                { label: "Almuerzo", value: "lunch" as const },
                { label: "Snack", value: "snack" as const },
                { label: "Cena", value: "dinner" as const },
              ]}
              value={meal === "other" ? "snack" : meal}
              onChange={(v) => setMeal(v as MealType)}
            />
          </View>

          <Button
            label="Añadir al diario"
            icon="check"
            fullWidth
            size="lg"
            onPress={() => {
              if (gramsNum <= 0) return;
              logFood({
                date: targetDate,
                mealType: meal,
                foodItemId: selected.id,
                grams: gramsNum,
              });
              router.back();
            }}
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen noPadding>
      <Header
        title="Añadir alimento"
        back
        right={
          <Pressable onPress={() => router.push("/food-new")} hitSlop={8}>
            <Feather name="plus" size={22} color={colors.primary} />
          </Pressable>
        }
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Input
          placeholder="Buscar alimento..."
          value={search}
          onChangeText={setSearch}
          rightAdornment={
            search ? (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Feather name="x-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            ) : (
              <Feather name="search" size={16} color={colors.mutedForeground} />
            )
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 6 }}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setSelected(f)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flex: 1 }}>
              <Text variant="label" weight="semibold" numberOfLines={1}>
                {f.name}
              </Text>
              <Text variant="caption" muted>
                {f.caloriesPer100g.toFixed(0)} kcal · P {f.proteinPer100g.toFixed(0)}g · C {f.carbsPer100g.toFixed(0)}g · G {f.fatPer100g.toFixed(0)}g
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

function MacroPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, minWidth: "20%" }}>
      <Text variant="tiny" color={color} weight="bold">
        {label.toUpperCase()}
      </Text>
      <Text variant="title">{value}</Text>
    </View>
  );
}
