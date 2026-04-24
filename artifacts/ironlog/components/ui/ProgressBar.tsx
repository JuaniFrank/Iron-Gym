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

export function ProgressBar({ value, max, color, height = 8, bg }: ProgressBarProps) {
  const colors = useThemeColors();
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: bg ?? colors.secondary,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: "100%",
          backgroundColor: color ?? colors.primary,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}
