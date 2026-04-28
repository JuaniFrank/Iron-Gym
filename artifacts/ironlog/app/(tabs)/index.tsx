import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, View } from "react-native";

import { Heatmap } from "@/components/charts/Heatmap";
import { DaySwapSheet } from "@/components/home/DaySwapSheet";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { calorieGoalForGoal, calculateTDEE } from "@/utils/calculations";
import { dateKey, startOfDay } from "@/utils/date";

export default function HomeScreen() {
  const colors = useThemeColors();
  const {
    profile,
    sessions,
    foodEntries,
    activeWorkoutId,
    getStreak,
    allFoods,
    allRoutines,
    getPlanForDate,
  } = useIronLog();

  const [swapOpen, setSwapOpen] = useState(false);

  const streak = getStreak();
  const todayKey = dateKey(Date.now());
  const today = useMemo(() => new Date(), []);
  const todayTs = useMemo(() => startOfDay(Date.now()), []);
  const todayPlan = getPlanForDate(todayTs);

  const todayRoutine =
    todayPlan.kind === "training"
      ? allRoutines.find((r) => r.id === todayPlan.routineId)
      : null;
  const todayDay =
    todayRoutine && todayPlan.kind === "training"
      ? todayRoutine.days.find((d) => d.id === todayPlan.routineDayId) ?? null
      : null;

  const finishedSessions = sessions.filter((s) => s.endedAt);
  const todaySessions = finishedSessions.filter((s) => dateKey(s.endedAt!) === todayKey);
  const completedToday = todaySessions.length > 0;

  const tdee = calculateTDEE(profile);
  const calorieGoal = profile.caloriesGoal ?? calorieGoalForGoal(tdee, profile.goal);

  const todayFoodEntries = foodEntries.filter((e) => dateKey(e.date) === todayKey);
  const consumedCalories = todayFoodEntries.reduce((sum, e) => {
    const food = allFoods.find((f) => f.id === e.foodItemId);
    if (!food) return sum;
    return sum + (food.caloriesPer100g * e.grams) / 100;
  }, 0);

  const last7Sessions = finishedSessions.filter(
    (s) => Date.now() - (s.endedAt ?? 0) < 7 * 24 * 60 * 60 * 1000,
  );
  const weekVolume = last7Sessions.reduce((sum, s) => sum + s.totalVolumeKg, 0);

  const trainedDates = finishedSessions.map((s) => s.endedAt!);
  const dayName = today.toLocaleDateString("es-ES", { weekday: "long" }).toUpperCase();

  const greeting = (() => {
    const h = today.getHours();
    if (h < 6) return "Buenas noches";
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  const recent = finishedSessions.slice(-3).reverse();
  const initials = profile.name.trim().slice(0, 1).toUpperCase() || "A";

  const isRest = todayPlan.kind === "rest";
  const showStartIcon = !!activeWorkoutId || (!isRest && !!todayRoutine && !!todayDay);

  const heroTitle = activeWorkoutId
    ? "Continuar"
    : !isRest && todayRoutine && todayDay
      ? todayDay.name
      : "Día de";
  const heroItalic = activeWorkoutId
    ? "ahora"
    : !isRest && todayRoutine && todayDay
      ? "hoy"
      : "descanso";
  const heroMeta = activeWorkoutId
    ? "Tienes una sesión activa"
    : !isRest && todayRoutine && todayDay
      ? `${todayRoutine.name} · ${todayDay.exercises.length} ejercicios`
      : "Tocá para entrenar igual";

  const triggerHaptic = (style: "light" | "medium" = "light") => {
    if (Platform.OS === "web") return;
    Haptics.impactAsync(
      style === "medium"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    );
  };

  const handleHeroPress = () => {
    if (activeWorkoutId) {
      router.push("/workout/active");
      return;
    }
    if (!isRest && todayRoutine && todayDay) {
      triggerHaptic();
      router.push(
        `/workout/active?routineId=${todayRoutine.id}&dayId=${todayDay.id}`,
      );
      return;
    }
    // Rest day: open the swap sheet so the user can train anyway.
    triggerHaptic();
    setSwapOpen(true);
  };

  const handleHeroLongPress = () => {
    triggerHaptic("medium");
    setSwapOpen(true);
  };

  return (
    <Screen scroll tabBarSpacing>
      {/* Greeting */}
      <Row jc="space-between" ai="flex-start" style={{ marginBottom: 28, paddingTop: 12 }}>
        <Col gap={6}>
          <Text variant="tiny" color={colors.muted}>
            {greeting}
          </Text>
          <Text variant="h1">{profile.name}</Text>
        </Col>
        <Pressable
          onPress={() => router.push("/profile")}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text variant="label" weight="semibold">
            {initials}
          </Text>
        </Pressable>
      </Row>

      {/* Hero card */}
      <Pressable
        onPress={handleHeroPress}
        onLongPress={handleHeroLongPress}
        delayLongPress={350}
        style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
      >
        <View
          style={{
            backgroundColor: colors.ink,
            borderRadius: 24,
            padding: 22,
            position: "relative",
            overflow: "hidden",
            marginBottom: 14,
          }}
        >
          <View
            style={{
              position: "absolute",
              right: -30,
              top: -30,
              width: 200,
              height: 200,
              borderRadius: 999,
              backgroundColor: isRest ? "rgba(242,240,232,0.06)" : colors.accent,
              opacity: isRest ? 1 : 0.18,
            }}
          />
          <Row jc="space-between" ai="flex-start" style={{ marginBottom: 28 }}>
            <Row gap={6} ai="center">
              <Text
                variant="tiny"
                color={isRest && !activeWorkoutId ? "rgba(242,240,232,0.55)" : colors.accent}
              >
                {activeWorkoutId ? "EN CURSO" : `HOY · ${dayName}`}
              </Text>
              {todayPlan.isOverride && !activeWorkoutId ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: "rgba(201,242,77,0.18)",
                  }}
                >
                  <Text variant="tiny" color={colors.accent}>
                    AJUSTADO
                  </Text>
                </View>
              ) : null}
            </Row>

            {showStartIcon ? (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather
                  name={activeWorkoutId ? "play-circle" : "play"}
                  size={16}
                  color={colors.accentInk}
                />
              </View>
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather
                  name="moon"
                  size={18}
                  color="rgba(242,240,232,0.55)"
                />
              </View>
            )}
          </Row>
          <Text variant="hero" color={colors.bg}>
            {heroTitle}{" "}
            <Text variant="hero" color={colors.bg} italic style={{ fontWeight: "300" }}>
              {heroItalic}
            </Text>
          </Text>
          <Row gap={8} style={{ marginTop: 14 }}>
            <Text variant="caption" color="rgba(242,240,232,0.65)">
              {heroMeta}
            </Text>
          </Row>
          <Text
            variant="tiny"
            color="rgba(242,240,232,0.35)"
            style={{ marginTop: 10 }}
          >
            MANTENER PARA CAMBIAR DE DÍA
          </Text>
        </View>
      </Pressable>

      {/* Metrics rail */}
      <Card padding={0} style={{ marginBottom: 14 }}>
        <Row jc="space-between" style={{ paddingVertical: 16, paddingHorizontal: 4 }}>
          <MetricCell label="RACHA" value={String(streak)} sub="días" />
          <Divider vertical />
          <MetricCell label="SESIONES" value={String(finishedSessions.length)} sub="totales" />
          <Divider vertical />
          <MetricCell
            label="VOL · 7D"
            value={(weekVolume / 1000).toFixed(1)}
            sub="t"
            highlight
          />
          <Divider vertical />
          <MetricCell
            label="KCAL"
            value={String(Math.round(consumedCalories))}
            sub={`/ ${calorieGoal}`}
          />
        </Row>
      </Card>

      {/* Heatmap */}
      <Card style={{ marginBottom: 14 }}>
        <Row jc="space-between" ai="flex-start" style={{ marginBottom: 16 }}>
          <Col gap={4}>
            <Text variant="h3">Actividad</Text>
            <Text variant="caption" muted>
              Últimas 18 semanas
            </Text>
          </Col>
          <Text variant="tiny" color={colors.muted}>
            {finishedSessions.length} / 126 días
          </Text>
        </Row>
        <Heatmap trainedDates={trainedDates} weeks={18} />
      </Card>

      {completedToday ? (
        <Card variant="accent" style={{ marginBottom: 14 }}>
          <Row gap={12}>
            <Feather name="check-circle" size={20} color={colors.accentEdge} />
            <Col gap={2} flex={1}>
              <Text variant="title" color={colors.accentEdge}>
                ¡Entrenamiento completado!
              </Text>
              <Text variant="caption" muted>
                Recuerda comer bien y dormir.
              </Text>
            </Col>
          </Row>
        </Card>
      ) : null}

      {/* Recent sessions */}
      {recent.length > 0 ? (
        <>
          <Text
            variant="tiny"
            color={colors.muted}
            style={{ paddingHorizontal: 4, paddingVertical: 10 }}
          >
            SESIONES RECIENTES
          </Text>
          <Col gap={8}>
            {recent.map((s) => (
              <Card key={s.id} padding={0}>
                <Row jc="space-between" style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                  <Row gap={12} flex={1}>
                    <View
                      style={{
                        width: 3,
                        alignSelf: "stretch",
                        backgroundColor: colors.accent,
                        borderRadius: 2,
                      }}
                    />
                    <Col gap={2} flex={1}>
                      <Text variant="title" numberOfLines={1}>
                        {s.dayName}
                      </Text>
                      <Text variant="caption" muted numberOfLines={1}>
                        {s.sets.length} sets · {(s.totalVolumeKg / 1000).toFixed(1)}t
                      </Text>
                    </Col>
                  </Row>
                  {s.prsAchieved.length > 0 ? (
                    <Badge label={`${s.prsAchieved.length} PR`} />
                  ) : null}
                </Row>
              </Card>
            ))}
          </Col>
        </>
      ) : null}

      <DaySwapSheet visible={swapOpen} onClose={() => setSwapOpen(false)} />
    </Screen>
  );
}

function MetricCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <Col gap={4} ai="center" flex={1} style={{ paddingHorizontal: 4 }}>
      <Text variant="tiny" color={colors.muted}>
        {label}
      </Text>
      <View
        style={{
          backgroundColor: highlight ? colors.accent : "transparent",
          paddingHorizontal: highlight ? 6 : 0,
          borderRadius: 4,
        }}
      >
        <Text variant="monoLg" color={colors.ink}>
          {value}
        </Text>
      </View>
      {sub ? (
        <Text variant="caption" muted>
          {sub}
        </Text>
      ) : null}
    </Col>
  );
}
