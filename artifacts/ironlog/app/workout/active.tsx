import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { ExerciseActionSheet } from "@/components/workout/ExerciseActionSheet";
import { RestTimer } from "@/components/workout/RestTimer";
import { SetRow } from "@/components/workout/SetRow";
import { TermHint } from "@/components/workout/TermHint";
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
    reorderSessionExercises,
    setSessionExerciseSkipped,
    removeSessionExercise,
  } = useIronLog();

  // Which exercise card has its action sheet open (null = closed).
  const [actionForExId, setActionForExId] = useState<string | null>(null);

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

  // Hook must run unconditionally — keep it before the early return below.
  const skippedSet = useMemo(
    () => new Set(session?.skippedExerciseIds ?? []),
    [session?.skippedExerciseIds],
  );

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
  const completedSetsCount = completedSets.filter(
    (s) => !s.isWarmup && !skippedSet.has(s.exerciseId),
  ).length;
  const totalVolume = completedSets
    .filter((s) => !s.isWarmup && !skippedSet.has(s.exerciseId))
    .reduce((sum, s) => sum + s.weight * s.reps, 0);

  // Total target work-set count across exercises in this session, excluding skipped.
  const targetTotal = session.exerciseOrder.reduce((sum, exId) => {
    if (skippedSet.has(exId)) return sum;
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
          {session.exerciseOrder.map((exId, idx) => {
            const ex = getExerciseById(exId);
            if (!ex) return null;
            const isSkipped = skippedSet.has(exId);

            // Compact "skipped" card — no inputs, just a CTA to undo.
            if (isSkipped) {
              return (
                <Card
                  key={exId}
                  variant="ghost"
                  style={{ borderStyle: "dashed", opacity: 0.85 }}
                >
                  <Row jc="space-between" ai="center">
                    <Row gap={10} flex={1}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: colors.surfaceAlt,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Feather name="skip-forward" size={14} color={colors.muted} />
                      </View>
                      <Col flex={1} gap={2}>
                        <Text variant="title" color={colors.muted} numberOfLines={1}>
                          {ex.name}
                        </Text>
                        <Text variant="tiny" color={colors.muted}>
                          SALTADO EN ESTA SESIÓN
                        </Text>
                      </Col>
                    </Row>
                    <Pressable
                      onPress={() => {
                        setSessionExerciseSkipped(session.id, exId, false);
                        if (Platform.OS !== "web") {
                          Haptics.selectionAsync();
                        }
                      }}
                      hitSlop={8}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: colors.accentSoft,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Feather name="rotate-ccw" size={11} color={colors.accentEdge} />
                      <Text variant="label" color={colors.accentEdge}>
                        Volver a hacer
                      </Text>
                    </Pressable>
                  </Row>
                </Card>
              );
            }

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
                  <Pressable
                    onPress={() => {
                      if (Platform.OS !== "web") {
                        Haptics.selectionAsync();
                      }
                      setActionForExId(exId);
                    }}
                    hitSlop={10}
                    style={({ pressed }) => ({
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: pressed ? colors.surfaceAlt : "transparent",
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Feather name="more-horizontal" size={16} color={colors.muted} />
                  </Pressable>
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
                  <TermHint term="SET" width={28} />
                  <TermHint term="PREVIO" width={56} />
                  <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                    <TermHint term="KG" flex={1} />
                    <TermHint term="REPS" flex={1} />
                    <TermHint term="RPE" flex={1} />
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

      {(() => {
        if (!actionForExId) return null;
        const idx = session.exerciseOrder.indexOf(actionForExId);
        if (idx === -1) return null;
        const ex = getExerciseById(actionForExId);
        if (!ex) return null;
        const hasLoggedSets = session.sets.some((s) => s.exerciseId === actionForExId);
        const isSkipped = skippedSet.has(actionForExId);
        return (
          <ExerciseActionSheet
            visible
            onClose={() => setActionForExId(null)}
            exerciseName={ex.name}
            index={idx}
            total={session.exerciseOrder.length}
            isSkipped={isSkipped}
            hasLoggedSets={hasLoggedSets}
            onMoveUp={() => reorderSessionExercises(session.id, idx, idx - 1)}
            onMoveDown={() => reorderSessionExercises(session.id, idx, idx + 1)}
            onReplace={() => {
              router.push(
                `/exercises?replaceSessionId=${session.id}&replaceExerciseId=${actionForExId}` as never,
              );
            }}
            onToggleSkip={() => {
              setSessionExerciseSkipped(session.id, actionForExId, !isSkipped);
            }}
            onRemove={() => {
              const exName = ex.name;
              const setsCount = session.sets.filter(
                (s) => s.exerciseId === actionForExId,
              ).length;
              Alert.alert(
                `Quitar ${exName}`,
                setsCount > 0
                  ? `Tiene ${setsCount} ${setsCount === 1 ? "set logueado" : "sets logueados"} que se van a borrar. La rutina original no cambia.`
                  : "Sale de esta sesión. La rutina original no cambia.",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Quitar",
                    style: "destructive",
                    onPress: () => removeSessionExercise(session.id, actionForExId),
                  },
                ],
              );
            }}
          />
        );
      })()}
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
