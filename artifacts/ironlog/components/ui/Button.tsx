import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";

import { useThemeColors } from "@/contexts/ThemeContext";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "dark";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  label?: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Feather.glyphMap;
  iconRight?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  haptic?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  disabled,
  loading,
  style,
  fullWidth,
  haptic = true,
}: ButtonProps) {
  const colors = useThemeColors();

  const heights: Record<Size, number> = { sm: 36, md: 48, lg: 56 };
  const paddings: Record<Size, number> = { sm: 14, md: 20, lg: 24 };
  const fontSizes: Record<Size, number> = { sm: 13, md: 15, lg: 16 };
  const iconSizes: Record<Size, number> = { sm: 14, md: 16, lg: 18 };
  const radii: Record<Size, number> = { sm: 12, md: 14, lg: 18 };

  const variantStyle = (() => {
    switch (variant) {
      case "primary":
        return { bg: colors.accent, fg: colors.accentInk, border: colors.accentEdge };
      case "dark":
        return { bg: colors.ink, fg: colors.bg, border: colors.ink };
      case "secondary":
        return { bg: colors.surface, fg: colors.ink, border: colors.border };
      case "ghost":
        return { bg: "transparent", fg: colors.ink, border: "transparent" };
      case "danger":
        return { bg: "transparent", fg: colors.danger, border: colors.danger };
      case "outline":
        return { bg: "transparent", fg: colors.ink, border: colors.borderStrong };
    }
  })();

  const handlePress = () => {
    if (haptic && Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: paddings[size],
          backgroundColor: variantStyle.bg,
          borderColor: variantStyle.border,
          borderWidth: variant === "ghost" ? 0 : 1,
          borderRadius: radii[size],
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.fg} size="small" />
      ) : (
        <>
          {icon && <Feather name={icon} size={iconSizes[size]} color={variantStyle.fg} />}
          {label ? (
            <Text
              style={{
                color: variantStyle.fg,
                fontFamily: "Inter_600SemiBold",
                fontSize: fontSizes[size],
                letterSpacing: -0.1,
              }}
            >
              {label}
            </Text>
          ) : null}
          {iconRight && <Feather name={iconRight} size={iconSizes[size]} color={variantStyle.fg} />}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
