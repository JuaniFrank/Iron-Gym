import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, View } from "react-native";

import { LineChart } from "@/components/charts/LineChart";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { calculateBMI, bmiCategory, formatWeight } from "@/utils/calculations";
import { dateKey, formatRelativeDate } from "@/utils/date";

export default function ProgressScreen() {
  const colors = useThemeColors();
  const { sessions, bodyWeights, profile, allExercises } = useIronLog();
  const [tab, setTab] = useState<"overview" | "exercises" | "body">("overview");

  const finished = sessions.filter((s) => s.endedAt);
  const screenWidth = Dimensions.get("window").width - 64;

  // Volume per week (last 8 weeks)
  const weekVolumes = useMemo(() => {
    const weeks: { weekStart: number; volume: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = new Date();
      ws.setHours(0, 0, 0, 0);
      ws.setDate(ws.getDate() - ws.getDay() - i * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      const vol = finished
        .filter((s) => s.endedAt! >= ws.getTime() && s.endedAt! < we.getTime())
        .reduce((sum, s) => sum + s.totalVolumeKg, 0);
      weeks.push({ weekStart: ws.getTime(), volume: vol });
    }
    return weeks;
  }, [finished]);

  // PRs all time
  const allPRs = finished.flatMap((s) => s.prsAchieved).sort((a, b) => b.achievedAt - a.achievedAt);

  // Top exercises by frequency
  const exerciseFreq = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of finished) {
      for (const exId of new Set(s.sets.map((set) => set.exerciseId))) {
        counts[exId] = (counts[exId] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({
        exercise: allExercises.find((e) => e.id === id),
        count,
        maxWeight: finished
          .flatMap((s) => s.sets.filter((x) => x.exerciseId === id && !x.isWarmup))
          .reduce((m, s) => Math.max(m, s.weight), 0),
      }))
      .filter((e) => e.exercise);
  }, [finished, allExercises]);

  const latestWeight = bodyWeights[bodyWeights.length - 1];
  const firstWeight = bodyWeights[0];
  const bmi = calculateBMI(latestWeight?.weightKg ?? profile.weightKg, profile.heightCm);
  const bmiCat = bmiCategory(bmi);

  return (
    <Screen scroll>
      <View style={{ marginBottom: 16 }}>
        <Text variant="h1">Progreso</Text>
        <Text variant="body" muted>
          {finished.length} {finished.length === 1 ? "sesión registrada" : "sesiones registradas"}
        </Text>
      </View>

      <SegmentedControl
        options={[
          { label: "Resumen", value: "overview" },
          { label: "Ejercicios", value: "exercises" },
          { label: "Cuerpo", value: "body" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <View style={{ marginTop: 16, gap: 12 }}>
          {/* Volume chart */}
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
              <View>
                <Text variant="title">Volumen semanal</Text>
                <Text variant="caption" muted>
                  Últimas 8 semanas
                </Text>
              </View>
              <Text variant="h3" color={colors.primary}>
                {(weekVolumes[weekVolumes.length - 1]?.volume ?? 0 / 1000).toFixed(1)}t
              </Text>
            </View>
            <LineChart
              data={weekVolumes.map((w, i) => ({ x: i, y: w.volume / 1000 }))}
              width={screenWidth}
              height={160}
              yLabelFormatter={(v) => `${v.toFixed(1)}t`}
            />
          </Card>

          {/* PRs */}
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View>
                <Text variant="title">Récords personales</Text>
                <Text variant="caption" muted>
                  {allPRs.length} {allPRs.length === 1 ? "PR" : "PRs"} totales
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
                <Feather name="trending-up" size={16} color={colors.primary} />
              </View>
            </View>
            {allPRs.length === 0 ? (
              <Text variant="body" muted style={{ textAlign: "center", paddingVertical: 12 }}>
                Aún no tienes PRs. Termina un entrenamiento para empezar.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {allPRs.slice(0, 5).map((pr) => (
                  <View
                    key={`${pr.exerciseId}-${pr.achievedAt}`}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text variant="label" weight="semibold" numberOfLines={1}>
                        {pr.exerciseName}
                      </Text>
                      <Text variant="caption" muted>
                        {formatRelativeDate(pr.achievedAt)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text variant="title" color={colors.primary}>
                        {formatWeight(pr.value, profile.units)}
                      </Text>
                      {pr.previousValue ? (
                        <Text variant="tiny" muted>
                          +{formatWeight(pr.value - pr.previousValue, profile.units)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Feather name="bar-chart-2" size={18} color={colors.foreground} />
              <Text variant="title" style={{ marginLeft: 8 }}>
                Estadísticas
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <MiniStat label="Total sets" value={String(finished.reduce((s, x) => s + x.sets.length, 0))} />
              <MiniStat
                label="Tiempo total"
                value={`${Math.round(
                  finished.reduce((s, x) => s + ((x.endedAt ?? 0) - x.startedAt), 0) / (1000 * 60 * 60),
                )}h`}
              />
              <MiniStat
                label="Volumen total"
                value={`${(finished.reduce((s, x) => s + x.totalVolumeKg, 0) / 1000).toFixed(1)}t`}
              />
              <MiniStat
                label="Promedio/sesión"
                value={
                  finished.length > 0
                    ? `${Math.round(finished.reduce((s, x) => s + x.totalVolumeKg, 0) / finished.length)}kg`
                    : "—"
                }
              />
            </View>
          </Card>
        </View>
      )}

      {tab === "exercises" && (
        <View style={{ marginTop: 16, gap: 8 }}>
          {exerciseFreq.length === 0 ? (
            <EmptyState
              icon="activity"
              title="Sin datos de ejercicios"
              description="Completa entrenamientos para ver tu progreso por ejercicio."
            />
          ) : (
            exerciseFreq.map((item) => (
              <Pressable
                key={item.exercise!.id}
                onPress={() => router.push(`/exercise-detail?id=${item.exercise!.id}` as never)}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <Card>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="label" weight="semibold" numberOfLines={1}>
                        {item.exercise!.name}
                      </Text>
                      <Text variant="caption" muted>
                        {item.count} {item.count === 1 ? "sesión" : "sesiones"}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text variant="title" color={colors.primary}>
                        {item.maxWeight > 0 ? formatWeight(item.maxWeight, profile.units) : "—"}
                      </Text>
                      <Text variant="tiny" muted>
                        Récord
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))
          )}
        </View>
      )}

      {tab === "body" && (
        <View style={{ marginTop: 16, gap: 12 }}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View>
                <Text variant="title">Peso corporal</Text>
                <Text variant="caption" muted>
                  {bodyWeights.length} {bodyWeights.length === 1 ? "registro" : "registros"}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push("/body")}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: colors.accent,
                  opacity: pressed ? 0.7 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                })}
              >
                <Feather name="plus" size={14} color={colors.primary} />
                <Text variant="caption" color={colors.primary} weight="semibold">
                  Registrar
                </Text>
              </Pressable>
            </View>
            {bodyWeights.length > 1 ? (
              <LineChart
                data={bodyWeights.map((b) => ({ x: b.date, y: b.weightKg }))}
                width={screenWidth}
                height={160}
                yLabelFormatter={(v) => `${v.toFixed(1)}`}
              />
            ) : (
              <Text variant="body" muted style={{ textAlign: "center", paddingVertical: 24 }}>
                Registra al menos 2 pesos para ver el gráfico
              </Text>
            )}
            {latestWeight && firstWeight && latestWeight.id !== firstWeight.id ? (
              <View style={{ flexDirection: "row", marginTop: 12, gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="tiny" muted>
                    ACTUAL
                  </Text>
                  <Text variant="h3">{formatWeight(latestWeight.weightKg, profile.units)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="tiny" muted>
                    CAMBIO
                  </Text>
                  <Text
                    variant="h3"
                    color={
                      latestWeight.weightKg < firstWeight.weightKg
                        ? colors.success
                        : colors.foreground
                    }
                  >
                    {(latestWeight.weightKg - firstWeight.weightKg > 0 ? "+" : "") +
                      formatWeight(latestWeight.weightKg - firstWeight.weightKg, profile.units)}
                  </Text>
                </View>
              </View>
            ) : null}
          </Card>

          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Feather name="info" size={18} color={colors.foreground} />
              <Text variant="title" style={{ marginLeft: 8 }}>
                Métricas
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.secondary,
                  padding: 12,
                  borderRadius: 12,
                }}
              >
                <Text variant="tiny" muted>
                  IMC
                </Text>
                <Text variant="h2">{bmi.toFixed(1)}</Text>
                <Text variant="caption" color={bmiCat.color} weight="semibold">
                  {bmiCat.label}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.secondary,
                  padding: 12,
                  borderRadius: 12,
                }}
              >
                <Text variant="tiny" muted>
                  PESO
                </Text>
                <Text variant="h2">
                  {(latestWeight?.weightKg ?? profile.weightKg).toFixed(1)}
                </Text>
                <Text variant="caption" muted>
                  kg
                </Text>
              </View>
            </View>
          </Card>

          <Pressable onPress={() => router.push("/body")}>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colors.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Feather name="image" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="title">Fotos y medidas</Text>
                  <Text variant="caption" muted>
                    Seguimiento corporal completo
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </View>
            </Card>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: "44%", flex: 1 }}>
      <Text variant="tiny" muted>
        {label.toUpperCase()}
      </Text>
      <Text variant="h3" style={{ marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}
