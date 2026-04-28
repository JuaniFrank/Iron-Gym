import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { LineChart } from "@/components/charts/LineChart";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { MUSCLE_GROUP_LABELS } from "@/constants/exercises";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type {
  CompletedSet,
  PlannedExercise,
  PlannedSet,
  RoutineExercise,
} from "@/types";
import { DAY_LABELS_FULL, formatDateLong } from "@/utils/date";

export default function PlanWorkoutScreen() {
  const params = useLocalSearchParams<{
    routineId?: string;
    dayId?: string;
    dateKey?: string;
  }>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const {
    sessions,
    getRoutineById,
    getSessionPlan,
    upsertSessionPlan,
    deleteSessionPlan,
    getLastSetsForExercise,
    getExerciseById,
    activeWorkoutId,
    startWorkout,
  } = useIronLog();

  const routine = params.routineId ? getRoutineById(params.routineId) : undefined;
  const day = useMemo(
    () =>
      routine && params.dayId
        ? routine.days.find((d) => d.id === params.dayId)
        : undefined,
    [routine, params.dayId],
  );
  const existing = useMemo(
    () =>
      params.dateKey && params.routineId && params.dayId
        ? getSessionPlan(params.dateKey, params.routineId, params.dayId)
        : undefined,
    [getSessionPlan, params.dateKey, params.routineId, params.dayId],
  );

  // Local state of the plan — auto-saves on each change.
  const [exercises, setExercises] = useState<PlannedExercise[]>(() => {
    if (existing) return existing.exercises;
    if (!day) return [];
    return day.exercises.map((re) => ({
      exerciseId: re.exerciseId,
      sets: buildInitialSets(re, getLastSetsForExercise(re.exerciseId)),
    }));
  });

  // Auto-save on each user edit (skip the initial mount so a quick "look and
  // leave" doesn't persist a plan).
  const skipNextSaveRef = useRef(true);
  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (!params.dateKey || !params.routineId || !params.dayId) return;
    if (!day) return;
    upsertSessionPlan({
      dateKey: params.dateKey,
      routineId: params.routineId,
      routineDayId: params.dayId,
      exercises,
    });
  }, [
    exercises,
    params.dateKey,
    params.routineId,
    params.dayId,
    day,
    upsertSessionPlan,
  ]);

  if (!routine || !day || !params.dateKey || !params.routineId || !params.dayId) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle"
          title="Plan no disponible"
          description="No encontramos esta rutina o día."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const dateObj = parseDateKey(params.dateKey);
  const isToday = isSameDayKey(params.dateKey, todayDateKey());

  const updateExercise = (exId: string, updater: (ex: PlannedExercise) => PlannedExercise) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.exerciseId === exId ? updater(ex) : ex)),
    );
  };

  const handleStartNow = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (!activeWorkoutId) {
      startWorkout(params.routineId!, params.dayId!);
    }
    router.replace("/workout/active");
  };

  const handleDeletePlan = () => {
    Alert.alert(
      "Borrar plan",
      "Vas a perder los pesos, reps y RPEs predefinidos. La rutina original no cambia.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar plan",
          style: "destructive",
          onPress: () => {
            deleteSessionPlan(params.dateKey!);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <Screen noPadding>
      {/* Header strip */}
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
            {isToday ? "PLAN DE HOY" : "PLANEAR ENTRENO"}
          </Text>
          <Text variant="label" weight="semibold" numberOfLines={1}>
            {day.name}
          </Text>
        </Col>
        {existing ? (
          <IconButton
            icon="trash-2"
            color={colors.danger}
            onPress={handleDeletePlan}
          />
        ) : (
          <View style={{ width: 36, height: 36 }} />
        )}
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 120 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary banner */}
        <Card padding={0} variant="ink" style={{ marginBottom: 14 }}>
          <Col gap={6} style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
            <Text variant="tiny" color={colors.accent}>
              {isToday
                ? "HOY"
                : DAY_LABELS_FULL[(dateObj.getDay() + 6) % 7].toUpperCase()}{" "}
              · {formatDateLong(dateObj.getTime())}
            </Text>
            <Text variant="h2" color={colors.bg}>
              {day.name}
            </Text>
            <Text variant="caption" color="rgba(242,240,232,0.65)">
              {routine.name} · {day.exercises.length} ejercicios
            </Text>
            <Text variant="caption" color="rgba(242,240,232,0.55)" style={{ marginTop: 4 }}>
              Los cambios se guardan automáticamente.
            </Text>
          </Col>
        </Card>

        {exercises.length === 0 ? (
          <EmptyState
            icon="layers"
            title="Día sin ejercicios"
            description="Agregá ejercicios a esta rutina antes de planear."
          />
        ) : (
          <Col gap={12}>
            {exercises.map((pe) => {
              const ex = getExerciseById(pe.exerciseId);
              if (!ex) return null;
              const re = day.exercises.find((x) => x.exerciseId === pe.exerciseId);
              const lastSets = getLastSetsForExercise(pe.exerciseId);
              const exerciseHistory = computeExerciseHistory(pe.exerciseId, sessions);
              return (
                <PlanExerciseCard
                  key={pe.exerciseId}
                  exerciseName={ex.name}
                  muscle={ex.primaryMuscle}
                  routineExercise={re}
                  planned={pe}
                  lastSets={lastSets}
                  history={exerciseHistory}
                  onChange={(next) =>
                    updateExercise(pe.exerciseId, () => ({ ...pe, sets: next }))
                  }
                />
              );
            })}
          </Col>
        )}
      </KeyboardAwareScrollViewCompat>

      {/* Bottom CTA */}
      <View
        style={{
          position: "absolute",
          bottom: Math.max(insets.bottom, 16) + 6,
          left: 16,
          right: 16,
        }}
      >
        <Pressable
          onPress={isToday ? handleStartNow : () => router.back()}
          style={({ pressed }) => ({
            height: 54,
            borderRadius: 14,
            backgroundColor: colors.ink,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Feather
            name={isToday ? "play" : "check"}
            size={16}
            color={colors.bg}
          />
          <Text variant="label" weight="semibold" color={colors.bg}>
            {isToday ? "Empezar entrenamiento" : "Listo"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Per-exercise card

interface PlanExerciseCardProps {
  exerciseName: string;
  muscle: string;
  routineExercise: RoutineExercise | undefined;
  planned: PlannedExercise;
  lastSets: CompletedSet[];
  history: { x: number; y: number }[];
  onChange: (sets: PlannedSet[]) => void;
}

function PlanExerciseCard({
  exerciseName,
  muscle,
  routineExercise,
  planned,
  lastSets,
  history,
  onChange,
}: PlanExerciseCardProps) {
  const colors = useThemeColors();
  const [showHistory, setShowHistory] = useState(false);

  const recommendation = useMemo(
    () => buildRecommendation(lastSets),
    [lastSets],
  );

  const updateSet = (idx: number, patch: Partial<PlannedSet>) => {
    onChange(planned.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSet = (idx: number) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onChange(planned.sets.filter((_, i) => i !== idx));
  };

  const addSet = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const lastWork = [...planned.sets].reverse().find((s) => !s.isWarmup);
    onChange([
      ...planned.sets,
      {
        isWarmup: false,
        weight: lastWork?.weight,
        reps: lastWork?.reps ?? routineExercise?.targetReps,
        rpe: lastWork?.rpe,
      },
    ]);
  };

  const toggleWarmup = (idx: number) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    updateSet(idx, { isWarmup: !planned.sets[idx]?.isWarmup });
  };

  // Auto-fill helpers
  const applyAutofill = (
    kind: "repeat" | "plus2_5" | "plus1rep" | "fromRoutine" | "clear",
  ) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (kind === "clear") {
      onChange([]);
      return;
    }
    if (kind === "fromRoutine") {
      if (!routineExercise) return;
      onChange(buildInitialSets(routineExercise, lastSets));
      return;
    }
    if (lastSets.length === 0) {
      // Without history these auto-fills don't apply — keep current.
      return;
    }
    if (kind === "repeat") {
      onChange(
        lastSets.map<PlannedSet>((s) => ({
          isWarmup: false,
          weight: s.weight,
          reps: s.reps,
          rpe: s.rpe,
        })),
      );
    } else if (kind === "plus2_5") {
      onChange(
        lastSets.map<PlannedSet>((s) => ({
          isWarmup: false,
          weight: roundQuarter(s.weight + 2.5),
          reps: s.reps,
          rpe: s.rpe,
        })),
      );
    } else if (kind === "plus1rep") {
      onChange(
        lastSets.map<PlannedSet>((s) => ({
          isWarmup: false,
          weight: s.weight,
          reps: s.reps + 1,
          rpe: s.rpe,
        })),
      );
    }
  };

  return (
    <Card>
      {/* Header */}
      <Row jc="space-between" ai="flex-start" style={{ marginBottom: 12 }}>
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
              {exerciseName}
            </Text>
            <Text variant="caption" muted numberOfLines={1}>
              {(MUSCLE_GROUP_LABELS as Record<string, string>)[muscle] ?? muscle}
              {routineExercise
                ? ` · ${routineExercise.targetSets} × ${routineExercise.targetReps}`
                : ""}
            </Text>
          </Col>
        </Row>
        <Pressable
          onPress={() => setShowHistory((s) => !s)}
          hitSlop={6}
          style={({ pressed }) => ({
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: showHistory ? colors.accent : colors.surfaceAlt,
            opacity: pressed ? 0.7 : 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          })}
        >
          <Feather
            name="trending-up"
            size={11}
            color={showHistory ? colors.accentInk : colors.muted}
          />
          <Text
            variant="tiny"
            color={showHistory ? colors.accentInk : colors.muted}
          >
            HISTORIAL
          </Text>
        </Pressable>
      </Row>

      {/* Last session preview + recommendation */}
      <View
        style={{
          backgroundColor: colors.surfaceAlt,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 12,
        }}
      >
        <Text variant="tiny" color={colors.muted} style={{ marginBottom: 4 }}>
          ÚLTIMA SESIÓN
        </Text>
        {lastSets.length === 0 ? (
          <Text variant="caption" muted>
            Sin registro previo.
          </Text>
        ) : (
          <Text variant="mono" color={colors.ink} style={{ fontSize: 12 }}>
            {lastSets
              .map(
                (s) =>
                  `${s.weight}×${s.reps}${s.rpe ? ` @${s.rpe}` : ""}`,
              )
              .join("  ·  ")}
          </Text>
        )}
        {recommendation ? (
          <Row gap={6} ai="center" style={{ marginTop: 6 }}>
            <Feather name="zap" size={11} color={colors.accentEdge} />
            <Text variant="caption" color={colors.accentEdge}>
              {recommendation}
            </Text>
          </Row>
        ) : null}
      </View>

      {/* Optional mini chart */}
      {showHistory ? (
        <View
          style={{
            paddingVertical: 8,
            marginBottom: 10,
          }}
        >
          {history.length >= 2 ? (
            <>
              <Text variant="tiny" color={colors.muted} style={{ marginBottom: 6 }}>
                PESO MÁX · ÚLTIMAS {history.length} SESIONES
              </Text>
              <LineChart
                data={history}
                width={Dimensions.get("window").width - 96}
                height={80}
              />
            </>
          ) : (
            <Text variant="caption" muted style={{ textAlign: "center" }}>
              Necesitás al menos 2 sesiones para ver tendencia.
            </Text>
          )}
        </View>
      ) : null}

      {/* Set rows header */}
      <Row gap={6} ai="center" style={{ paddingBottom: 6 }}>
        <View style={{ width: 28, alignItems: "center" }}>
          <Text variant="tiny" color={colors.muted}>
            SET
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
      </Row>

      {/* Set rows */}
      <Col gap={6}>
        {planned.sets.map((s, i) => {
          const workIndex = countWorkBefore(planned.sets, i) + (s.isWarmup ? 0 : 1);
          return (
            <PlanSetRow
              key={i}
              set={s}
              setIndex={s.isWarmup ? 0 : workIndex}
              onChange={(patch) => updateSet(i, patch)}
              onRemove={() => removeSet(i)}
              onToggleWarmup={() => toggleWarmup(i)}
            />
          );
        })}

        <Pressable
          onPress={addSet}
          style={({ pressed }) => ({
            marginTop: 4,
            height: 36,
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
        >
          <Feather name="plus" size={12} color={colors.muted} />
          <Text variant="label" color={colors.muted}>
            Añadir set
          </Text>
        </Pressable>
      </Col>

      {/* Auto-fill chips */}
      <View
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Text variant="tiny" color={colors.muted} style={{ marginBottom: 8 }}>
          AUTO-COMPLETAR
        </Text>
        <Row gap={6} style={{ flexWrap: "wrap" }}>
          <Chip
            label="Repetir última"
            active={false}
            onPress={() => applyAutofill("repeat")}
          />
          <Chip
            label="+ 2,5 kg"
            active={false}
            onPress={() => applyAutofill("plus2_5")}
          />
          <Chip
            label="+ 1 rep"
            active={false}
            onPress={() => applyAutofill("plus1rep")}
          />
          {routineExercise ? (
            <Chip
              label="Desde rutina"
              active={false}
              onPress={() => applyAutofill("fromRoutine")}
            />
          ) : null}
          <Chip
            label="Limpiar"
            active={false}
            onPress={() => applyAutofill("clear")}
          />
        </Row>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-set editor row

interface PlanSetRowProps {
  set: PlannedSet;
  /** 1-based work index. 0 if warmup. */
  setIndex: number;
  onChange: (patch: Partial<PlannedSet>) => void;
  onRemove: () => void;
  onToggleWarmup: () => void;
}

function PlanSetRow({
  set,
  setIndex,
  onChange,
  onRemove,
  onToggleWarmup,
}: PlanSetRowProps) {
  const colors = useThemeColors();

  const badgeBg = set.isWarmup ? colors.surfaceAlt : "transparent";
  const badgeBorder = set.isWarmup ? "transparent" : colors.border;
  const badgeText = set.isWarmup ? colors.mHombros : colors.muted;

  return (
    <Row gap={6} ai="center">
      <Pressable
        onPress={onToggleWarmup}
        hitSlop={4}
        style={({ pressed }) => ({
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: badgeBg,
          borderColor: badgeBorder,
          borderWidth: set.isWarmup ? 0 : 1,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text variant="label" weight="bold" color={badgeText}>
          {set.isWarmup ? "C" : String(setIndex)}
        </Text>
      </Pressable>

      <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
        <NumericCell
          value={set.weight}
          placeholder="kg"
          onChange={(n) => onChange({ weight: n })}
          decimal
        />
        <NumericCell
          value={set.reps}
          placeholder="reps"
          onChange={(n) => onChange({ reps: n })}
        />
        {set.isWarmup ? (
          <View
            style={{
              flex: 1,
              height: 36,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "transparent",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.4,
            }}
          >
            <Text variant="mono" color={colors.muted}>
              —
            </Text>
          </View>
        ) : (
          <NumericCell
            value={set.rpe}
            placeholder="rpe"
            onChange={(n) => onChange({ rpe: n })}
            decimal
          />
        )}
      </View>

      <Pressable
        onPress={onRemove}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 28,
          height: 28,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.5 : 0.7,
        })}
      >
        <Feather name="x" size={14} color={colors.muted} />
      </Pressable>
    </Row>
  );
}

interface NumericCellProps {
  value: number | undefined;
  placeholder: string;
  onChange: (n: number | undefined) => void;
  decimal?: boolean;
}

function NumericCell({ value, placeholder, onChange, decimal }: NumericCellProps) {
  const colors = useThemeColors();
  const [text, setText] = useState<string>(value != null ? String(value) : "");

  // Keep local text in sync if upstream resets (e.g. autofill applied).
  useEffect(() => {
    setText(value != null ? String(value) : "");
  }, [value]);

  const commit = (next: string) => {
    setText(next);
    if (next.trim() === "") {
      onChange(undefined);
      return;
    }
    const parsed = decimal ? parseFloat(next) : parseInt(next, 10);
    if (Number.isFinite(parsed)) onChange(parsed);
  };

  return (
    <TextInput
      value={text}
      onChangeText={commit}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedSoft}
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      style={{
        flex: 1,
        height: 36,
        borderRadius: 8,
        paddingHorizontal: 6,
        fontSize: 14,
        textAlign: "center",
        fontFamily: Platform.select({
          ios: "Menlo",
          android: "monospace",
          default: "monospace",
        }),
        fontWeight: "600",
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.ink,
        backgroundColor: "transparent",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers

function buildInitialSets(
  re: RoutineExercise,
  lastSets: CompletedSet[],
): PlannedSet[] {
  const sets: PlannedSet[] = [];
  for (let i = 0; i < re.warmupSets; i++) {
    sets.push({ isWarmup: true });
  }
  // Seed work sets from last session if available, falling back to routine
  // targets. This makes the first edit feel like "preset for me" rather than
  // a blank slate.
  for (let i = 0; i < re.targetSets; i++) {
    const ref = lastSets[i] ?? lastSets[lastSets.length - 1];
    sets.push({
      isWarmup: false,
      weight: ref?.weight,
      reps: ref?.reps ?? re.targetReps,
      rpe: ref?.rpe,
    });
  }
  return sets;
}

function buildRecommendation(lastSets: CompletedSet[]): string | null {
  if (lastSets.length === 0) return "Empezá liviano y observá cómo va.";
  const rpeValues = lastSets.map((s) => s.rpe).filter((x): x is number => x != null);
  if (rpeValues.length === 0) return null;
  const avg = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length;
  if (avg >= 9) return "Última fue dura — repetí o bajá un poco.";
  if (avg <= 7) return "Te sobró margen — probá +2,5 kg.";
  return "Buen rango — mantené o subí poco.";
}

function countWorkBefore(sets: PlannedSet[], idx: number): number {
  let n = 0;
  for (let i = 0; i < idx; i++) if (!sets[i].isWarmup) n++;
  return n;
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function todayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDayKey(a: string, b: string): boolean {
  return a === b;
}

function parseDateKey(k: string): Date {
  const [y, m, d] = k.split("-").map((s) => parseInt(s, 10));
  const date = new Date();
  date.setFullYear(y, (m ?? 1) - 1, d ?? 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Returns one (x, y) point per session where the exercise appeared, with the
 * session's max work-set weight as y. Last 6 sessions, oldest → newest.
 */
function computeExerciseHistory(
  exerciseId: string,
  sessions: import("@/types").WorkoutSession[],
): { x: number; y: number }[] {
  const points: { ts: number; max: number }[] = [];
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const setsForEx = s.sets.filter(
      (set) => set.exerciseId === exerciseId && !set.isWarmup,
    );
    if (setsForEx.length === 0) continue;
    const max = setsForEx.reduce((m, x) => Math.max(m, x.weight), 0);
    points.push({ ts: s.endedAt, max });
  }
  return points
    .sort((a, b) => a.ts - b.ts)
    .slice(-6)
    .map((p, i) => ({ x: i, y: p.max }));
}
