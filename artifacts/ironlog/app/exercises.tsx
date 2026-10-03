import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { showAlert } from "@/utils/alert";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import { useThemeColors } from "@/contexts/ThemeContext";
import {
  filterExercises,
  hasActiveFilters,
  toggleValue,
} from "@/domains/exercises/filter";
import { createCustomExercise } from "@/domains/exercises/mutators";
import {
  useAllExercises,
  useExerciseById,
} from "@/domains/exercises/queries";
import { addExerciseToDay } from "@/domains/routines/mutators";
import { dispatchToDraft } from "@/domains/routines/draftStore";
import { uid } from "@/utils/id";
import {
  addExerciseToActiveWorkout,
  replaceSessionExercise,
} from "@/domains/workout/mutators";
import type { Exercise, ExerciseType, MuscleGroup } from "@/types";

const EXERCISE_TYPES: ExerciseType[] = ["barbell", "dumbbell", "machine", "cable", "bodyweight"];

export default function ExercisesScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    draftKey?: string;
    routineId?: string;
    dayId?: string;
    sessionId?: string;
    replaceSessionId?: string;
    replaceExerciseId?: string;
  }>();
  const allExercises = useAllExercises();

  const isReplaceMode = !!(params.replaceSessionId && params.replaceExerciseId);
  const sourceExercise =
    useExerciseById(isReplaceMode ? params.replaceExerciseId : null) ??
    undefined;

  const [search, setSearch] = useState("");
  const [muscles, setMuscles] = useState<MuscleGroup[]>(
    sourceExercise ? [sourceExercise.primaryMuscle] : [],
  );
  const [types, setTypes] = useState<ExerciseType[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<MuscleGroup>(
    sourceExercise?.primaryMuscle ?? "chest",
  );
  const [newType, setNewType] = useState<ExerciseType>("barbell");

  // If the source exercise resolves later (e.g. custom exercise loaded after mount),
  // re-snap the filter to its muscle.
  useEffect(() => {
    if (sourceExercise) {
      setMuscles([sourceExercise.primaryMuscle]);
    }
  }, [sourceExercise?.id, sourceExercise?.primaryMuscle]);

  const filters = useMemo(() => ({ muscles, types, search }), [muscles, types, search]);
  const filtersActive = hasActiveFilters(filters);
  const filtered = useMemo(
    () => filterExercises(allExercises, filters),
    [allExercises, filters],
  );

  const clearFilters = () => {
    setSearch("");
    setMuscles([]);
    setTypes([]);
  };

  // Prefill the custom exercise form from the filters when they are unambiguous.
  const openCustomForm = () => {
    if (muscles.length === 1) setNewGroup(muscles[0]);
    else setNewGroup(sourceExercise?.primaryMuscle ?? "chest");
    setNewType(types.length === 1 ? types[0] : "barbell");
    setShowCustom(true);
  };

  const handlePick = async (exId: string) => {
    if (isReplaceMode && params.replaceSessionId && params.replaceExerciseId) {
      if (exId === params.replaceExerciseId) {
        // No-op — same exercise picked.
        router.back();
        return;
      }
      await replaceSessionExercise(
        params.replaceSessionId,
        params.replaceExerciseId,
        exId,
      );
      router.back();
      return;
    }
    if (params.draftKey && params.dayId) {
      // Draft mode: hand the exercise to the routine screen's in-memory
      // draft. Nothing is written to the DB until the user saves there.
      dispatchToDraft(params.draftKey, {
        type: "addExercise",
        dayId: params.dayId,
        id: uid(),
        exerciseId: exId,
      });
      router.back();
    } else if (params.routineId && params.dayId) {
      await addExerciseToDay(params.routineId, params.dayId, exId);
      router.back();
    } else if (params.sessionId) {
      await addExerciseToActiveWorkout(params.sessionId, exId);
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
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton icon="chevron-down" onPress={() => router.back()} />
        <Text variant="title">{isReplaceMode ? "Reemplazar" : "Ejercicios"}</Text>
        <IconButton icon="plus" variant="primary" onPress={openCustomForm} />
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
        <Input
          placeholder="Buscar ejercicio…"
          value={search}
          onChangeText={setSearch}
          containerStyle={{ marginBottom: 14 }}
          leftAdornment={<Feather name="search" size={16} color={colors.muted} />}
        />

        <Text variant="tiny" color={colors.muted} style={{ marginBottom: 6 }}>
          MÚSCULO
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 12 }}
          style={{ marginHorizontal: -2 }}
        >
          <Chip label="Todos" active={muscles.length === 0} onPress={() => setMuscles([])} />
          {MUSCLE_GROUPS.map((g) => (
            <Chip
              key={g}
              label={MUSCLE_GROUP_LABELS[g]}
              active={muscles.includes(g as MuscleGroup)}
              onPress={() => setMuscles((cur) => toggleValue(cur, g as MuscleGroup))}
            />
          ))}
        </ScrollView>

        <Text variant="tiny" color={colors.muted} style={{ marginBottom: 6 }}>
          EQUIPAMIENTO
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 12 }}
          style={{ marginHorizontal: -2 }}
        >
          <Chip label="Todos" active={types.length === 0} onPress={() => setTypes([])} />
          {EXERCISE_TYPES.map((t) => (
            <Chip
              key={t}
              label={EXERCISE_TYPE_LABELS[t]}
              active={types.includes(t)}
              onPress={() => setTypes((cur) => toggleValue(cur, t))}
            />
          ))}
        </ScrollView>

        {filtersActive ? (
          <Row jc="space-between" style={{ paddingBottom: 12 }}>
            <Text variant="caption" muted>
              {filtered.length} {filtered.length === 1 ? "ejercicio" : "ejercicios"}
            </Text>
            <Pressable onPress={clearFilters} hitSlop={8}>
              <Text variant="caption" weight="semibold" color={colors.accentEdge}>
                Limpiar filtros
              </Text>
            </Pressable>
          </Row>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 && !showCustom ? (
          <EmptyState
            icon="search"
            title="Sin resultados"
            description={
              filtersActive
                ? "No hay ejercicios que coincidan con los filtros actuales. Prueba quitando alguno."
                : "No encontramos ejercicios. Intenta con otra búsqueda."
            }
            actionLabel={filtersActive ? "Limpiar filtros" : "Crear ejercicio personalizado"}
            onAction={filtersActive ? clearFilters : openCustomForm}
          />
        ) : showCustom ? null : muscles.length !== 1 ? (
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
              <View>
                <Text variant="tiny" color={colors.muted} style={{ marginBottom: 6 }}>
                  EQUIPAMIENTO
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {EXERCISE_TYPES.map((t) => (
                    <Chip
                      key={t}
                      label={EXERCISE_TYPE_LABELS[t]}
                      active={newType === t}
                      onPress={() => setNewType(t)}
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
                  onPress={async () => {
                    if (!newName.trim()) {
                      showAlert("Falta nombre", "Escribe un nombre para el ejercicio.");
                      return;
                    }
                    const ex = await createCustomExercise({
                      name: newName.trim(),
                      description: "Ejercicio personalizado",
                      primaryMuscle: newGroup,
                      secondaryMuscles: [],
                      type: newType,
                    });
                    setNewName("");
                    setShowCustom(false);
                    await handlePick(ex.id);
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
