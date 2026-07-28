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
  variant?: "lime" | "ink" | "soft" | "outline";
}

export function Badge({ label, color, bg, style, size = "md", variant = "lime" }: BadgeProps) {
  const colors = useThemeColors();
  const palette = (() => {
    switch (variant) {
      case "ink":
        return { bg: colors.ink, fg: colors.bg, border: "transparent" };
      case "soft":
        return { bg: colors.surfaceAlt, fg: colors.ink, border: colors.border };
      case "outline":
        return { bg: "transparent", fg: colors.ink, border: colors.borderStrong };
      case "lime":
      default:
        return { bg: colors.accent, fg: colors.accentInk, border: "transparent" };
    }
  })();

  return (
    <View
      style={[
        {
          backgroundColor: bg ?? palette.bg,
          paddingHorizontal: size === "sm" ? 6 : 8,
          paddingVertical: size === "sm" ? 2 : 3,
          borderRadius: 6,
          alignSelf: "flex-start",
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      <Text variant="tiny" color={color ?? palette.fg}>
        {label}
      </Text>
    </View>
  );
}
