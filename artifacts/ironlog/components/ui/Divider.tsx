import React from "react";
import { View, ViewStyle } from "react-native";

import { useThemeColors } from "@/contexts/ThemeContext";

interface DividerProps {
  vertical?: boolean;
  color?: string;
  style?: ViewStyle;
}

export function Divider({ vertical, color, style }: DividerProps) {
  const colors = useThemeColors();
  if (vertical) {
    return (
      <View
        style={[
          { width: 1, alignSelf: "stretch", backgroundColor: color ?? colors.border },
          style,
        ]}
      />
    );
  }
  return (
    <View
      style={[
        { height: 1, width: "100%", backgroundColor: color ?? colors.border },
        style,
      ]}
    />
  );
}
