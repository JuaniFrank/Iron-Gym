import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
} from "@/constants/noteChips";
import type { NoteCategory } from "@/types";

interface CategoryChipsProps {
  value: NoteCategory | null;
  onChange: (category: NoteCategory) => void;
  /** Categorías a ocultar (ej. en preflight solo mostramos energy/mood). */
  exclude?: NoteCategory[];
}

const ALL_CATEGORIES: NoteCategory[] = [
  "pain",
  "effort",
  "technique",
  "equipment",
  "energy",
  "mood",
  "other",
];

export function CategoryChips({
  value,
  onChange,
  exclude = [],
}: CategoryChipsProps) {
  const categories = ALL_CATEGORIES.filter((c) => !exclude.includes(c));
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {categories.map((category) => (
        <CategoryChip
          key={category}
          category={category}
          active={value === category}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            onChange(category);
          }}
        />
      ))}
    </View>
  );
}

function CategoryChip({
  category,
  active,
  onPress,
}: {
  category: NoteCategory;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const bg = active ? colors.ink : colors.surfaceAlt;
  const border = active ? colors.ink : colors.border;
  const fg = active ? colors.bg : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Feather name={CATEGORY_ICON[category]} size={13} color={fg} />
      <Text variant="label" weight={active ? "semibold" : "medium"} color={fg}>
        {CATEGORY_LABEL[category]}
      </Text>
    </Pressable>
  );
}
