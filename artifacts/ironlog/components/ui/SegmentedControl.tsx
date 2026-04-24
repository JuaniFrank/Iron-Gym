import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface SegmentedControlProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const colors = useThemeColors();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.secondary,
        padding: 4,
        borderRadius: colors.radius,
      }}
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
              paddingHorizontal: 12,
              borderRadius: colors.radius - 4,
              backgroundColor: active ? colors.card : "transparent",
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              variant="label"
              color={active ? colors.foreground : colors.mutedForeground}
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
