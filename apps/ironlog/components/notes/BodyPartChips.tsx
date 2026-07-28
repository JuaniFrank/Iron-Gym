import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Platform, Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import {
  BODY_PART_LABEL,
  BODY_PART_SHORT_LABEL,
  TOP_BODY_PARTS,
} from "@/constants/bodyParts";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { BodyPart } from "@/types";

interface BodyPartChipsProps {
  value: BodyPart | null;
  onChange: (bodyPart: BodyPart | null) => void;
  /** Si true, permite multi-select. v1 solo single-select. */
  multi?: boolean;
}

const ALL_BODY_PARTS: BodyPart[] = [
  "shoulder_left",
  "shoulder_right",
  "elbow_left",
  "elbow_right",
  "wrist_left",
  "wrist_right",
  "neck",
  "upper_back",
  "lower_back",
  "chest",
  "abs",
  "hip_left",
  "hip_right",
  "knee_left",
  "knee_right",
  "ankle_left",
  "ankle_right",
];

export function BodyPartChips({ value, onChange }: BodyPartChipsProps) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? ALL_BODY_PARTS : TOP_BODY_PARTS;

  const handleSelect = (part: BodyPart) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onChange(value === part ? null : part);
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {visible.map((part) => {
          const active = value === part;
          return (
            <Pressable
              key={part}
              onPress={() => handleSelect(part)}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 7,
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
                {expanded ? BODY_PART_LABEL[part] : BODY_PART_SHORT_LABEL[part]}
              </Text>
            </Pressable>
          );
        })}
        {!expanded ? (
          <Pressable
            onPress={() => setExpanded(true)}
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text variant="label" color={colors.muted}>
              + ver todas
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
