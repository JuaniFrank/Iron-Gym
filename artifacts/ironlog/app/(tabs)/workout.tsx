import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";

const GOAL_LABELS: Record<string, string> = {
  strength: "Fuerza",
  hypertrophy: "Hipertrofia",
  cutting: "Definición",
  beginner: "Principiante",
};

export default function WorkoutScreen() {
  const colors = useThemeColors();
  const { allRoutines, routines, activeWorkoutId, startEmptyWorkout, cloneRoutine } = useIronLog();
  const [tab, setTab] = useState<"mine" | "presets">("mine");

  const myRoutines = routines;
  const presets = allRoutines.filter((r) => r.isPreset);
  const display = tab === "mine" ? myRoutines : presets;

  return (
    <Screen scroll>
      <View style={{ marginBottom: 16 }}>
        <Text variant="h1">Entrenar</Text>
        <Text variant="body" muted>
          {myRoutines.length} {myRoutines.length === 1 ? "rutina" : "rutinas"} ·{" "}
          {presets.length} predefinidas
        </Text>
      </View>

      {/* Active workout banner */}
      {activeWorkoutId ? (
        <Pressable onPress={() => router.push("/workout/active")} style={{ marginBottom: 16 }}>
          <Card style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.25)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="zap" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="title" color="#FFFFFF">
                  Sesión en curso
                </Text>
                <Text variant="caption" color="rgba(255,255,255,0.85)">
                  Toca para continuar
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="#FFFFFF" />
            </View>
          </Card>
        </Pressable>
      ) : null}

      {/* Quick start */}
      <Card style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Feather name="zap" size={18} color={colors.primary} />
          <Text variant="title" style={{ marginLeft: 8 }}>
            Inicio rápido
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label="Sesión libre"
            icon="plus"
            variant="primary"
            style={{ flex: 1 }}
            onPress={() => {
              const s = startEmptyWorkout();
              router.push("/workout/active");
            }}
            disabled={!!activeWorkoutId}
          />
          <Button
            label="Nueva rutina"
            icon="bookmark"
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => router.push("/routine/new")}
          />
        </View>
      </Card>

      <SegmentedControl
        options={[
          { label: "Mis rutinas", value: "mine" },
          { label: "Predefinidas", value: "presets" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <View style={{ marginTop: 16, gap: 10 }}>
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
            <Pressable
              key={r.id}
              onPress={() => router.push(`/routine/${r.id}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: r.isPreset ? colors.accent : colors.secondary,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Feather
                      name={r.isPreset ? "star" : "bookmark"}
                      size={20}
                      color={r.isPreset ? colors.primary : colors.foreground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
                        {r.name}
                      </Text>
                      {r.goal ? (
                        <View
                          style={{
                            backgroundColor: colors.secondary,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 8,
                          }}
                        >
                          <Text variant="tiny" muted>
                            {GOAL_LABELS[r.goal]}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text variant="caption" muted style={{ marginTop: 2 }}>
                      {r.days.length} {r.days.length === 1 ? "día" : "días"} ·{" "}
                      {r.days.reduce((sum, d) => sum + d.exercises.length, 0)} ejercicios
                    </Text>
                  </View>

                  {r.isPreset ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        const cloned = cloneRoutine(r.id);
                        if (cloned) router.push(`/routine/${cloned.id}`);
                      }}
                      hitSlop={8}
                      style={({ pressed }) => ({
                        padding: 8,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Feather name="copy" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  ) : (
                    <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                  )}
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}
