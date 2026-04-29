import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Dimensions, Modal, Pressable, View } from "react-native";

import { LineChart } from "@/components/charts/LineChart";
import { MuscleVolumeBar } from "@/components/charts/MuscleVolumeBar";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Col, Row } from "@/components/ui/Stack";
import { Stat } from "@/components/ui/Stat";
import { Text } from "@/components/ui/Text";
import { MUSCLE_GROUPS } from "@/constants/exercises";
import { resolveVolumeTarget } from "@/constants/volumeTargets";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { MuscleGroup } from "@/types";
import { bmiCategory, calculateBMI, formatWeight } from "@/utils/calculations";
import { formatRelativeDate } from "@/utils/date";
import { currentWeekRange, volumeByMuscle, volumeZone } from "@/utils/volume";

export default function ProgressScreen() {
  const colors = useThemeColors();
  const { sessions, bodyWeights, profile, allExercises } = useIronLog();
  const [tab, setTab] = useState<"overview" | "exercises" | "body">("overview");
  const [volumeInfoOpen, setVolumeInfoOpen] = useState(false);

  const finished = sessions.filter((s) => s.endedAt);
  const screenWidth = Dimensions.get("window").width - 76;

  // Volume by muscle (this week — includes in-flight session if any)
  const [weekStart, weekEnd] = useMemo(() => currentWeekRange(), []);
  const muscleVolume = useMemo(
    () => volumeByMuscle(sessions, allExercises, weekStart, weekEnd),
    [sessions, allExercises, weekStart, weekEnd],
  );
  const muscleVolumeRows = useMemo(
    () =>
      MUSCLE_GROUPS.map((m) => {
        const target = resolveVolumeTarget(m as MuscleGroup, profile.volumeTargets);
        const sets = muscleVolume[m as MuscleGroup];
        const zone = volumeZone(sets, target);
        return { muscle: m as MuscleGroup, sets, target, zone };
      }),
    [muscleVolume, profile.volumeTargets],
  );
  const totalEffectiveSetsThisWeek = muscleVolumeRows.reduce(
    (sum, r) => sum + r.sets,
    0,
  );
  const musclesInEffective = muscleVolumeRows.filter(
    (r) => r.zone === "effective" || r.zone === "overload",
  ).length;

  const weekVolumes = useMemo(() => {
    const weeks: { volume: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = new Date();
      ws.setHours(0, 0, 0, 0);
      ws.setDate(ws.getDate() - ws.getDay() - i * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      const vol = finished
        .filter((s) => s.endedAt! >= ws.getTime() && s.endedAt! < we.getTime())
        .reduce((sum, s) => sum + s.totalVolumeKg, 0);
      weeks.push({ volume: vol });
    }
    return weeks;
  }, [finished]);

  const allPRs = finished
    .flatMap((s) => s.prsAchieved)
    .sort((a, b) => b.achievedAt - a.achievedAt);

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

  const lastWeekVol = weekVolumes[weekVolumes.length - 1]?.volume ?? 0;
  const prevWeekVol = weekVolumes[weekVolumes.length - 2]?.volume ?? 0;
  const volDelta = prevWeekVol > 0 ? ((lastWeekVol - prevWeekVol) / prevWeekVol) * 100 : 0;

  return (
    <Screen scroll noPadding tabBarSpacing>
      <Header
        title="Progreso"
        subtitle={`${finished.length} ${finished.length === 1 ? "sesión registrada" : "sesiones registradas"}`}
      />
      <View style={{ paddingHorizontal: 20 }}>
        <SegmentedControl
          options={[
            { label: "Resumen", value: "overview" },
            { label: "Ejercicios", value: "exercises" },
            { label: "Cuerpo", value: "body" },
          ]}
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 14 }}
        />

        {tab === "overview" && (
          <Col gap={14}>
            {/* Volume per muscle (this week) */}
            <Card>
              <Row jc="space-between" ai="flex-start" style={{ marginBottom: 6 }}>
                <Col gap={4} flex={1}>
                  <Text variant="h3">Volumen por músculo</Text>
                  <Text variant="caption" muted>
                    Esta semana ·{" "}
                    {totalEffectiveSetsThisWeek === 0
                      ? "sin sets aún"
                      : `${musclesInEffective}/${MUSCLE_GROUPS.length} músculos en zona efectiva`}
                  </Text>
                </Col>
                <Pressable
                  onPress={() => setVolumeInfoOpen(true)}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Feather name="help-circle" size={14} color={colors.muted} />
                </Pressable>
              </Row>

              {totalEffectiveSetsThisWeek === 0 ? (
                <View
                  style={{
                    paddingVertical: 24,
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Feather name="activity" size={22} color={colors.muted} />
                  <Text variant="body" muted style={{ textAlign: "center" }}>
                    Logueá sets esta semana para ver{"\n"}tu volumen por grupo muscular.
                  </Text>
                </View>
              ) : (
                <Col gap={2} style={{ marginTop: 4 }}>
                  {muscleVolumeRows
                    // Hide muscles with 0 sets and 0 MEV to avoid noise (e.g. forearms/abs).
                    .filter((r) => r.sets > 0 || r.target.mev > 0)
                    .map((r) => (
                      <MuscleVolumeBar
                        key={r.muscle}
                        muscle={r.muscle}
                        sets={r.sets}
                        target={r.target}
                      />
                    ))}
                </Col>
              )}
            </Card>

            {/* Weekly volume trend */}
            <Card>
              <Row jc="space-between" style={{ marginBottom: 8 }}>
                <Col gap={4}>
                  <Text variant="h3">Volumen semanal</Text>
                  <Text variant="caption" muted>
                    Últimas 8 semanas
                  </Text>
                </Col>
                <Col gap={2} ai="flex-end">
                  <Text variant="monoLg">
                    {(lastWeekVol / 1000).toFixed(1)}
                    <Text variant="caption" color={colors.muted}>
                      {" "}t
                    </Text>
                  </Text>
                  {volDelta !== 0 ? (
                    <Text
                      variant="tiny"
                      color={volDelta >= 0 ? colors.ok : colors.danger}
                    >
                      {volDelta >= 0 ? "+" : ""}
                      {volDelta.toFixed(1)}% vs sem. ant.
                    </Text>
                  ) : null}
                </Col>
              </Row>
              <LineChart
                data={weekVolumes.map((w, i) => ({ x: i, y: w.volume / 1000 }))}
                width={screenWidth}
                height={110}
              />
            </Card>

            {/* PRs */}
            <Card>
              <Row jc="space-between" style={{ marginBottom: 14 }}>
                <Col gap={4}>
                  <Text variant="h3">Récords personales</Text>
                  <Text variant="caption" muted>
                    {allPRs.length} {allPRs.length === 1 ? "PR" : "PRs"} totales
                  </Text>
                </Col>
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
                  <Feather name="trending-up" size={16} color={colors.accentInk} />
                </View>
              </Row>
              {allPRs.length === 0 ? (
                <Text variant="body" muted style={{ textAlign: "center", paddingVertical: 12 }}>
                  Aún no tienes PRs. Termina un entrenamiento para empezar.
                </Text>
              ) : (
                <Col gap={0}>
                  {allPRs.slice(0, 5).map((pr, i) => (
                    <React.Fragment key={`${pr.exerciseId}-${pr.achievedAt}`}>
                      {i > 0 ? <Divider /> : null}
                      <Row jc="space-between" style={{ paddingVertical: 12 }}>
                        <Col gap={2}>
                          <Text variant="label" weight="semibold">
                            {pr.exerciseName}
                          </Text>
                          <Text variant="caption" muted>
                            {formatRelativeDate(pr.achievedAt)}
                          </Text>
                        </Col>
                        <Col gap={2} ai="flex-end">
                          <Text variant="mono" color={colors.ink} style={{ fontSize: 16, fontWeight: "600" }}>
                            {pr.value}
                            <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
                              kg
                            </Text>
                          </Text>
                          {pr.previousValue ? (
                            <Text variant="tiny" color={colors.ok}>
                              +{(pr.value - pr.previousValue).toFixed(1)}kg
                            </Text>
                          ) : null}
                        </Col>
                      </Row>
                    </React.Fragment>
                  ))}
                </Col>
              )}
            </Card>

            <Card>
              <Row gap={8} style={{ marginBottom: 14 }}>
                <Feather name="bar-chart-2" size={16} color={colors.ink} />
                <Text variant="h3">Estadísticas</Text>
              </Row>
              <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16, columnGap: 16 }}>
                <View style={{ width: "44%", flexGrow: 1 }}>
                  <Stat
                    label="TOTAL SETS"
                    value={String(finished.reduce((s, x) => s + x.sets.length, 0)).toLocaleString()}
                  />
                </View>
                <View style={{ width: "44%", flexGrow: 1 }}>
                  <Stat
                    label="TIEMPO TOTAL"
                    value={`${Math.round(
                      finished.reduce(
                        (s, x) => s + ((x.endedAt ?? 0) - x.startedAt),
                        0,
                      ) /
                        (1000 * 60 * 60),
                    )}h`}
                  />
                </View>
                <View style={{ width: "44%", flexGrow: 1 }}>
                  <Stat
                    label="VOLUMEN TOTAL"
                    value={`${(finished.reduce((s, x) => s + x.totalVolumeKg, 0) / 1000).toFixed(1)}t`}
                  />
                </View>
                <View style={{ width: "44%", flexGrow: 1 }}>
                  <Stat
                    label="MEDIA / SESIÓN"
                    value={
                      finished.length > 0
                        ? `${(
                            finished.reduce((s, x) => s + x.totalVolumeKg, 0) /
                            finished.length /
                            1000
                          ).toFixed(1)}t`
                        : "—"
                    }
                  />
                </View>
              </View>
            </Card>
          </Col>
        )}

        {tab === "exercises" && (
          <Col gap={8}>
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
                  onPress={() =>
                    router.push(`/exercise-detail?id=${item.exercise!.id}` as never)
                  }
                  style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
                >
                  <Card padding={0}>
                    <Row jc="space-between" style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                      <Col gap={4} flex={1}>
                        <Text variant="label" weight="semibold" numberOfLines={1}>
                          {item.exercise!.name}
                        </Text>
                        <Text variant="caption" muted>
                          {item.count} {item.count === 1 ? "sesión" : "sesiones"}
                        </Text>
                      </Col>
                      <Col gap={2} ai="flex-end">
                        <Text variant="mono" color={colors.ink} style={{ fontSize: 16, fontWeight: "600" }}>
                          {item.maxWeight > 0
                            ? formatWeight(item.maxWeight, profile.units)
                            : "—"}
                        </Text>
                        <Text variant="tiny" color={colors.muted}>
                          RÉCORD
                        </Text>
                      </Col>
                    </Row>
                  </Card>
                </Pressable>
              ))
            )}
          </Col>
        )}

        {tab === "body" && (
          <Col gap={14}>
            <Card>
              <Row jc="space-between" style={{ marginBottom: 12 }}>
                <Col gap={4}>
                  <Text variant="h3">Peso corporal</Text>
                  <Text variant="caption" muted>
                    {bodyWeights.length} {bodyWeights.length === 1 ? "registro" : "registros"}
                  </Text>
                </Col>
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
                  <Feather name="plus" size={12} color={colors.accentInk} />
                  <Text variant="label" weight="semibold" color={colors.accentInk}>
                    Registrar
                  </Text>
                </Pressable>
              </Row>
              {bodyWeights.length > 1 ? (
                <LineChart
                  data={bodyWeights.map((b, i) => ({ x: i, y: b.weightKg }))}
                  width={screenWidth}
                  height={110}
                />
              ) : (
                <Text variant="body" muted style={{ textAlign: "center", paddingVertical: 24 }}>
                  Registra al menos 2 pesos para ver el gráfico
                </Text>
              )}
              {latestWeight && firstWeight && latestWeight.id !== firstWeight.id ? (
                <Row
                  gap={16}
                  style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Col gap={4} flex={1}>
                    <Text variant="tiny" color={colors.muted}>
                      ACTUAL
                    </Text>
                    <Text variant="monoLg">
                      {formatWeight(latestWeight.weightKg, profile.units)}
                    </Text>
                  </Col>
                  <Divider vertical />
                  <Col gap={4} flex={1}>
                    <Text variant="tiny" color={colors.muted}>
                      CAMBIO
                    </Text>
                    <Row gap={4}>
                      <Feather
                        name={
                          latestWeight.weightKg < firstWeight.weightKg
                            ? "arrow-down"
                            : "arrow-up"
                        }
                        size={16}
                        color={
                          latestWeight.weightKg < firstWeight.weightKg
                            ? colors.ok
                            : colors.ink
                        }
                      />
                      <Text
                        variant="monoLg"
                        color={
                          latestWeight.weightKg < firstWeight.weightKg
                            ? colors.ok
                            : colors.ink
                        }
                      >
                        {Math.abs(latestWeight.weightKg - firstWeight.weightKg).toFixed(1)}
                        <Text variant="caption" color={colors.muted}>
                          {" "}kg
                        </Text>
                      </Text>
                    </Row>
                  </Col>
                </Row>
              ) : null}
            </Card>

            <Card>
              <Row gap={8} style={{ marginBottom: 14 }}>
                <Feather name="info" size={14} color={colors.muted} />
                <Text variant="h3">Métricas</Text>
              </Row>
              <Row gap={12}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surfaceAlt,
                    padding: 16,
                    borderRadius: 14,
                  }}
                >
                  <Text variant="tiny" color={colors.muted}>
                    IMC
                  </Text>
                  <Text variant="h2" style={{ marginTop: 6 }}>
                    {bmi.toFixed(1)}
                  </Text>
                  <Text
                    variant="caption"
                    color={bmiCat.color === "#10B981" ? colors.ok : bmiCat.color}
                    weight="semibold"
                    style={{ marginTop: 4 }}
                  >
                    {bmiCat.label}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surfaceAlt,
                    padding: 16,
                    borderRadius: 14,
                  }}
                >
                  <Text variant="tiny" color={colors.muted}>
                    PESO
                  </Text>
                  <Text variant="h2" style={{ marginTop: 6 }}>
                    {(latestWeight?.weightKg ?? profile.weightKg).toFixed(1)}
                  </Text>
                  <Text variant="caption" muted style={{ marginTop: 4 }}>
                    kg
                  </Text>
                </View>
              </Row>
            </Card>

            <Pressable onPress={() => router.push("/body")}>
              <Card padding={0}>
                <Row jc="space-between" style={{ paddingHorizontal: 18, paddingVertical: 16 }}>
                  <Row gap={12}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: colors.accentSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name="image" size={18} color={colors.accentEdge} />
                    </View>
                    <Col gap={2}>
                      <Text variant="title">Fotos y medidas</Text>
                      <Text variant="caption" muted>
                        Seguimiento corporal completo
                      </Text>
                    </Col>
                  </Row>
                  <Feather name="chevron-right" size={16} color={colors.muted} />
                </Row>
              </Card>
            </Pressable>
          </Col>
        )}
      </View>

      <VolumeInfoModal
        visible={volumeInfoOpen}
        onClose={() => setVolumeInfoOpen(false)}
      />
    </Screen>
  );
}

function VolumeInfoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
        }}
      >
        <Pressable onPress={() => undefined}>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 22,
              padding: 22,
              width: 320,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Row gap={8} ai="center" style={{ marginBottom: 12 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="activity" size={14} color={colors.accentEdge} />
              </View>
              <Text variant="h3">Cómo se mide</Text>
            </Row>
            <Text variant="body" muted style={{ marginBottom: 14 }}>
              Cada set efectivo (sin warmup, sin saltado) suma 1 al músculo
              principal y 0,5 a cada secundario.
            </Text>

            <Col gap={10} style={{ marginBottom: 16 }}>
              <ZoneRow
                label="MEV"
                description="Mínimo efectivo. Por debajo cuesta crecer."
                color={colors.muted}
              />
              <ZoneRow
                label="MAV"
                description="Volumen productivo típico. La meta semanal."
                color={colors.ok}
              />
              <ZoneRow
                label="MRV"
                description="Tope recuperable. Pasarte acumula fatiga."
                color={colors.danger}
              />
            </Col>

            <Text variant="caption" muted>
              Los valores son orientativos (Renaissance Periodization). Ajustá
              según cómo te recuperás.
            </Text>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                marginTop: 16,
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.ink,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text variant="label" weight="semibold" color={colors.bg}>
                Entendido
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ZoneRow({
  label,
  description,
  color,
}: {
  label: string;
  description: string;
  color: string;
}) {
  return (
    <Row gap={10} ai="flex-start">
      <View
        style={{
          width: 4,
          height: 18,
          borderRadius: 2,
          backgroundColor: color,
          marginTop: 2,
        }}
      />
      <Col flex={1} gap={1}>
        <Text variant="label" weight="semibold">
          {label}
        </Text>
        <Text variant="caption" muted>
          {description}
        </Text>
      </Col>
    </Row>
  );
}
