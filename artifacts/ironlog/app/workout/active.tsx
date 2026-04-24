import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, View } from "react-native";

import { RestTimer } from "@/components/workout/RestTimer";
import { SetRow } from "@/components/workout/SetRow";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { CompletedSet } from "@/types";
import { formatDuration } from "@/utils/date";

export default function ActiveWorkoutScreen() {
  const colors = useThemeColors();
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
    addExerciseToActiveWorkout,
    defaultRestSeconds,
  } = useIronLog();

  const startedRef = useRef(false);
  // Auto-start if params provided
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
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

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
  const completedSetsCount = session.sets.length;
  const totalVolume = session.sets
    .filter((s) => !s.isWarmup)
    .reduce((sum, s) => sum + s.weight * s.reps, 0);

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
    Alert.alert("Descartar sesión", "¿Descartar este entrenamiento? Se perderán los sets registrados.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Descartar",
        style: "destructive",
        onPress: () => {
          cancelWorkout(session.id);
          router.replace("/workout");
        },
      },
    ]);
  };

  return (
    <Screen noPadding>
      <Header
        title={session.dayName}
        subtitle={formatDuration(elapsed)}
        back
        onBack={() => {}}
        right={
          <Pressable onPress={handleCancel} hitSlop={8}>
            <Feather name="x" size={22} color={colors.destructive} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200, gap: 12 }}>
        {/* Stats summary */}
        <Card>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <SummaryCol label="DURACIÓN" value={formatDuration(elapsed)} />
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <SummaryCol label="SETS" value={String(completedSetsCount)} />
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <SummaryCol label="VOLUMEN" value={`${Math.round(totalVolume)}kg`} />
          </View>
        </Card>

        {/* Rest timer */}
        {restingFor != null ? (
          <RestTimer
            durationSeconds={restingFor}
            onClose={() => setRestingFor(null)}
            onComplete={() => setRestingFor(null)}
          />
        ) : null}

        {/* Exercises */}
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

          // Build set rows: warmup count + work set count, but allow extras
          const totalRows = Math.max(warmupSets + targetSets, completedForExercise.length + 1);
          const rows: { isWarmup: boolean; index: number }[] = [];
          for (let i = 0; i < warmupSets; i++) rows.push({ isWarmup: true, index: i + 1 });
          let workIndex = 0;
          for (let i = warmupSets; i < totalRows; i++) {
            workIndex++;
            rows.push({ isWarmup: false, index: workIndex });
          }

          return (
            <Card key={exId} padding={12}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <Feather name="activity" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="title" numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <Text variant="caption" muted>
                    {targetSets} × {targetReps} · {restSeconds}s
                  </Text>
                </View>
              </View>

              {/* Header row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 8,
                  marginBottom: 6,
                  gap: 8,
                }}
              >
                <View style={{ width: 32 }}>
                  <Text variant="tiny" muted>
                    SET
                  </Text>
                </View>
                <View style={{ width: 64 }}>
                  <Text variant="tiny" muted style={{ textAlign: "center" }}>
                    PREVIO
                  </Text>
                </View>
                <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                  <Text variant="tiny" muted style={{ flex: 1, textAlign: "center" }}>
                    KG
                  </Text>
                  <Text variant="tiny" muted style={{ flex: 1, textAlign: "center" }}>
                    REPS
                  </Text>
                  <Text variant="tiny" muted style={{ flex: 1, textAlign: "center" }}>
                    RPE
                  </Text>
                </View>
                <View style={{ width: 36 }} />
              </View>

              <View style={{ gap: 6 }}>
                {rows.map((row, i) => {
                  const completedSet = completedForExercise.filter(
                    (s) => s.isWarmup === row.isWarmup,
                  )[row.index - 1];
                  const previous = row.isWarmup ? undefined : lastSets[row.index - 1];
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
              </View>
            </Card>
          );
        })}

        <Button label="Añadir ejercicio" variant="outline" icon="plus" onPress={handleAddExercise} fullWidth />
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          right: 16,
        }}
      >
        <Button label="Terminar sesión" icon="check" size="lg" fullWidth onPress={handleFinish} />
      </View>
    </Screen>
  );
}

function SummaryCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text variant="tiny" muted>
        {label}
      </Text>
      <Text variant="h3" style={{ marginTop: 4, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}
