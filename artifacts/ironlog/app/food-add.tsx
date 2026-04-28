import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Header } from "@/components/ui/Header";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { FoodItem, MealType } from "@/types";

export default function FoodAddScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
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
        <Header
          title=""
          compact
          right={<IconButton icon="x" onPress={() => setSelected(null)} />}
        />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}>
          <Text variant="h1" style={{ marginBottom: 18, paddingHorizontal: 4 }}>
            {selected.name}
          </Text>

          <Card style={{ marginBottom: 12 }}>
            <Text variant="tiny" color={colors.muted} style={{ marginBottom: 10 }}>
              POR 100G
            </Text>
            <Row gap={20} jc="space-between">
              <Col gap={2}>
                <Text variant="tiny" color={colors.muted}>
                  KCAL
                </Text>
                <Text variant="title">{selected.caloriesPer100g.toFixed(0)}</Text>
              </Col>
              <Col gap={2}>
                <Text variant="tiny" color={colors.muted}>
                  PROT
                </Text>
                <Text variant="title">{selected.proteinPer100g.toFixed(1)}g</Text>
              </Col>
              <Col gap={2}>
                <Text variant="tiny" color={colors.muted}>
                  CARB
                </Text>
                <Text variant="title">{selected.carbsPer100g.toFixed(1)}g</Text>
              </Col>
              <Col gap={2}>
                <Text variant="tiny" color={colors.muted}>
                  GRASA
                </Text>
                <Text variant="title">{selected.fatPer100g.toFixed(1)}g</Text>
              </Col>
            </Row>
          </Card>

          <Input
            fieldLabel="CANTIDAD"
            value={grams}
            onChangeText={setGrams}
            keyboardType="decimal-pad"
            suffix="g"
          />

          <Card style={{ marginVertical: 14 }}>
            <Text variant="tiny" color={colors.muted} style={{ marginBottom: 12 }}>
              TOTAL
            </Text>
            <Row jc="space-between" style={{ marginBottom: 10 }}>
              <Text variant="title">Calorías</Text>
              <Text variant="monoLg" color={colors.ink}>
                {Math.round(cal).toLocaleString()}
              </Text>
            </Row>
            <Divider />
            <Row jc="space-around" style={{ paddingTop: 12 }}>
              <Col gap={2} ai="center">
                <Text variant="tiny" color={colors.muted}>
                  P
                </Text>
                <Text variant="mono" color={colors.ink} style={{ fontSize: 14, fontWeight: "600" }}>
                  {pro.toFixed(1)}g
                </Text>
              </Col>
              <Col gap={2} ai="center">
                <Text variant="tiny" color={colors.muted}>
                  C
                </Text>
                <Text variant="mono" color={colors.ink} style={{ fontSize: 14, fontWeight: "600" }}>
                  {car.toFixed(1)}g
                </Text>
              </Col>
              <Col gap={2} ai="center">
                <Text variant="tiny" color={colors.muted}>
                  G
                </Text>
                <Text variant="mono" color={colors.ink} style={{ fontSize: 14, fontWeight: "600" }}>
                  {fat.toFixed(1)}g
                </Text>
              </Col>
            </Row>
          </Card>

          <Text variant="tiny" color={colors.muted} style={{ marginBottom: 8 }}>
            COMIDA
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
            style={{ marginBottom: 18 }}
          />

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
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton icon="chevron-down" onPress={() => router.back()} />
        <Text variant="title">Añadir alimento</Text>
        <IconButton
          icon="plus"
          variant="primary"
          onPress={() => router.push("/food-new")}
        />
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            height: 48,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            gap: 10,
          }}
        >
          <Feather name="search" size={16} color={colors.muted} />
          <Input
            placeholder="Buscar alimento…"
            value={search}
            onChangeText={setSearch}
            containerStyle={{ flex: 1 }}
            style={{ paddingVertical: 0 }}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={14} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text
        variant="tiny"
        color={colors.muted}
        style={{ paddingHorizontal: 24, paddingBottom: 10 }}
      >
        RESULTADOS · {filtered.length}
      </Text>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80, gap: 6 }}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setSelected(f)}
            style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
          >
            <Card padding={0}>
              <Row jc="space-between" style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
                <Col gap={3} flex={1}>
                  <Text variant="label" weight="semibold" numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Row gap={10}>
                    <Text variant="mono" color={colors.ink} style={{ fontSize: 11, fontWeight: "600" }}>
                      {f.caloriesPer100g.toFixed(0)}
                      <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
                        kcal
                      </Text>
                    </Text>
                    <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
                      P{f.proteinPer100g.toFixed(0)}
                    </Text>
                    <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
                      C{f.carbsPer100g.toFixed(0)}
                    </Text>
                    <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
                      G{f.fatPer100g.toFixed(0)}
                    </Text>
                  </Row>
                </Col>
                <Feather name="chevron-right" size={14} color={colors.muted} />
              </Row>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
