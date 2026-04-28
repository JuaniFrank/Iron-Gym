import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { Routine } from "@/types";

const GOAL_LABELS: Record<string, string> = {
  strength: "FUERZA",
  hypertrophy: "HIPERTROFIA",
  cutting: "DEFINICIÓN",
  beginner: "PRINCIPIANTE",
};

export default function WorkoutScreen() {
  const colors = useThemeColors();
  const { allRoutines, routines, activeWorkoutId, startEmptyWorkout, cloneRoutine } = useIronLog();
  const [tab, setTab] = useState<"mine" | "presets">("mine");

  const myRoutines = routines;
  const presets = allRoutines.filter((r) => r.isPreset);
  const display = tab === "mine" ? myRoutines : presets;

  const goalColor = (goal?: string) => {
    switch (goal) {
      case "strength":
        return colors.mEspalda;
      case "hypertrophy":
        return colors.mPecho;
      case "cutting":
        return colors.mPiernas;
      case "beginner":
        return colors.mHombros;
      default:
        return colors.muted;
    }
  };

  return (
    <Screen scroll noPadding tabBarSpacing>
      <Header title="Entrenar" subtitle={`${myRoutines.length} ${myRoutines.length === 1 ? "rutina" : "rutinas"} · ${presets.length} predefinidas`} />

      <View style={{ paddingHorizontal: 20 }}>
        {activeWorkoutId ? (
          <Pressable onPress={() => router.push("/workout/active")} style={{ marginBottom: 14 }}>
            <Card variant="accent">
              <Row gap={12}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather name="zap" size={18} color={colors.accentInk} />
                </View>
                <Col gap={2} flex={1}>
                  <Text variant="title" color={colors.accentEdge}>
                    Sesión en curso
                  </Text>
                  <Text variant="caption" muted>
                    Toca para continuar
                  </Text>
                </Col>
                <Feather name="chevron-right" size={18} color={colors.muted} />
              </Row>
            </Card>
          </Pressable>
        ) : null}

        {/* Quick start panel */}
        <View
          style={{
            backgroundColor: colors.ink,
            borderRadius: 24,
            padding: 20,
            marginBottom: 14,
          }}
        >
          <Row jc="space-between" style={{ marginBottom: 14 }}>
            <Text variant="tiny" color={colors.accent}>
              INICIO RÁPIDO
            </Text>
            <Feather name="zap" size={14} color={colors.accent} />
          </Row>
          <Text variant="h2" color={colors.bg} style={{ marginBottom: 16 }}>
            ¿Sin plan?{"\n"}Empieza ya.
          </Text>
          <Row gap={8}>
            <Pressable
              onPress={() => {
                if (activeWorkoutId) return;
                startEmptyWorkout();
                router.push("/workout/active");
              }}
              disabled={!!activeWorkoutId}
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.accent,
                opacity: activeWorkoutId ? 0.5 : pressed ? 0.85 : 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              })}
            >
              <Feather name="plus" size={14} color={colors.accentInk} />
              <Text variant="label" weight="semibold" color={colors.accentInk}>
                Sesión libre
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/routine/new")}
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: 12,
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: "rgba(242,240,232,0.25)",
                opacity: pressed ? 0.7 : 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              })}
            >
              <Feather name="bookmark" size={14} color={colors.bg} />
              <Text variant="label" color={colors.bg}>
                Nueva rutina
              </Text>
            </Pressable>
          </Row>
        </View>

        <SegmentedControl
          options={[
            { label: "Mis rutinas", value: "mine" },
            { label: "Predefinidas", value: "presets" },
          ]}
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 14 }}
        />

        <Col gap={8}>
          {display.length === 0 ? (
            tab === "mine" ? (
              <EmptyState
                icon="bookmark"
                title="Sin rutinas"
                description="Crea tu primera rutina o copia una predefinida para empezar."
                actionLabel="Crear rutina"
                onAction={() => router.push("/routine/new")}
              />
            ) : null
          ) : (
            display.map((r) => (
              <RoutineRow
                key={r.id}
                routine={r}
                goalColor={goalColor(r.goal)}
                goalLabel={r.goal ? GOAL_LABELS[r.goal] : null}
                onPress={() => router.push(`/routine/${r.id}`)}
                onClone={
                  r.isPreset
                    ? () => {
                        const cloned = cloneRoutine(r.id);
                        if (cloned) router.push(`/routine/${cloned.id}`);
                      }
                    : undefined
                }
              />
            ))
          )}
        </Col>

        {tab === "mine" && presets.length > 0 ? (
          <>
            <Text
              variant="tiny"
              color={colors.muted}
              style={{ paddingHorizontal: 4, paddingVertical: 14, marginTop: 8 }}
            >
              SUGERIDAS PARA TI
            </Text>
            <Col gap={8}>
              {presets.slice(0, 2).map((r) => (
                <RoutineRow
                  key={r.id}
                  routine={r}
                  goalColor={goalColor(r.goal)}
                  goalLabel={r.goal ? GOAL_LABELS[r.goal] : null}
                  onPress={() => router.push(`/routine/${r.id}`)}
                  onClone={() => {
                    const cloned = cloneRoutine(r.id);
                    if (cloned) router.push(`/routine/${cloned.id}`);
                  }}
                />
              ))}
            </Col>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function RoutineRow({
  routine,
  goalLabel,
  goalColor,
  onPress,
  onClone,
}: {
  routine: Routine;
  goalLabel: string | null;
  goalColor: string;
  onPress: () => void;
  onClone?: () => void;
}) {
  const colors = useThemeColors();
  const totalEx = routine.days.reduce((sum, d) => sum + d.exercises.length, 0);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      <Card padding={0}>
        <Row jc="space-between" style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
          <Row gap={12} flex={1}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: routine.isPreset ? colors.accentSoft : colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather
                name={routine.isPreset ? "star" : "bookmark"}
                size={18}
                color={routine.isPreset ? colors.accentEdge : colors.ink}
              />
            </View>
            <Col gap={4} flex={1}>
              <Row gap={6}>
                <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {routine.name}
                </Text>
                {goalLabel ? (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: goalColor + "55",
                    }}
                  >
                    <Text variant="tiny" color={goalColor}>
                      {goalLabel}
                    </Text>
                  </View>
                ) : null}
              </Row>
              <Text variant="caption" muted>
                {routine.days.length} {routine.days.length === 1 ? "día" : "días"} · {totalEx} ejercicios
              </Text>
            </Col>
          </Row>
          {onClone ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onClone();
              }}
              hitSlop={8}
              style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.5 : 1 })}
            >
              <Feather name="copy" size={16} color={colors.muted} />
            </Pressable>
          ) : (
            <Feather name="chevron-right" size={16} color={colors.muted} />
          )}
        </Row>
      </Card>
    </Pressable>
  );
}
