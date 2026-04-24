import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";

export default function RoutineDetailScreen() {
  const colors = useThemeColors();
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

  // For new routine, create immediately
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
      <Screen>
        <Header title="Rutina" back />
        <EmptyState icon="alert-circle" title="Rutina no encontrada" />
      </Screen>
    );
  }

  const isPreset = !!routine.isPreset;
  const activeDay = routine.days.find((d) => d.id === activeDayId) ?? routine.days[0];

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

  return (
    <Screen noPadding>
      <Header
        title={routine.name}
        back
        right={
          isPreset ? (
            <Pressable onPress={handleClone} hitSlop={8}>
              <Feather name="copy" size={20} color={colors.foreground} />
            </Pressable>
          ) : (
            <Pressable onPress={handleDelete} hitSlop={8}>
              <Feather name="trash-2" size={20} color={colors.destructive} />
            </Pressable>
          )
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Name editor */}
        {!isPreset ? (
          editingName ? (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Nombre de la rutina"
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                />
              </View>
              <Button
                label="Guardar"
                size="md"
                onPress={() => {
                  if (nameInput.trim()) updateRoutine(routine.id, { name: nameInput.trim() });
                  setEditingName(false);
                }}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setNameInput(routine.name);
                setEditingName(true);
              }}
              style={({ pressed }) => ({
                marginBottom: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text variant="caption" color={colors.primary} weight="semibold">
                Editar nombre
              </Text>
              <Feather name="edit-2" size={12} color={colors.primary} />
            </Pressable>
          )
        ) : (
          <Card style={{ marginBottom: 16, backgroundColor: colors.accent, borderColor: colors.primary }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Feather name="info" size={16} color={colors.primary} />
              <Text variant="caption" color={colors.accentForeground} style={{ flex: 1 }}>
                Esta es una rutina predefinida. Cópiala para personalizarla.
              </Text>
            </View>
          </Card>
        )}

        {routine.description ? (
          <Text variant="body" muted style={{ marginBottom: 16 }}>
            {routine.description}
          </Text>
        ) : null}

        {/* Day selector */}
        {routine.days.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
          >
            {routine.days.map((d) => {
              const active = d.id === activeDay?.id;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => setActiveDayId(d.id)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? colors.primary : colors.secondary,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    variant="label"
                    weight="semibold"
                    color={active ? colors.primaryForeground : colors.foreground}
                  >
                    {d.name}
                  </Text>
                </Pressable>
              );
            })}
            {!isPreset && (
              <Pressable
                onPress={() => addRoutineDay(routine.id, `Día ${routine.days.length + 1}`)}
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.secondary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
              </Pressable>
            )}
          </ScrollView>
        )}

        {routine.days.length === 1 && !isPreset ? (
          <View style={{ marginBottom: 12 }}>
            <Button
              label="Añadir día"
              variant="outline"
              icon="plus"
              size="sm"
              onPress={() => addRoutineDay(routine.id, `Día ${routine.days.length + 1}`)}
            />
          </View>
        ) : null}

        {/* Exercises */}
        {activeDay ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text variant="h3">{activeDay.name}</Text>
              <Text variant="caption" muted>
                {activeDay.exercises.length} {activeDay.exercises.length === 1 ? "ejercicio" : "ejercicios"}
              </Text>
            </View>

            {activeDay.exercises.length === 0 ? (
              <EmptyState
                icon="plus-circle"
                title="Sin ejercicios"
                description="Añade el primer ejercicio a este día."
                actionLabel={isPreset ? undefined : "Añadir ejercicio"}
                onAction={
                  isPreset
                    ? undefined
                    : () =>
                        router.push(
                          `/exercises?routineId=${routine.id}&dayId=${activeDay.id}` as never,
                        )
                }
              />
            ) : (
              activeDay.exercises.map((re, idx) => {
                const ex = getExerciseById(re.exerciseId);
                if (!ex) return null;
                return (
                  <Card key={re.id}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: colors.accent,
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 2,
                        }}
                      >
                        <Text variant="label" color={colors.primary} weight="bold">
                          {idx + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="title" numberOfLines={1}>
                          {ex.name}
                        </Text>
                        <Text variant="caption" muted style={{ marginTop: 2 }}>
                          {re.targetSets} × {re.targetReps} · {re.restSeconds}s descanso
                        </Text>
                        {!isPreset ? (
                          <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
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
                          </View>
                        ) : null}
                      </View>
                      {!isPreset ? (
                        <Pressable
                          onPress={() => removeRoutineExercise(routine.id, activeDay.id, re.id)}
                          hitSlop={8}
                          style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
                        >
                          <Feather name="x" size={18} color={colors.mutedForeground} />
                        </Pressable>
                      ) : null}
                    </View>
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
                  router.push(`/exercises?routineId=${routine.id}&dayId=${activeDay.id}` as never)
                }
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
                <Text variant="caption" color={colors.destructive} weight="semibold">
                  Eliminar este día
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Floating start button */}
      {activeDay && activeDay.exercises.length > 0 ? (
        <View
          style={{
            position: "absolute",
            bottom: 16,
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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.secondary,
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
          <Feather name="minus" size={14} color={colors.foreground} />
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
          <Feather name="plus" size={14} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}
