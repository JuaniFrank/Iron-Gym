import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { showAlert } from "@/utils/alert";
import { errorDetail } from "@/utils/errorDetail";
import { uid } from "@/utils/id";
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
import { useThemeColors } from "@/contexts/ThemeContext";
import { useAllExercises } from "@/domains/exercises/queries";
import {
  canSaveDraft,
  draftFromRoutine,
  draftFromTemplate,
  draftReducer,
  emptyDraft,
  saveButtonLabel,
  shouldPromptOnLeave,
  validateDraft,
  type DraftAction,
  type RoutineDraft,
} from "@/domains/routines/draft";
import { registerDraft, unregisterDraft } from "@/domains/routines/draftStore";
import { deleteRoutine, saveRoutineDraft } from "@/domains/routines/mutators";
import { useAllRoutines } from "@/domains/routines/queries";
import { startWorkout } from "@/domains/workout/mutators";
import { useActiveWorkoutId } from "@/domains/workout/queries";

const GOAL_LABELS: Record<string, string> = {
  strength: "FUERZA",
  hypertrophy: "HIPERTROFIA",
  cutting: "DEFINICIÓN",
  beginner: "PRINCIPIANTE",
};

type ScreenAction = DraftAction | { type: "load"; draft: RoutineDraft };

function screenReducer(state: RoutineDraft, action: ScreenAction): RoutineDraft {
  return action.type === "load" ? action.draft : draftReducer(state, action);
}

export default function RoutineDetailScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string; template?: string }>();
  const isNew = params.id === "new";
  const templateId = isNew ? params.template : undefined;
  const allRoutines = useAllRoutines();
  const allExercises = useAllExercises();
  const activeWorkoutId = useActiveWorkoutId();
  const exerciseById = useMemo(
    () => new Map(allExercises.map((e) => [e.id, e])),
    [allExercises],
  );

  // The persisted routine (edit mode / presets). New routines have none.
  const routine = isNew ? null : (allRoutines.find((r) => r.id === params.id) ?? null);

  const [draft, dispatchScreen] = useReducer(screenReducer, undefined, emptyDraft);
  /** Last saved state; null while the routine does not exist in the DB yet. */
  const [original, setOriginal] = useState<RoutineDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);

  // Load the draft once; later live-query emissions must not reset edits.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    if (isNew) {
      if (!templateId) {
        loadedRef.current = true;
        return;
      }
      const template = allRoutines.find((r) => r.id === templateId);
      if (template) {
        loadedRef.current = true;
        const d = draftFromTemplate(template);
        dispatchScreen({ type: "load", draft: d });
        setActiveDayId(d.days[0]?.id ?? null);
      }
    } else if (routine) {
      loadedRef.current = true;
      const d = draftFromRoutine(routine);
      dispatchScreen({ type: "load", draft: d });
      setOriginal(d);
      setActiveDayId(d.days[0]?.id ?? null);
    }
  }, [isNew, templateId, routine, allRoutines]);

  // Fresh empty draft: select its only day.
  useEffect(() => {
    if (!activeDayId && draft.days[0]) setActiveDayId(draft.days[0].id);
  }, [activeDayId, draft.days]);

  // Let the exercise picker (a separate screen) append to this draft.
  const draftKey = useMemo(() => uid(), []);
  useEffect(() => {
    const send = (action: DraftAction) => dispatchScreen(action);
    registerDraft(draftKey, send);
    return () => unregisterDraft(draftKey, send);
  }, [draftKey]);

  // Unsaved-changes guard (header back, iOS swipe, Android/browser back).
  const draftRef = useRef(draft);
  const originalRef = useRef(original);
  draftRef.current = draft;
  originalRef.current = original;
  const bypassRef = useRef(false);
  useEffect(() => {
    return navigation.addListener("beforeRemove", (e) => {
      if (!shouldPromptOnLeave(draftRef.current, originalRef.current, bypassRef.current)) return;
      e.preventDefault();
      showAlert("¿Descartar cambios?", "Tienes cambios sin guardar en esta rutina.", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: () => {
            bypassRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
  }, [navigation]);

  const ready = isNew || original !== null;
  if (!ready) {
    return (
      <Screen noPadding>
        <Header title="Rutina" back />
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <EmptyState icon="alert-circle" title="Rutina no encontrada" />
        </View>
      </Screen>
    );
  }

  const isPreset = !isNew && !!routine?.isPreset;
  const exists = original !== null;
  const dirty = canSaveDraft(draft, original, false);
  const errors = showErrors ? validateDraft(draft) : null;
  const fieldErrors = errors && !errors.ok ? errors.errors : null;
  const activeDay = draft.days.find((d) => d.id === activeDayId) ?? draft.days[0];
  const goalLabel = draft.goal ? GOAL_LABELS[draft.goal] : null;
  const totalEx = draft.days.reduce((sum, d) => sum + d.exercises.length, 0);

  const openPicker = () => {
    if (!activeDay) return;
    router.push(`/exercises?draftKey=${draftKey}&dayId=${activeDay.id}` as never);
  };

  const handleSave = async () => {
    if (saving || isPreset) return;
    const validation = validateDraft(draft);
    if (!validation.ok) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setSaving(true);
    const snapshot = draft;
    try {
      const id = await saveRoutineDraft(snapshot, original);
      if (original === null) {
        // Replace so back does not return to the empty "new" form.
        bypassRef.current = true;
        router.replace(`/routine/${id}` as never);
      } else {
        setOriginal(snapshot);
      }
    } catch (err) {
      console.error("[ironlog] saveRoutineDraft failed:", err);
      showAlert(
        "No se pudo guardar",
        `Tus cambios siguen en pantalla, puedes volver a intentarlo.\n\nDetalle: ${errorDetail(err)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async () => {
    if (activeWorkoutId) {
      showAlert(
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
    if (!isPreset && dirty) {
      showAlert(
        "Cambios sin guardar",
        "Guarda la rutina antes de empezar el entrenamiento.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Guardar", onPress: () => void handleSave() },
        ],
      );
      return;
    }
    await startWorkout(draft.id, activeDay.id);
    router.push("/workout/active");
  };

  const handleDelete = () => {
    showAlert("Eliminar rutina", `¿Borrar "${draft.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await deleteRoutine(draft.id);
          bypassRef.current = true;
          router.back();
        },
      },
    ]);
  };

  const handleUseAsTemplate = () => {
    router.replace(`/routine/new?template=${draft.id}` as never);
  };

  const goalSummary = goalLabel
    ? `${goalLabel} · ${draft.days.length} ${draft.days.length === 1 ? "DÍA" : "DÍAS"}`
    : `${draft.days.length} ${draft.days.length === 1 ? "DÍA" : "DÍAS"} · ${totalEx} EJERCICIOS`;

  const showStart = !!activeDay && activeDay.exercises.length > 0 && (isPreset || exists);

  return (
    <Screen noPadding>
      <Header
        title=""
        back
        compact
        right={
          isPreset ? (
            <IconButton icon="copy" onPress={handleUseAsTemplate} />
          ) : exists ? (
            <IconButton icon="trash-2" onPress={handleDelete} color={colors.danger} />
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 190 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Col gap={6} style={{ marginBottom: 6 }}>
          <Text variant="tiny" color={colors.muted}>
            {goalSummary}
          </Text>
          {isPreset ? (
            <Text variant="h1">{draft.name}</Text>
          ) : (
            <Input
              value={draft.name}
              onChangeText={(name) => dispatchScreen({ type: "setName", name })}
              placeholder="Nombre de la rutina"
              error={fieldErrors?.name}
              autoFocus={!exists && !templateId}
            />
          )}
        </Col>

        {draft.description ? (
          <Text variant="body" muted style={{ marginVertical: 14 }}>
            {draft.description}
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
          {draft.days.map((d) => {
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
              onPress={() => {
                const id = uid();
                dispatchScreen({ type: "addDay", id });
                setActiveDayId(id);
              }}
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
                {fieldErrors?.dayNames?.[activeDay.id] ? (
                  <Text variant="caption" color={colors.danger}>
                    {fieldErrors.dayNames[activeDay.id]}
                  </Text>
                ) : null}
              </Col>
            </Row>

            <Col gap={8} style={{ marginTop: 8 }}>
              {activeDay.exercises.length === 0 ? (
                <EmptyState
                  icon="plus-circle"
                  title="Sin ejercicios"
                  description="Añade el primer ejercicio a este día."
                  actionLabel={isPreset ? undefined : "Añadir ejercicio"}
                  onAction={isPreset ? undefined : openPicker}
                />
              ) : (
                activeDay.exercises.map((re, idx) => {
                  const ex = exerciseById.get(re.exerciseId);
                  const patch = (p: Partial<typeof re>) =>
                    dispatchScreen({
                      type: "updateExercise",
                      dayId: activeDay.id,
                      id: re.id,
                      patch: p,
                    });
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
                            {ex?.name ?? "Ejercicio"}
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
                                onChange={(v) => patch({ targetSets: v })}
                                min={1}
                                max={10}
                              />
                              <SmallStepper
                                label="Reps"
                                value={re.targetReps}
                                onChange={(v) => patch({ targetReps: v })}
                                min={1}
                                max={50}
                              />
                              <SmallStepper
                                label="Calent."
                                value={re.warmupSets}
                                onChange={(v) => patch({ warmupSets: v })}
                                min={0}
                                max={5}
                              />
                            </Row>
                          ) : null}
                        </Col>
                        {!isPreset ? (
                          <Pressable
                            onPress={() =>
                              dispatchScreen({
                                type: "removeExercise",
                                dayId: activeDay.id,
                                id: re.id,
                              })
                            }
                            hitSlop={8}
                            accessibilityLabel="Quitar ejercicio"
                            style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
                          >
                            <Feather name="x" size={18} color={colors.muted} />
                          </Pressable>
                        ) : null}
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
                  onPress={openPicker}
                  style={{ marginTop: 6 }}
                />
              ) : null}

              {!isPreset && draft.days.length > 1 ? (
                <Pressable
                  onPress={() => {
                    showAlert("Eliminar día", `¿Borrar "${activeDay.name}"?`, [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Eliminar",
                        style: "destructive",
                        onPress: () => {
                          dispatchScreen({ type: "removeDay", dayId: activeDay.id });
                          setActiveDayId(
                            draft.days.find((d) => d.id !== activeDay.id)?.id ?? null,
                          );
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

      {/* Sticky actions */}
      {showStart || !isPreset ? (
        <View
          style={{
            position: "absolute",
            bottom: Math.max(insets.bottom, 16) + 6,
            left: 16,
            right: 16,
            gap: 8,
          }}
        >
          {showStart ? (
            <Button
              label="Empezar entrenamiento"
              icon="play"
              size={isPreset ? "lg" : "md"}
              variant={isPreset ? "primary" : "dark"}
              fullWidth
              onPress={handleStart}
            />
          ) : null}
          {!isPreset ? (
            <Button
              label={saveButtonLabel(original)}
              size="lg"
              fullWidth
              disabled={!canSaveDraft(draft, original, saving)}
              loading={saving}
              onPress={handleSave}
            />
          ) : null}
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
