import React from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { MUSCLE_GROUP_LABELS } from "@/constants/exercises";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { MuscleGroup } from "@/types";

interface MuscleGroupChipProps {
  group: MuscleGroup | "all";
  active?: boolean;
  onPress?: () => void;
}

export function MuscleGroupChip({ group, active, onPress }: MuscleGroupChipProps) {
  const colors = useThemeColors();

  const colorMap: Record<string, string> = {
    chest: colors.chestColor,
    back: colors.backColor,
    shoulders: colors.shouldersColor,
    biceps: colors.armsColor,
    triceps: colors.armsColor,
    quadriceps: colors.legsColor,
    hamstrings: colors.legsColor,
    glutes: colors.legsColor,
    calves: colors.legsColor,
    abs: colors.coreColor,
    forearms: colors.armsColor,
    all: colors.primary,
  };

  const baseColor = colorMap[group] ?? colors.primary;
  const label = group === "all" ? "Todos" : MUSCLE_GROUP_LABELS[group];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? baseColor : colors.secondary,
        borderWidth: 1,
        borderColor: active ? baseColor : "transparent",
        opacity: pressed ? 0.85 : 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      })}
    >
      {!active ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: baseColor,
          }}
        />
      ) : null}
      <Text
        variant="caption"
        weight="semibold"
        color={active ? "#FFFFFF" : colors.foreground}
      >
        {label}
      </Text>
    </Pressable>
  );
}
