import React from "react";
import { View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface MacroRingProps {
  size?: number;
  consumed: number;
  goal: number;
  thickness?: number;
  label?: string;
}

export function MacroRing({
  size = 140,
  consumed,
  goal,
  thickness = 13,
  label = "kcal restantes",
}: MacroRingProps) {
  const colors = useThemeColors();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const offset = circumference * (1 - pct);
  const remaining = Math.max(0, goal - consumed);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.surfaceAlt}
            strokeWidth={thickness}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.accent}
            strokeWidth={thickness}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text variant="monoLg" color={colors.ink}>
          {Math.round(remaining)}
        </Text>
        <Text variant="tiny" color={colors.muted} style={{ marginTop: 2 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}
