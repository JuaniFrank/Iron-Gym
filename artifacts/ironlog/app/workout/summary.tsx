import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import { CelebrationOverlay } from "@/components/celebration/CelebrationOverlay";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { ACHIEVEMENTS } from "@/constants/achievements";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { formatDuration } from "@/utils/date";

export default function WorkoutSummaryScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ sessionId: string; prs?: string; achievements?: string }>();
  const { sessions, getExerciseById } = useIronLog();
  const session = sessions.find((s) => s.id === params.sessionId);

  const [celebrate, setCelebrate] = useState<{ title: string; subtitle?: string; icon: any } | null>(null);
  const [shownIds, setShownIds] = useState<string[]>([]);

  const newAchievements = (params.achievements ?? "").split(",").filter(Boolean);
  const newPrs = parseInt(params.prs ?? "0", 10);

  // Show celebrations sequentially
  useEffect(() => {
    if (newPrs > 0 && !shownIds.includes("__pr")) {
      setCelebrate({
        title: `¡${newPrs} ${newPrs === 1 ? "récord nuevo" : "récords nuevos"}!`,
        subtitle: "Acabas de batir tus marcas anteriores.",
        icon: "trending-up",
      });
      setShownIds((s) => [...s, "__pr"]);
      return;
    }
    const next = newAchievements.find((id) => !shownIds.includes(id));
    if (next) {
      const ach = ACHIEVEMENTS.find((a) => a.id === next);
      if (ach) {
        setCelebrate({ title: ach.title, subtitle: ach.description, icon: ach.icon });
        setShownIds((s) => [...s, next]);
      }
    }
  }, [shownIds, newPrs, newAchievements]);

  if (!session) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title="Sesión no encontrada" />
      </Screen>
    );
  }

  const duration = (session.endedAt ?? Date.now()) - session.startedAt;
  const workSets = session.sets.filter((s) => !s.isWarmup);
  const totalReps = workSets.reduce((s, x) => s + x.reps, 0);
  const exercisesCount = new Set(session.sets.map((s) => s.exerciseId)).size;

  return (
    <Screen scroll>
      <View style={{ paddingTop: 16 }}>
        <LinearGradient
          colors={["#FF6B35", "#E64A1A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: colors.radius,
            padding: 24,
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "rgba(255,255,255,0.25)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Feather name="check" size={32} color="#FFFFFF" />
          </View>
          <Text variant="h2" color="#FFFFFF">
            ¡Sesión completada!
          </Text>
          <Text variant="body" color="rgba(255,255,255,0.9)" style={{ marginTop: 4 }}>
            {session.dayName}
          </Text>
        </LinearGradient>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <BigStat label="Duración" value={formatDuration(duration)} icon="clock" />
          <BigStat label="Volumen" value={`${Math.round(session.totalVolumeKg)}kg`} icon="bar-chart-2" />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
          <BigStat label="Sets" value={String(session.sets.length)} icon="layers" />
          <BigStat label="Reps" value={String(totalReps)} icon="repeat" />
          <BigStat label="Ejercicios" value={String(exercisesCount)} icon="activity" />
        </View>

        {session.prsAchieved.length > 0 ? (
          <Card style={{ marginBottom: 16, backgroundColor: colors.accent, borderColor: colors.primary }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Feather name="trending-up" size={20} color={colors.primary} />
              <Text variant="title" color={colors.primary} style={{ marginLeft: 8 }}>
                Récords personales
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {session.prsAchieved.map((pr) => (
                <View
                  key={pr.exerciseId}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text variant="label" color={colors.accentForeground} style={{ flex: 1 }}>
                    {pr.exerciseName}
                  </Text>
                  <Text variant="title" color={colors.primary}>
                    {pr.value} kg
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Text variant="title" style={{ marginBottom: 8 }}>
          Resumen por ejercicio
        </Text>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {Array.from(new Set(session.sets.map((s) => s.exerciseId))).map((exId) => {
            const ex = getExerciseById(exId);
            const sets = session.sets.filter((s) => s.exerciseId === exId && !s.isWarmup);
            const maxW = sets.reduce((m, s) => Math.max(m, s.weight), 0);
            const totalR = sets.reduce((s, x) => s + x.reps, 0);
            return (
              <Card key={exId}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label" weight="semibold">
                      {ex?.name ?? "Ejercicio"}
                    </Text>
                    <Text variant="caption" muted>
                      {sets.length} sets · {totalR} reps
                    </Text>
                  </View>
                  <Text variant="title" color={colors.primary}>
                    {maxW.toFixed(1)} kg
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>

        <Button
          label="Volver al inicio"
          icon="home"
          fullWidth
          size="lg"
          onPress={() => router.replace("/")}
        />
      </View>

      <CelebrationOverlay
        visible={!!celebrate}
        title={celebrate?.title ?? ""}
        subtitle={celebrate?.subtitle}
        icon={celebrate?.icon ?? "award"}
        onClose={() => setCelebrate(null)}
      />
    </Screen>
  );
}

function BigStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: any;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        padding: 12,
        borderRadius: colors.radius,
        alignItems: "center",
      }}
    >
      <Feather name={icon} size={16} color={colors.mutedForeground} />
      <Text variant="h3" style={{ marginTop: 6, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text variant="tiny" muted>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
