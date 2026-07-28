import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, ViewStyle } from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  accentColor?: string;
}

export function Chip({ label, active, onPress, style, accentColor }: ChipProps) {
  const colors = useThemeColors();

  const bg = active ? accentColor ?? colors.ink : colors.surfaceAlt;
  const fg = active ? colors.bg : colors.ink;
  const border = active ? bg : colors.border;

  const node = (
    <>
      <Text variant="label" weight={active ? "semibold" : "medium"} color={fg}>
        {label}
      </Text>
    </>
  );

  const baseStyle: ViewStyle = {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          onPress();
        }}
        style={({ pressed }) => [baseStyle, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {node}
      </Pressable>
    );
  }

  return <Pressable disabled style={[baseStyle, style]}>{node}</Pressable>;
}
