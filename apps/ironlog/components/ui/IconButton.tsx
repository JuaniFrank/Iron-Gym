import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, ViewStyle } from "react-native";

import { useThemeColors } from "@/contexts/ThemeContext";

interface IconButtonProps {
  icon: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  variant?: "filled" | "ghost" | "outline" | "primary" | "ink";
  color?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export function IconButton({
  icon,
  onPress,
  size = 36,
  iconSize,
  variant = "outline",
  color,
  style,
  disabled,
}: IconButtonProps) {
  const colors = useThemeColors();
  const finalIconSize = iconSize ?? Math.round(size * 0.5);

  const variantStyle = (() => {
    switch (variant) {
      case "primary":
        return { bg: colors.accent, fg: color ?? colors.accentInk, border: colors.accentEdge };
      case "ink":
        return { bg: colors.ink, fg: color ?? colors.bg, border: colors.ink };
      case "ghost":
        return { bg: "transparent", fg: color ?? colors.ink, border: "transparent" };
      case "filled":
        return { bg: colors.surfaceAlt, fg: color ?? colors.ink, border: "transparent" };
      case "outline":
      default:
        return { bg: colors.surface, fg: color ?? colors.ink, border: colors.border };
    }
  })();

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync();
        onPress?.();
      }}
      hitSlop={8}
      disabled={disabled}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: variantStyle.bg,
          borderWidth: variant === "ghost" ? 0 : 1,
          borderColor: variantStyle.border,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Feather name={icon} size={finalIconSize} color={variantStyle.fg} />
    </Pressable>
  );
}
