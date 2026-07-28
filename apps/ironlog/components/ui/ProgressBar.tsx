import React from "react";
import { View } from "react-native";

import { useThemeColors } from "@/contexts/ThemeContext";

interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  height?: number;
  bg?: string;
}

export function ProgressBar({ value, max, color, height = 4, bg }: ProgressBarProps) {
  const colors = useThemeColors();
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <View
      style={{
        height,
        borderRadius: 999,
        backgroundColor: bg ?? colors.surfaceAlt,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: "100%",
          backgroundColor: color ?? colors.ink,
          borderRadius: 999,
        }}
      />
    </View>
  );
}
