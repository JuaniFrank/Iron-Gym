import React from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface BarRowProps {
  label: string;
  value: number;
  max: number;
  color?: string;
  format?: (v: number) => string;
  secondaryLabel?: string;
}

export function BarRow({ label, value, max, color, format = (v) => v.toFixed(0), secondaryLabel }: BarRowProps) {
  const colors = useThemeColors();
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="label">{label}</Text>
        <Text variant="label" muted>
          {format(value)}
          {secondaryLabel ? ` ${secondaryLabel}` : ""}
        </Text>
      </View>
      <View
        style={{
          height: 8,
          backgroundColor: colors.secondary,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            backgroundColor: color ?? colors.primary,
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  );
}
