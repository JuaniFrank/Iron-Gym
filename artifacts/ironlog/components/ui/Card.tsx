import React from "react";
import { Platform, Pressable, StyleSheet, View, ViewStyle } from "react-native";

import { useThemeColors } from "@/contexts/ThemeContext";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: number;
}

export function Card({ children, style, onPress, padding = 16 }: CardProps) {
  const colors = useThemeColors();

  const cardStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: colors.radius,
    padding,
    borderWidth: 1,
    borderColor: colors.border,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 }
      : { elevation: 0 }),
    ...style,
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.85 : 1 }]}>
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

export const cardStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
