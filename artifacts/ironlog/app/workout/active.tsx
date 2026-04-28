import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { IconButton } from "@/components/ui/IconButton";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { RestTimer } from "@/components/workout/RestTimer";
import { SetRow } from "@/components/workout/SetRow";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { formatDuration } from "@/utils/date";

export default function ActiveWorkoutScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ routineId?: string; dayId?: string }>();
  const {
    sessions,
    activeWorkoutId,
    startWorkout,
    logSet,
    removeSet,
    finishWorkout,
    cancelWorkout,
    getExerciseById,
    getRoutineById,
    getLastSetsForExercise,
    getMaxWeightForExercise,
    defaultRestSeconds,
  } = useIronLog();

  const startedRef = useRef(false);
  useEffect(() => {
    if (!activeWorkoutId && params.routineId && params.dayId && !startedRef.current) {
      startedRef.current = true;
      startWorkout(params.routineId, params.dayId);
    }
  }, [activeWorkoutId, params.routineId, params.dayId, startWorkout]);

  const session = sessions.find((s) => s.id === activeWorkoutId);
  const routine = session?.routineId ? getRoutineById(session.routineId) : null;
  const day = routine?.days.find((d) => d.id === session?.routineDayId) ?? null;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [restingFor, setRestingFor] = useState<number | null>(null);

  if (!session) {
    return (
      <Screen>
        <Header title="Sesión" back />
        <EmptyState
          icon="zap"
          title="Sin sesión activa"
          description="Inicia una rutina para empezar a registrar."
          actionLabel="Ver rutinas"
          onAction={() => router.replace("/workout")}
        />
      </Screen>
    );
  }

  const elapsed = now - session.startedAt;
  const completedSets = session.sets;
  const completedSetsCount = completedSets.filter((s) => !s.isWarmup).length;
  const totalVolume = completedSets
    .filter((s) => !s.isWarmup)
    .reduce((sum, s) => sum + s.weight * s.reps, 0);

  // Total target work-set count across exercises in this session.
  const targetTotal = session.exerciseOrder.reduce((sum, exId) => {
    const re = day?.exercises.find((x) => x.exerciseId === exId);
    return sum + (re?.targetSets ?? 3);
  }, 0);

  const handleAddExercise = () => {
    router.push(`/exercises?sessionId=${session.id}` as never);
  };

  const handleFinish = () => {
    if (completedSetsCount === 0) {
      Alert.alert("Sin sets", "Registra al menos un set antes de terminar.");
      return;
    }
    Alert.alert("Terminar sesión", "¿Quieres terminar el entrenamiento?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Terminar",
        onPress: () => {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          const result = finishWorkout(session.id);
          router.replace(
            `/workout/summary?sessionId=${result.session.id}&prs=${result.prs.length}&achievements=${result.newAchievements.join(",")}`,
          );
        },
      },
    ]);
  };

  const handleCancel = () => {
    Alert.alert(
      "Descartar sesión",
      "¿Descartar este entrenamiento? Se perderán los sets registrados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: () => {
            cancelWorkout(session.id);
            router.replace("/workout");
          },
        },
      ],
    );
  };

  return (
    <Screen noPadding>
      {/* Header strip: down chevron · "EN SESIÓN · Day" · close */}
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
        <Col gap={2} ai="center">
          <Text variant="tiny" color={colors.muted}>
            EN SESIÓN
          </Text>
          <Text variant="label" weight="semibold">
            {session.dayName}
          </Text>
        </Col>
        <IconButton icon="x" onPress={handleCancel} color={colors.danger} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 120 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary tiles */}
        <Card padding={0} style={{ marginBottom: 12 }}>
          <Row jc="space-between" style={{ paddingVertical: 14 }}>
            <SummaryCol label="DURACIÓN" value={formatDuration(elapsed)} />
            <Divider vertical />
            <SummaryCol
              label="SETS"
              value={
                <Text variant="mono" color={colors.ink} style={{ fontSize: 18, fontWeight: "600" }}>
                  {completedSetsCount}
                  {targetTotal > 0 ? (
                    <Text variant="mono" color={colors.muted} style={{ fontSize: 18 }}>
                      /{targetTotal}
                    </Text>
                  ) : null}
                </Text>
              }
            />
            <Divider vertical />
            <SummaryCol
              label="VOLUMEN"
              value={
                <Text variant="mono" color={colors.ink} style={{ fontSize: 18, fontWeight: "600" }}>
                  {Math.round(totalVolume).toLocaleString()}
                  <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
                    kg
                  </Text>
                </Text>
              }
            />
          </Row>
        </Card>

        {restingFor != null ? (
          <View style={{ marginBottom: 12 }}>
            <RestTimer
              durationSeconds={restingFor}
              onClose={() => setRestingFor(null)}
              onComplete={() => setRestingFor(null)}
            />
          </View>
        ) : null}

        <Col gap={12}>
          {session.exerciseOrder.map((exId) => {
            const ex = getExerciseById(exId);
            if (!ex) return null;
            const re = day?.exercises.find((x) => x.exerciseId === exId);
            const targetSets = re?.targetSets ?? 3;
            const targetReps = re?.targetReps ?? 10;
            const warmupSets = re?.warmupSets ?? 0;
            const restSeconds = re?.restSeconds ?? defaultRestSeconds;

            const completedForExercise = session.sets.filter((s) => s.exerciseId === exId);
            const lastSets = getLastSetsForExercise(exId, session.id);
            const exerciseMax = getMaxWeightForExercise(exId);

            const totalRows = Math.max(
              warmupSets + targetSets,
              completedForExercise.length + 1,
            );
            const rows: { isWarmup: boolean; index: number }[] = [];
            for (let i = 0; i < warmupSets; i++) rows.push({ isWarmup: true, index: i + 1 });
            let workIndex = 0;
            for (let i = warmupSets; i < totalRows; i++) {
              workIndex++;
              rows.push({ isWarmup: false, index: workIndex });
            }

            // First incomplete row → active.
            const firstIncomplete = rows.findIndex((row) => {
              const c = completedForExercise.filter((s) => s.isWarmup === row.isWarmup)[
                row.index - 1
              ];
              return !c;
            });

            return (
              <Card key={exId}>
                <Row jc="space-between" style={{ marginBottom: 14 }}>
                  <Row gap={10} flex={1}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: colors.accentSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name="activity" size={16} color={colors.accentEdge} />
                    </View>
                    <Col gap={2} flex={1}>
                      <Text variant="title" numberOfLines={1}>
                        {ex.name}
                      </Text>
                      <Text variant="caption" muted>
                        {targetSets} × {targetReps} · {restSeconds}s
                      </Text>
                    </Col>
                  </Row>
                  <Feather name="more-horizontal" size={16} color={colors.muted} />
                </Row>

                {/* Header row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingBottom: 8,
                  }}
                >
                  <View style={{ width: 28 }}>
                    <Text variant="tiny" color={colors.muted} style={{ textAlign: "center" }}>
                      SET
                    </Text>
                  </View>
                  <View style={{ width: 56 }}>
                    <Text variant="tiny" color={colors.muted} style={{ textAlign: "center" }}>
                      PREVIO
                    </Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                    <Text variant="tiny" color={colors.muted} style={{ flex: 1, textAlign: "center" }}>
                      KG
                    </Text>
                    <Text variant="tiny" color={colors.muted} style={{ flex: 1, textAlign: "center" }}>
                      REPS
                    </Text>
                    <Text variant="tiny" color={colors.muted} style={{ flex: 1, textAlign: "center" }}>
                      RPE
                    </Text>
                  </View>
                  <View style={{ width: 28 }} />
                </View>

                <Col gap={6}>
                  {rows.map((row, i) => {
                    const completedSet = completedForExercise.filter(
                      (s) => s.isWarmup === row.isWarmup,
                    )[row.index - 1];
                    const previous = row.isWarmup ? undefined : lastSets[row.index - 1];
                    const isPr =
                      !!completedSet &&
                      !completedSet.isWarmup &&
                      exerciseMax > 0 &&
                      completedSet.weight >= exerciseMax;
                    return (
                      <SetRow
                        key={`${exId}-${i}`}
                        index={row.index}
                        isWarmup={row.isWarmup}
                        initialWeight={completedSet?.weight}
                        initialReps={completedSet?.reps}
                        previousWeight={previous?.weight}
                        previousReps={previous?.reps}
                        completed={!!completedSet}
                        isPr={isPr}
                        isActive={!completedSet && i === firstIncomplete}
                        onComplete={(w, r, rpe) => {
                          logSet(session.id, {
                            exerciseId: exId,
                            weight: w,
                            reps: r,
                            rpe,
                            isWarmup: row.isWarmup,
                            setIndex: row.index,
                          });
                          if (!row.isWarmup) {
                            setRestingFor(restSeconds);
                          }
                        }}
                        onUncomplete={() => {
                          if (completedSet) removeSet(session.id, completedSet.id);
                        }}
                        onRemove={() => {
                          if (completedSet) {
                            Alert.alert("Eliminar set", "¿Borrar este set?", [
                              { text: "Cancelar", style: "cancel" },
                              {
                                text: "Eliminar",
                                style: "destructive",
                                onPress: () => removeSet(session.id, completedSet.id),
                              },
                            ]);
                          }
                        }}
                      />
                    );
                  })}
                </Col>

                <Pressable
                  style={({ pressed }) => ({
                    marginTop: 10,
                    height: 38,
                    borderRadius: 10,
                    borderStyle: "dashed",
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    opacity: pressed ? 0.6 : 1,
                  })}
                  onPress={() => {
                    // Adding a set is just allowing the existing extra row to be filled —
                    // nothing to do here unless we want to scroll/focus the next input.
                  }}
                >
                  <Feather name="plus" size={12} color={colors.muted} />
                  <Text variant="label" color={colors.muted}>
                    Añadir set
                  </Text>
                </Pressable>
              </Card>
            );
          })}
        </Col>

        <Button
          label="Añadir ejercicio"
          variant="outline"
          icon="plus"
          fullWidth
          onPress={handleAddExercise}
          style={{ marginTop: 14 }}
        />
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: Math.max(insets.bottom, 16) + 6,
          left: 16,
          right: 16,
        }}
      >
        <Button
          label="Terminar sesión"
          icon="check"
          size="lg"
          variant="dark"
          fullWidth
          onPress={handleFinish}
        />
      </View>
    </Screen>
  );
}

function SummaryCol({ label, value }: { label: string; value: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <Col gap={4} ai="center" flex={1}>
      <Text variant="tiny" color={colors.muted}>
        {label}
      </Text>
      {typeof value === "string" ? (
        <Text variant="mono" color={colors.ink} style={{ fontSize: 18, fontWeight: "600" }}>
          {value}
        </Text>
      ) : (
        value
      )}
    </Col>
  );
}
