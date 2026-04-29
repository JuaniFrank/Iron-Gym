import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";

const GOAL_LABELS: Record<string, string> = {
  strength: "FUERZA",
  hypertrophy: "HIPERTROFIA",
  cutting: "DEFINICIÓN",
  beginner: "PRINCIPIANTE",
};

export default function RoutineDetailScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const isNew = params.id === "new";
  const {
    allRoutines,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    cloneRoutine,
    addRoutineDay,
    updateRoutineDay,
    deleteRoutineDay,
    removeRoutineExercise,
    updateRoutineExercise,
    getExerciseById,
    startWorkout,
    activeWorkoutId,
  } = useIronLog();

  const [createdId, setCreatedId] = useState<string | null>(null);
  const routineId = isNew ? createdId : params.id;
  const routine = routineId ? allRoutines.find((r) => r.id === routineId) : null;

  useEffect(() => {
    if (isNew && !createdId) {
      const r = createRoutine("Nueva rutina");
      setCreatedId(r.id);
    }
  }, [isNew, createdId, createRoutine]);

  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    if (routine && !activeDayId && routine.days[0]) {
      setActiveDayId(routine.days[0].id);
    }
  }, [routine, activeDayId]);

  if (!routine) {
    return (
      <Screen noPadding>
        <Header title="Rutina" back />
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <EmptyState icon="alert-circle" title="Rutina no encontrada" />
        </View>
      </Screen>
    );
  }

  const isPreset = !!routine.isPreset;
  const activeDay = routine.days.find((d) => d.id === activeDayId) ?? routine.days[0];
  const goalLabel = routine.goal ? GOAL_LABELS[routine.goal] : null;
  const totalEx = routine.days.reduce((sum, d) => sum + d.exercises.length, 0);

  const handleStart = () => {
    if (activeWorkoutId) {
      Alert.alert(
        "Sesión activa",
        "Ya tienes un entrenamiento en curso. ¿Quieres continuarlo?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar", onPress: () => router.push("/workout/active") },
        ],
      );
      return;
    }
    if (!activeDay) return;
    startWorkout(routine.id, activeDay.id);
    router.push("/workout/active");
  };

  const handleDelete = () => {
    Alert.alert("Eliminar rutina", `¿Borrar "${routine.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => {
          deleteRoutine(routine.id);
          router.back();
        },
      },
    ]);
  };

  const handleClone = () => {
    const cloned = cloneRoutine(routine.id);
    if (cloned) router.replace(`/routine/${cloned.id}`);
  };

  const goalSummary = goalLabel
    ? `${goalLabel} · ${routine.days.length} ${routine.days.length === 1 ? "DÍA" : "DÍAS"}`
    : `${routine.days.length} ${routine.days.length === 1 ? "DÍA" : "DÍAS"} · ${totalEx} EJERCICIOS`;

  return (
    <Screen noPadding>
      <Header
        title=""
        back
        compact
        right={
          isPreset ? (
            <IconButton icon="copy" onPress={handleClone} />
          ) : (
            <IconButton icon="trash-2" onPress={handleDelete} color={colors.danger} />
          )
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 120 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Col gap={6} style={{ marginBottom: 6 }}>
          <Text variant="tiny" color={colors.muted}>
            {goalSummary}
          </Text>
          {!isPreset && editingName ? (
            <Row gap={8}>
              <View style={{ flex: 1 }}>
                <Input value={nameInput} onChangeText={setNameInput} autoFocus />
              </View>
              <Button
                label="Guardar"
                onPress={() => {
                  if (nameInput.trim()) updateRoutine(routine.id, { name: nameInput.trim() });
                  setEditingName(false);
                }}
              />
            </Row>
          ) : (
            <Pressable
              disabled={isPreset}
              onPress={() => {
                setNameInput(routine.name);
                setEditingName(true);
              }}
            >
              <Text variant="h1">{routine.name}</Text>
            </Pressable>
          )}
        </Col>

        {routine.description ? (
          <Text variant="body" muted style={{ marginVertical: 14 }}>
            {routine.description}
          </Text>
        ) : (
          <View style={{ height: 14 }} />
        )}

        {isPreset ? (
          <Card variant="accent" style={{ marginBottom: 14 }}>
            <Row gap={10}>
              <Feather name="info" size={16} color={colors.accentEdge} />
              <Text variant="caption" color={colors.inkSoft} style={{ flex: 1 }}>
                Esta es una rutina predefinida. Cópiala para personalizarla.
              </Text>
            </Row>
          </Card>
        ) : null}

        {/* Day pill selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          style={{ marginBottom: 14, marginHorizontal: -2 }}
        >
          {routine.days.map((d) => {
            const active = d.id === activeDay?.id;
            return (
              <Pressable
                key={d.id}
                onPress={() => setActiveDayId(d.id)}
                style={({ pressed }) => ({
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: active ? colors.ink : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.ink : colors.border,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  variant="label"
                  weight={active ? "semibold" : "medium"}
                  color={active ? colors.bg : colors.ink}
                >
                  {d.name}
                </Text>
              </Pressable>
            );
          })}
          {!isPreset ? (
            <Pressable
              onPress={() => addRoutineDay(routine.id, `Día ${routine.days.length + 1}`)}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Feather name="plus" size={14} color={colors.ink} />
            </Pressable>
          ) : null}
        </ScrollView>

        {activeDay ? (
          <>
            <Row jc="space-between" style={{ paddingVertical: 6 }}>
              <Col gap={2}>
                <Text variant="h3">{activeDay.name}</Text>
                <Text variant="caption" muted>
                  {activeDay.exercises.length}{" "}
                  {activeDay.exercises.length === 1 ? "ejercicio" : "ejercicios"}
                </Text>
              </Col>
            </Row>

            <Col gap={8} style={{ marginTop: 8 }}>
              {activeDay.exercises.length === 0 ? (
                <EmptyState
                  icon="plus-circle"
                  title="Sin ejercicios"
                  description="Añade el primer ejercicio a este día."
                  actionLabel={isPreset ? undefined : "Añadir ejercicio"}
                  onAction={
                    isPreset
                      ? undefined
                      : () => router.push(`/exercises?routineId=${routine.id}&dayId=${activeDay.id}` as never)
                  }
                />
              ) : (
                activeDay.exercises.map((re, idx) => {
                  const ex = getExerciseById(re.exerciseId);
                  if (!ex) return null;
                  return (
                    <Card key={re.id} padding={0}>
                      <Row
                        gap={12}
                        ai="flex-start"
                        style={{ paddingVertical: 14, paddingHorizontal: 16 }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: colors.accentSoft,
                            alignItems: "center",
                            justifyContent: "center",
                            marginTop: 2,
                          }}
                        >
                          <Text variant="label" color={colors.accentEdge} weight="bold">
                            {idx + 1}
                          </Text>
                        </View>
                        <Col gap={4} flex={1}>
                          <Text variant="title" numberOfLines={1}>
                            {ex.name}
                          </Text>
                          <Row gap={10}>
                            <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
                              {re.targetSets} × {re.targetReps}
                            </Text>
                            <View
                              style={{
                                width: 2,
                                height: 2,
                                borderRadius: 1,
                                backgroundColor: colors.muted,
                              }}
                            />
                            <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
                              {re.restSeconds}s
                            </Text>
                          </Row>
                          {!isPreset ? (
                            <Row gap={6} style={{ marginTop: 8 }}>
                              <SmallStepper
                                label="Series"
                                value={re.targetSets}
                                onChange={(v) =>
                                  updateRoutineExercise(routine.id, activeDay.id, re.id, {
                                    targetSets: v,
                                  })
                                }
                                min={1}
                                max={10}
                              />
                              <SmallStepper
                                label="Reps"
                                value={re.targetReps}
                                onChange={(v) =>
                                  updateRoutineExercise(routine.id, activeDay.id, re.id, {
                                    targetReps: v,
                                  })
                                }
                                min={1}
                                max={50}
                              />
                              <SmallStepper
                                label="Calent."
                                value={re.warmupSets}
                                onChange={(v) =>
                                  updateRoutineExercise(routine.id, activeDay.id, re.id, {
                                    warmupSets: v,
                                  })
                                }
                                min={0}
                                max={5}
                              />
                            </Row>
                          ) : null}
                        </Col>
                        {!isPreset ? (
                          <Pressable
                            onPress={() => removeRoutineExercise(routine.id, activeDay.id, re.id)}
                            hitSlop={8}
                            style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
                          >
                            <Feather name="more-vertical" size={16} color={colors.muted} />
                          </Pressable>
                        ) : (
                          <Feather name="more-vertical" size={16} color={colors.muted} />
                        )}
                      </Row>
                    </Card>
                  );
                })
              )}

              {!isPreset && activeDay.exercises.length > 0 ? (
                <Button
                  label="Añadir ejercicio"
                  variant="outline"
                  icon="plus"
                  fullWidth
                  onPress={() =>
                    router.push(
                      `/exercises?routineId=${routine.id}&dayId=${activeDay.id}` as never,
                    )
                  }
                  style={{ marginTop: 6 }}
                />
              ) : null}

              {!isPreset && routine.days.length > 1 ? (
                <Pressable
                  onPress={() => {
                    Alert.alert("Eliminar día", `¿Borrar "${activeDay.name}"?`, [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Eliminar",
                        style: "destructive",
                        onPress: () => {
                          deleteRoutineDay(routine.id, activeDay.id);
                          setActiveDayId(routine.days[0]?.id ?? null);
                        },
                      },
                    ]);
                  }}
                  style={({ pressed }) => ({
                    marginTop: 8,
                    padding: 12,
                    alignItems: "center",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text variant="caption" color={colors.danger} weight="semibold">
                    Eliminar este día
                  </Text>
                </Pressable>
              ) : null}
            </Col>
          </>
        ) : null}
      </ScrollView>

      {/* Sticky lime CTA */}
      {activeDay && activeDay.exercises.length > 0 ? (
        <View
          style={{
            position: "absolute",
            bottom: Math.max(insets.bottom, 16) + 6,
            left: 16,
            right: 16,
          }}
        >
          <Button
            label="Empezar entrenamiento"
            icon="play"
            size="lg"
            fullWidth
            onPress={handleStart}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function SmallStepper({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1 }}>
      <Text variant="tiny" muted style={{ textAlign: "center", marginBottom: 4 }}>
        {label.toUpperCase()}
      </Text>
      <Row
        gap={0}
        ai="center"
        style={{
          backgroundColor: colors.surfaceAlt,
          borderRadius: 8,
          padding: 2,
        }}
      >
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            onChange(Math.max(min, value - 1));
          }}
          style={({ pressed }) => ({
            width: 24,
            height: 24,
            borderRadius: 6,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Feather name="minus" size={12} color={colors.ink} />
        </Pressable>
        <Text variant="label" weight="semibold" style={{ flex: 1, textAlign: "center" }}>
          {value}
        </Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            onChange(Math.min(max, value + 1));
          }}
          style={({ pressed }) => ({
            width: 24,
            height: 24,
            borderRadius: 6,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Feather name="plus" size={12} color={colors.ink} />
        </Pressable>
      </Row>
    </View>
  );
}
