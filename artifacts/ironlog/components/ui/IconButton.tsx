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
  variant?: "filled" | "ghost" | "outline" | "primary";
  color?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export function IconButton({
  icon,
  onPress,
  size = 40,
  iconSize,
  variant = "filled",
  color,
  style,
  disabled,
}: IconButtonProps) {
  const colors = useThemeColors();
  const finalIconSize = iconSize ?? Math.round(size * 0.5);

  const variantStyle = (() => {
    switch (variant) {
      case "primary":
        return { bg: colors.primary, fg: colors.primaryForeground, border: "transparent" };
      case "ghost":
        return { bg: "transparent", fg: color ?? colors.foreground, border: "transparent" };
      case "outline":
        return { bg: "transparent", fg: color ?? colors.foreground, border: colors.border };
      case "filled":
      default:
        return { bg: colors.secondary, fg: color ?? colors.foreground, border: "transparent" };
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
          borderWidth: variant === "outline" ? 1 : 0,
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
