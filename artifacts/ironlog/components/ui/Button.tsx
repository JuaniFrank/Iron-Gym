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

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
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
  const paddings: Record<Size, number> = { sm: 12, md: 18, lg: 22 };
  const fontSizes: Record<Size, number> = { sm: 13, md: 15, lg: 17 };
  const iconSizes: Record<Size, number> = { sm: 16, md: 18, lg: 20 };

  const variantStyle = (() => {
    switch (variant) {
      case "primary":
        return { bg: colors.primary, fg: colors.primaryForeground, border: "transparent" };
      case "secondary":
        return { bg: colors.secondary, fg: colors.foreground, border: "transparent" };
      case "ghost":
        return { bg: "transparent", fg: colors.foreground, border: "transparent" };
      case "danger":
        return { bg: colors.destructive, fg: colors.destructiveForeground, border: "transparent" };
      case "outline":
        return { bg: "transparent", fg: colors.foreground, border: colors.border };
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
          borderWidth: variant === "outline" ? 1 : 0,
          borderRadius: colors.radius,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
          transform: [{ scale: pressed ? 0.98 : 1 }],
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
