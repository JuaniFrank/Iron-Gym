import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";
import { MOOD_EMOJIS, MOOD_VALUES } from "@/utils/notes";

interface MoodSelectorProps {
  value: number | undefined;
  onChange: (severity: number) => void;
}

const LABELS = ["pésimo", "mal", "ok", "bien", "genial"] as const;

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
  const colors = useThemeColors();

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {MOOD_EMOJIS.map((emoji, i) => {
          const v = MOOD_VALUES[i];
          const active = value === v;
          return (
            <Pressable
              key={emoji}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                onChange(v);
              }}
              style={({ pressed }) => ({
                flex: 1,
                marginHorizontal: 3,
                aspectRatio: 1,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? colors.accent : colors.surfaceAlt,
                borderWidth: 1,
                borderColor: active ? colors.accentEdge : colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 28 }}>{emoji}</Text>
            </Pressable>
          );
        })}
      </View>
      {value != null ? (
        <Text variant="caption" color={colors.muted} style={{ textAlign: "center" }}>
          {LABELS[MOOD_VALUES.indexOf(value as (typeof MOOD_VALUES)[number])] ?? ""}
        </Text>
      ) : (
        <Text variant="caption" color={colors.muted} style={{ textAlign: "center" }}>
          Tap para elegir cómo te sentiste
        </Text>
      )}
    </View>
  );
}
