import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, View } from "react-native";

import { Heatmap } from "@/components/charts/Heatmap";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { calorieGoalForGoal, calculateTDEE } from "@/utils/calculations";
import { dateKey, getDayOfWeek } from "@/utils/date";

export default function HomeScreen() {
  const colors = useThemeColors();
  const {
    profile,
    sessions,
    foodEntries,
    schedule,
    allRoutines,
    activeWorkoutId,
    getStreak,
    allFoods,
  } = useIronLog();

  const streak = getStreak();
  const todayKey = dateKey(Date.now());
  const today = useMemo(() => new Date(), []);
  const dow = getDayOfWeek(today.getTime());

  const todayScheduled = schedule.find((s) => s.dayOfWeek === dow);
  const todayRoutine = todayScheduled
    ? allRoutines.find((r) => r.id === todayScheduled.routineId)
    : null;
  const todayDay = todayRoutine?.days.find((d) => d.id === todayScheduled?.routineDayId) ?? null;

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

  const heroPress = activeWorkoutId
    ? () => router.push("/workout/active")
    : todayRoutine && todayDay
      ? () => router.push(`/workout/active?routineId=${todayRoutine.id}&dayId=${todayDay.id}`)
      : undefined;

  const heroTitle = activeWorkoutId
    ? "Continuar"
    : todayRoutine && todayDay
      ? todayDay.name
      : "Día de";
  const heroItalic = activeWorkoutId
    ? "ahora"
    : todayRoutine && todayDay
      ? "hoy"
      : "descanso";
  const heroMeta = activeWorkoutId
    ? "Tienes una sesión activa"
    : todayRoutine && todayDay
      ? `${todayRoutine.name} · ${todayDay.exercises.length} ejercicios`
      : "Sin entrenamiento programado";

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
        onPress={heroPress}
        disabled={!heroPress}
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
              backgroundColor: colors.accent,
              opacity: 0.18,
            }}
          />
          <Row jc="space-between" ai="flex-start" style={{ marginBottom: 28 }}>
            <Text variant="tiny" color={colors.accent}>
              {activeWorkoutId ? "EN CURSO" : `HOY · ${dayName}`}
            </Text>
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
