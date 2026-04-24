import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { MuscleGroupChip } from "@/components/MuscleGroupChip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { EXERCISE_TYPE_LABELS, MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from "@/constants/exercises";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { MuscleGroup } from "@/types";

export default function ExercisesScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{
    routineId?: string;
    dayId?: string;
    sessionId?: string;
  }>();
  const {
    allExercises,
    addExerciseToDay,
    addExerciseToActiveWorkout,
    createCustomExercise,
  } = useIronLog();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MuscleGroup | "all">("all");
  const [showCustom, setShowCustom] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<MuscleGroup>("chest");

  const filtered = useMemo(() => {
    return allExercises.filter((e) => {
      const matchesSearch = search.trim() === "" || e.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "all" || e.primaryMuscle === filter;
      return matchesSearch && matchesFilter;
    });
  }, [allExercises, search, filter]);

  const handlePick = (exId: string) => {
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
      <Header
        title="Ejercicios"
        back
        right={
          <Pressable onPress={() => setShowCustom(true)} hitSlop={8}>
            <Feather name="plus" size={22} color={colors.primary} />
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        <Input
          placeholder="Buscar ejercicio..."
          value={search}
          onChangeText={setSearch}
          rightAdornment={search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : (
            <Feather name="search" size={16} color={colors.mutedForeground} />
          )}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
        >
          <MuscleGroupChip group="all" active={filter === "all"} onPress={() => setFilter("all")} />
          {MUSCLE_GROUPS.map((g) => (
            <MuscleGroupChip
              key={g}
              group={g}
              active={filter === g}
              onPress={() => setFilter(g as MuscleGroup)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
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
              <View key={g}>
                <Text variant="tiny" muted style={{ marginBottom: 8 }}>
                  {MUSCLE_GROUP_LABELS[g].toUpperCase()}
                </Text>
                <View style={{ gap: 6 }}>
                  {grouped[g].map((e) => (
                    <ExerciseRow key={e.id} ex={e} onPress={() => handlePick(e.id)} />
                  ))}
                </View>
              </View>
            ) : null,
          )
        ) : (
          <View style={{ gap: 6 }}>
            {filtered.map((e) => (
              <ExerciseRow key={e.id} ex={e} onPress={() => handlePick(e.id)} />
            ))}
          </View>
        )}

        {showCustom ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Feather name="plus-circle" size={18} color={colors.primary} />
              <Text variant="title" style={{ marginLeft: 8 }}>
                Nuevo ejercicio
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              <Input label="Nombre" value={newName} onChangeText={setNewName} autoFocus />
              <View>
                <Text variant="label" muted style={{ marginBottom: 6 }}>
                  Grupo muscular
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {MUSCLE_GROUPS.map((g) => (
                    <MuscleGroupChip
                      key={g}
                      group={g}
                      active={newGroup === g}
                      onPress={() => setNewGroup(g as MuscleGroup)}
                    />
                  ))}
                </ScrollView>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => {
                    setShowCustom(false);
                    setNewName("");
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: colors.secondary,
                    padding: 14,
                    borderRadius: colors.radius,
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
                    backgroundColor: colors.primary,
                    padding: 14,
                    borderRadius: colors.radius,
                    alignItems: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text variant="label" weight="semibold" color={colors.primaryForeground}>
                    Crear
                  </Text>
                </Pressable>
              </View>
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ExerciseRow({ ex, onPress }: { ex: any; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
        flexDirection: "row",
        alignItems: "center",
      })}
    >
      <View style={{ flex: 1 }}>
        <Text variant="label" weight="semibold" numberOfLines={1}>
          {ex.name}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {EXERCISE_TYPE_LABELS[ex.type]} · {MUSCLE_GROUP_LABELS[ex.primaryMuscle]}
          {ex.isCustom ? " · Personalizado" : ""}
        </Text>
      </View>
      <Feather name="plus-circle" size={20} color={colors.primary} />
    </Pressable>
  );
}
