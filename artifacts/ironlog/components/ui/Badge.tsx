import React from "react";
import { View, ViewStyle } from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface BadgeProps {
  label: string;
  color?: string;
  bg?: string;
  style?: ViewStyle;
  size?: "sm" | "md";
}

export function Badge({ label, color, bg, style, size = "md" }: BadgeProps) {
  const colors = useThemeColors();
  const finalBg = bg ?? colors.accent;
  const finalColor = color ?? colors.accentForeground;

  return (
    <View
      style={[
        {
          backgroundColor: finalBg,
          paddingHorizontal: size === "sm" ? 8 : 10,
          paddingVertical: size === "sm" ? 2 : 4,
          borderRadius: 999,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <Text variant={size === "sm" ? "tiny" : "caption"} color={finalColor} weight="semibold">
        {label}
      </Text>
    </View>
  );
}
