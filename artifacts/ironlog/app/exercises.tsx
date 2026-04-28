import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { EXERCISE_TYPE_LABELS, MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from "@/constants/exercises";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { Exercise, MuscleGroup } from "@/types";

export default function ExercisesScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{
    routineId?: string;
    dayId?: string;
    sessionId?: string;
    replaceSessionId?: string;
    replaceExerciseId?: string;
  }>();
  const {
    allExercises,
    addExerciseToDay,
    addExerciseToActiveWorkout,
    replaceSessionExercise,
    getExerciseById,
    createCustomExercise,
  } = useIronLog();

  const isReplaceMode = !!(params.replaceSessionId && params.replaceExerciseId);
  const sourceExercise = isReplaceMode
    ? getExerciseById(params.replaceExerciseId!)
    : undefined;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MuscleGroup | "all">(
    sourceExercise ? sourceExercise.primaryMuscle : "all",
  );
  const [showCustom, setShowCustom] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<MuscleGroup>(
    sourceExercise?.primaryMuscle ?? "chest",
  );

  // If the source exercise resolves later (e.g. custom exercise loaded after mount),
  // re-snap the filter to its muscle.
  useEffect(() => {
    if (sourceExercise) {
      setFilter(sourceExercise.primaryMuscle);
    }
  }, [sourceExercise?.id, sourceExercise?.primaryMuscle]);

  const filtered = useMemo(() => {
    return allExercises.filter((e) => {
      const matchesSearch =
        search.trim() === "" || e.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "all" || e.primaryMuscle === filter;
      return matchesSearch && matchesFilter;
    });
  }, [allExercises, search, filter]);

  const handlePick = (exId: string) => {
    if (isReplaceMode && params.replaceSessionId && params.replaceExerciseId) {
      if (exId === params.replaceExerciseId) {
        // No-op — same exercise picked.
        router.back();
        return;
      }
      replaceSessionExercise(params.replaceSessionId, params.replaceExerciseId, exId);
      router.back();
      return;
    }
    if (params.routineId && params.dayId) {
      addExerciseToDay(params.routineId, params.dayId, exId);
      router.back();
    } else if (params.sessionId) {
      addExerciseToActiveWorkout(params.sessionId, exId);
      router.back();
    } else {
      router.back();
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    for (const e of filtered) {
      const g = e.primaryMuscle;
      if (!map[g]) map[g] = [];
      map[g].push(e);
    }
    return map;
  }, [filtered]);

  return (
    <Screen noPadding>
      <View
        style={{
          paddingTop: 8,
          paddingHorizontal: 20,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton icon="chevron-down" onPress={() => router.back()} />
        <Text variant="title">{isReplaceMode ? "Reemplazar" : "Ejercicios"}</Text>
        <IconButton icon="plus" variant="primary" onPress={() => setShowCustom(true)} />
      </View>

      {isReplaceMode && sourceExercise ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <View
            style={{
              backgroundColor: colors.accentSoft,
              borderRadius: 14,
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
            }}
          >
            <Feather name="repeat" size={16} color={colors.accentEdge} />
            <Col flex={1} gap={2}>
              <Text variant="label" weight="semibold" color={colors.accentEdge}>
                Reemplazando {sourceExercise.name}
              </Text>
              <Text variant="caption" muted numberOfLines={2}>
                Filtrado por {MUSCLE_GROUP_LABELS[sourceExercise.primaryMuscle].toLowerCase()}.
                Los sets logueados se migran al nuevo ejercicio.
              </Text>
            </Col>
          </View>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 20 }}>
        {/* Search */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            height: 48,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            gap: 10,
            marginBottom: 14,
          }}
        >
          <Feather name="search" size={16} color={colors.muted} />
          <Input
            placeholder="Buscar ejercicio…"
            value={search}
            onChangeText={setSearch}
            containerStyle={{ flex: 1 }}
            style={{ paddingVertical: 0 }}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 14 }}
          style={{ marginHorizontal: -2 }}
        >
          <Chip
            label="Todo"
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />
          {MUSCLE_GROUPS.map((g) => (
            <Chip
              key={g}
              label={MUSCLE_GROUP_LABELS[g]}
              active={filter === g}
              onPress={() => setFilter(g as MuscleGroup)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 && !showCustom ? (
          <EmptyState
            icon="search"
            title="Sin resultados"
            description="No encontramos ejercicios. Intenta con otra búsqueda."
            actionLabel="Crear ejercicio personalizado"
            onAction={() => setShowCustom(true)}
          />
        ) : showCustom ? null : filter === "all" ? (
          MUSCLE_GROUPS.map((g) =>
            grouped[g] && grouped[g].length > 0 ? (
              <Col key={g} gap={6} style={{ marginBottom: 18 }}>
                <Text
                  variant="tiny"
                  color={colors.muted}
                  style={{ paddingHorizontal: 4, paddingVertical: 4 }}
                >
                  {MUSCLE_GROUP_LABELS[g].toUpperCase()}
                </Text>
                {grouped[g].map((e) => (
                  <ExerciseRow key={e.id} ex={e} onPress={() => handlePick(e.id)} />
                ))}
              </Col>
            ) : null,
          )
        ) : (
          <Col gap={6}>
            {filtered.map((e) => (
              <ExerciseRow key={e.id} ex={e} onPress={() => handlePick(e.id)} />
            ))}
          </Col>
        )}

        {showCustom ? (
          <Card>
            <Row gap={8} style={{ marginBottom: 12 }}>
              <Feather name="plus-circle" size={18} color={colors.accentEdge} />
              <Text variant="title">Nuevo ejercicio</Text>
            </Row>
            <Col gap={10}>
              <Input fieldLabel="NOMBRE" value={newName} onChangeText={setNewName} autoFocus />
              <View>
                <Text variant="tiny" color={colors.muted} style={{ marginBottom: 6 }}>
                  GRUPO MUSCULAR
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {MUSCLE_GROUPS.map((g) => (
                    <Chip
                      key={g}
                      label={MUSCLE_GROUP_LABELS[g]}
                      active={newGroup === g}
                      onPress={() => setNewGroup(g as MuscleGroup)}
                    />
                  ))}
                </ScrollView>
              </View>
              <Row gap={8}>
                <Pressable
                  onPress={() => {
                    setShowCustom(false);
                    setNewName("");
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: colors.surfaceAlt,
                    padding: 14,
                    borderRadius: 14,
                    alignItems: "center",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text variant="label" weight="semibold">
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!newName.trim()) {
                      Alert.alert("Falta nombre", "Escribe un nombre para el ejercicio.");
                      return;
                    }
                    const ex = createCustomExercise({
                      name: newName.trim(),
                      description: "Ejercicio personalizado",
                      primaryMuscle: newGroup,
                      secondaryMuscles: [],
                      type: "barbell",
                    });
                    setNewName("");
                    setShowCustom(false);
                    handlePick(ex.id);
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: colors.accent,
                    padding: 14,
                    borderRadius: 14,
                    alignItems: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text variant="label" weight="semibold" color={colors.accentInk}>
                    Crear
                  </Text>
                </Pressable>
              </Row>
            </Col>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ExerciseRow({ ex, onPress }: { ex: Exercise; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      <Card padding={0}>
        <Row jc="space-between" style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
          <Col gap={2} flex={1}>
            <Text variant="label" weight="semibold" numberOfLines={1}>
              {ex.name}
            </Text>
            <Text variant="caption" muted numberOfLines={1}>
              {EXERCISE_TYPE_LABELS[ex.type]} · {MUSCLE_GROUP_LABELS[ex.primaryMuscle]}
              {ex.isCustom ? " · Personalizado" : ""}
            </Text>
          </Col>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.accentSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="plus" size={14} color={colors.accentEdge} />
          </View>
        </Row>
      </Card>
    </Pressable>
  );
}
