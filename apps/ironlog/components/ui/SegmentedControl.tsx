import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, View, ViewStyle } from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface SegmentedControlProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  style?: ViewStyle;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        {
          flexDirection: "row",
          backgroundColor: colors.surfaceAlt,
          padding: 4,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              onChange(opt.value);
            }}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 10,
              backgroundColor: active ? colors.surface : "transparent",
              borderWidth: 1,
              borderColor: active ? colors.border : "transparent",
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              variant="label"
              color={active ? colors.ink : colors.muted}
              weight={active ? "semibold" : "medium"}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
