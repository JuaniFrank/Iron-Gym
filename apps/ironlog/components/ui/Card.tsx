import React from "react";
import { Pressable, View, ViewStyle } from "react-native";

import { useThemeColors } from "@/contexts/ThemeContext";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: number;
  variant?: "default" | "accent" | "ink" | "ghost";
  radius?: number;
}

export function Card({
  children,
  style,
  onPress,
  padding = 18,
  variant = "default",
  radius = 20,
}: CardProps) {
  const colors = useThemeColors();

  const palette = (() => {
    switch (variant) {
      case "accent":
        return { bg: colors.accentSoft, border: colors.accentEdge };
      case "ink":
        return { bg: colors.ink, border: colors.ink };
      case "ghost":
        return { bg: "transparent", border: colors.border };
      default:
        return { bg: colors.surface, border: colors.border };
    }
  })();

  const cardStyle: ViewStyle = {
    backgroundColor: palette.bg,
    borderRadius: radius,
    padding,
    borderWidth: 1,
    borderColor: palette.border,
    ...style,
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.92 : 1 }]}>
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}
