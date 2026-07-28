import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface PillGroupProps {
  label: string;
  options: { key: string; label: string }[];
  value: string | null;
  onChange: (key: string) => void;
}

/** Grupo de chips single-select con label arriba. Para sueño/energía. */
export function PillGroup({ label, options, value, onChange }: PillGroupProps) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: 8 }}>
      <Text variant="tiny" color={colors.muted}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {options.map((opt) => {
          const active = value === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                onChange(opt.key);
              }}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: active ? colors.ink : colors.surfaceAlt,
                borderWidth: 1,
                borderColor: active ? colors.ink : colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                variant="label"
                weight={active ? "semibold" : "medium"}
                color={active ? colors.bg : colors.ink}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface MultiSelectChipsProps {
  label: string;
  options: { key: string; label: string }[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}

/** Multi-select chips para "algo distinto". */
export function MultiSelectChips({
  label,
  options,
  selected,
  onToggle,
}: MultiSelectChipsProps) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: 8 }}>
      <Text variant="tiny" color={colors.muted}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = selected.has(opt.key);
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                onToggle(opt.key);
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? colors.accent : colors.surfaceAlt,
                borderWidth: 1,
                borderColor: active ? colors.accentEdge : colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                variant="label"
                weight={active ? "semibold" : "medium"}
                color={active ? colors.accentInk : colors.ink}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Catálogos de opciones del preflight
export const SLEEP_OPTIONS = [
  { key: "bad", label: "Mal" },
  { key: "ok", label: "OK" },
  { key: "good", label: "Bien" },
];

export const ENERGY_OPTIONS = [
  { key: "low", label: "Baja" },
  { key: "med", label: "Media" },
  { key: "high", label: "Alta" },
];

export const FACTOR_OPTIONS = [
  { key: "fast", label: "Ayuno" },
  { key: "post-cardio", label: "Post-cardio" },
  { key: "stress", label: "Stress" },
  { key: "travel", label: "Viaje" },
  { key: "sick", label: "Enfermedad" },
  { key: "return", label: "Vuelvo de descanso" },
  { key: "caffeine", label: "Cafeína" },
];

/** Mapeos para producir texto y severity al guardar como SessionNote. */
export const SLEEP_TEXT: Record<string, string> = {
  bad: "Dormí mal",
  ok: "Sueño OK",
  good: "Dormí bien",
};

export const SLEEP_SEVERITY: Record<string, number> = {
  bad: 2,
  ok: 5,
  good: 8,
};

export const ENERGY_TEXT: Record<string, string> = {
  low: "Energía baja",
  med: "Energía media",
  high: "Energía alta",
};

export const ENERGY_SEVERITY: Record<string, number> = {
  low: 2,
  med: 5,
  high: 8,
};

export const FACTOR_TEXT: Record<string, string> = {
  fast: "Ayuno",
  "post-cardio": "Post-cardio",
  stress: "Stress laboral",
  travel: "Viaje",
  sick: "Enfermedad reciente",
  return: "Vuelvo de descanso largo",
  caffeine: "Cafeína fuerte",
};
