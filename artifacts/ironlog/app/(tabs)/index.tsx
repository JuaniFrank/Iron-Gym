import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Heatmap } from "@/components/charts/Heatmap";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
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

  const todaySessions = sessions.filter((s) => s.endedAt && dateKey(s.endedAt) === todayKey);
  const completedToday = todaySessions.length > 0;

  const tdee = calculateTDEE(profile);
  const calorieGoal = profile.caloriesGoal ?? calorieGoalForGoal(tdee, profile.goal);

  const todayFoodEntries = foodEntries.filter((e) => dateKey(e.date) === todayKey);
  const consumedCalories = todayFoodEntries.reduce((sum, e) => {
    const food = allFoods.find((f) => f.id === e.foodItemId);
    if (!food) return sum;
    return sum + (food.caloriesPer100g * e.grams) / 100;
  }, 0);

  const last7Sessions = sessions.filter(
    (s) => s.endedAt && Date.now() - s.endedAt < 7 * 24 * 60 * 60 * 1000,
  );
  const weekVolume = last7Sessions.reduce((sum, s) => sum + s.totalVolumeKg, 0);

  const trainedDates = sessions.filter((s) => s.endedAt).map((s) => s.endedAt!);

  const greeting = (() => {
    const h = today.getHours();
    if (h < 6) return "Buenas noches";
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  return (
    <Screen scroll>
      <View style={{ paddingHorizontal: 0, marginBottom: 20 }}>
        <Text variant="caption" muted>
          {greeting}
        </Text>
        <Text variant="h1" style={{ marginTop: 2 }}>
          {profile.name}
        </Text>
      </View>

      {/* Today's workout hero */}
      {activeWorkoutId ? (
        <Pressable
          onPress={() => router.push("/workout/active")}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
        >
          <LinearGradient
            colors={["#FF6B35", "#FF4F1F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { borderRadius: colors.radius }]}
          >
            <View style={{ flex: 1 }}>
              <Text variant="tiny" color="rgba(255,255,255,0.9)">
                EN CURSO
              </Text>
              <Text variant="h3" color="#FFFFFF" style={{ marginTop: 4 }}>
                Continuar entrenamiento
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.85)">
                Tienes una sesión activa
              </Text>
            </View>
            <Feather name="play-circle" size={44} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      ) : todayRoutine && todayDay ? (
        <Pressable
          onPress={() => router.push(`/workout/active?routineId=${todayRoutine.id}&dayId=${todayDay.id}`)}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
        >
          <LinearGradient
            colors={["#FF6B35", "#E64A1A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { borderRadius: colors.radius }]}
          >
            <View style={{ flex: 1 }}>
              <Text variant="tiny" color="rgba(255,255,255,0.9)">
                HOY
              </Text>
              <Text variant="h3" color="#FFFFFF" style={{ marginTop: 4 }}>
                {todayDay.name}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.85)">
                {todayRoutine.name} · {todayDay.exercises.length} ejercicios
              </Text>
            </View>
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 24,
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="play" size={22} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </Pressable>
      ) : (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="calendar" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title">Día de descanso</Text>
              <Text variant="caption" muted>
                No tienes nada programado hoy
              </Text>
            </View>
            <Pressable onPress={() => router.push("/planning")}>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </Card>
      )}

      {/* Quick stats */}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
        <StatCard
          icon="zap"
          value={String(streak)}
          label={`${streak === 1 ? "Día" : "Días"} seguidos`}
          color={colors.primary}
        />
        <StatCard
          icon="award"
          value={String(sessions.filter((s) => s.endedAt).length)}
          label="Entrenamientos"
          color={colors.success}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        <StatCard
          icon="bar-chart-2"
          value={`${(weekVolume / 1000).toFixed(1)}t`}
          label="Volumen 7 días"
          color={colors.backColor}
        />
        <StatCard
          icon="pie-chart"
          value={`${Math.round(consumedCalories)}`}
          label={`/ ${calorieGoal} kcal`}
          color={colors.warning}
        />
      </View>

      {/* Heatmap */}
      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View>
            <Text variant="title">Actividad</Text>
            <Text variant="caption" muted>
              Últimas 18 semanas
            </Text>
          </View>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="activity" size={16} color={colors.primary} />
          </View>
        </View>
        <Heatmap trainedDates={trainedDates} weeks={18} cellSize={13} />
      </Card>

      {completedToday ? (
        <Card style={{ marginTop: 16, backgroundColor: colors.accent, borderColor: colors.primary }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Feather name="check-circle" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="title" color={colors.primary}>
                ¡Entrenamiento completado hoy!
              </Text>
              <Text variant="caption" color={colors.accentForeground}>
                Excelente trabajo. Recuerda comer bien y dormir.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Recent activity */}
      {sessions.filter((s) => s.endedAt).slice(-3).reverse().length > 0 ? (
        <View style={{ marginTop: 24 }}>
          <Text variant="h3" style={{ marginBottom: 12 }}>
            Sesiones recientes
          </Text>
          <View style={{ gap: 8 }}>
            {sessions
              .filter((s) => s.endedAt)
              .slice(-3)
              .reverse()
              .map((s) => (
                <Card key={s.id}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 4,
                        height: 36,
                        backgroundColor: colors.primary,
                        borderRadius: 2,
                        marginRight: 12,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="title" numberOfLines={1}>
                        {s.dayName}
                      </Text>
                      <Text variant="caption" muted numberOfLines={1}>
                        {s.sets.length} sets · {(s.totalVolumeKg / 1000).toFixed(1)}t
                      </Text>
                    </View>
                    {s.prsAchieved.length > 0 ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: colors.accent,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 12,
                        }}
                      >
                        <Feather name="trending-up" size={12} color={colors.primary} />
                        <Text variant="tiny" color={colors.primary} weight="bold">
                          {s.prsAchieved.length} PR
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
              ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  label: string;
  color: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: colors.radius,
        padding: 14,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: color + "20",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text variant="h2" style={{ fontSize: 24, lineHeight: 28 }}>
        {value}
      </Text>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
