import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { Dimensions, ScrollView, View } from "react-native";

import { LineChart } from "@/components/charts/LineChart";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { EXERCISE_TYPE_LABELS, MUSCLE_GROUP_LABELS } from "@/constants/exercises";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { formatWeight } from "@/utils/calculations";
import { formatDateShort, formatRelativeDate } from "@/utils/date";

export default function ExerciseDetailScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ id: string }>();
  const { sessions, getExerciseById, profile } = useIronLog();
  const ex = getExerciseById(params.id);
  const screenWidth = Dimensions.get("window").width - 64;

  const data = useMemo(() => {
    if (!ex) return [];
    const points: { x: number; y: number; date: number }[] = [];
    for (const s of sessions.filter((x) => x.endedAt)) {
      const sets = s.sets.filter((set) => set.exerciseId === ex.id && !set.isWarmup);
      if (sets.length === 0) continue;
      const maxWeight = Math.max(...sets.map((set) => set.weight));
      points.push({ x: s.endedAt!, y: maxWeight, date: s.endedAt! });
    }
    return points.sort((a, b) => a.x - b.x);
  }, [sessions, ex]);

  if (!ex) {
    return (
      <Screen>
        <Header title="Ejercicio" back />
        <EmptyState icon="alert-circle" title="No encontrado" />
      </Screen>
    );
  }

  const allSets = sessions
    .filter((s) => s.endedAt)
    .flatMap((s) => s.sets.filter((set) => set.exerciseId === ex.id && !set.isWarmup));
  const maxWeight = allSets.reduce((m, s) => Math.max(m, s.weight), 0);
  const totalVolume = allSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const totalReps = allSets.reduce((s, x) => s + x.reps, 0);

  return (
    <Screen noPadding>
      <Header title={ex.name} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card>
          <Text variant="caption" muted>
            {EXERCISE_TYPE_LABELS[ex.type]} · {MUSCLE_GROUP_LABELS[ex.primaryMuscle]}
          </Text>
          <Text variant="body" style={{ marginTop: 8 }}>
            {ex.description}
          </Text>
        </Card>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stat label="Récord" value={maxWeight > 0 ? formatWeight(maxWeight, profile.units) : "—"} icon="trending-up" />
          <Stat label="Volumen" value={`${(totalVolume / 1000).toFixed(1)}t`} icon="bar-chart-2" />
          <Stat label="Reps" value={String(totalReps)} icon="repeat" />
        </View>

        <Card>
          <Text variant="title" style={{ marginBottom: 12 }}>
            Progreso de peso máximo
          </Text>
          {data.length > 1 ? (
            <LineChart
              data={data.map((d, i) => ({ x: i, y: d.y }))}
              width={screenWidth}
              height={180}
              yLabelFormatter={(v) => `${v.toFixed(0)}kg`}
            />
          ) : (
            <Text variant="body" muted style={{ textAlign: "center", paddingVertical: 24 }}>
              Necesitas al menos 2 sesiones para ver el gráfico
            </Text>
          )}
        </Card>

        <Card>
          <Text variant="title" style={{ marginBottom: 12 }}>
            Historial reciente
          </Text>
          {sessions.filter((s) => s.endedAt && s.sets.some((set) => set.exerciseId === ex.id)).slice(-5).reverse().length === 0 ? (
            <Text variant="body" muted style={{ textAlign: "center", paddingVertical: 12 }}>
              Sin sesiones registradas
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {sessions
                .filter((s) => s.endedAt && s.sets.some((set) => set.exerciseId === ex.id))
                .slice(-5)
                .reverse()
                .map((s) => {
                  const sets = s.sets.filter((x) => x.exerciseId === ex.id && !x.isWarmup);
                  const max = sets.reduce((m, x) => Math.max(m, x.weight), 0);
                  return (
                    <View
                      key={s.id}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View>
                        <Text variant="label" weight="semibold">
                          {formatDateShort(s.endedAt!)}
                        </Text>
                        <Text variant="caption" muted>
                          {sets.length} sets · {formatRelativeDate(s.endedAt!)}
                        </Text>
                      </View>
                      <Text variant="title" color={colors.primary}>
                        {formatWeight(max, profile.units)}
                      </Text>
                    </View>
                  );
                })}
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: any }) {
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
      <Text variant="title" style={{ marginTop: 6 }}>
        {value}
      </Text>
      <Text variant="tiny" muted>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
