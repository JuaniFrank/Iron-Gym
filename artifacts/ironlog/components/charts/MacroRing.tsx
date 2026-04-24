import React from "react";
import Svg, { Circle, G, Text as SvgText } from "react-native-svg";

import { useThemeColors } from "@/contexts/ThemeContext";

interface MacroRingProps {
  size?: number;
  consumed: number;
  goal: number;
  thickness?: number;
  label?: string;
}

export function MacroRing({
  size = 180,
  consumed,
  goal,
  thickness = 14,
  label = "kcal",
}: MacroRingProps) {
  const colors = useThemeColors();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const offset = circumference * (1 - pct);
  const remaining = Math.max(0, goal - consumed);

  return (
    <Svg width={size} height={size}>
      <G rotation={-90} originX={size / 2} originY={size / 2}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.secondary}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={thickness}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </G>
      <SvgText
        x={size / 2}
        y={size / 2 - 4}
        fontSize={36}
        fontFamily="Inter_700Bold"
        fill={colors.foreground}
        textAnchor="middle"
      >
        {Math.round(remaining)}
      </SvgText>
      <SvgText
        x={size / 2}
        y={size / 2 + 18}
        fontSize={11}
        fontFamily="Inter_500Medium"
        fill={colors.mutedForeground}
        textAnchor="middle"
      >
        {label} restantes
      </SvgText>
    </Svg>
  );
}
