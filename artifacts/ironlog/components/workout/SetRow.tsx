import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface SetRowProps {
  index: number;
  isWarmup?: boolean;
  initialWeight?: number;
  initialReps?: number;
  previousWeight?: number;
  previousReps?: number;
  completed: boolean;
  /** Highlights the row as a PR (lime tinted bg + edge border). */
  isPr?: boolean;
  /** Highlights the row as the active/next set. */
  isActive?: boolean;
  onComplete: (weight: number, reps: number, rpe?: number) => void;
  onUncomplete: () => void;
  onRemove: () => void;
}

export function SetRow({
  index,
  isWarmup,
  initialWeight,
  initialReps,
  previousWeight,
  previousReps,
  completed,
  isPr,
  isActive,
  onComplete,
  onUncomplete,
  onRemove,
}: SetRowProps) {
  const colors = useThemeColors();
  const [weight, setWeight] = useState<string>(
    initialWeight != null ? String(initialWeight) : previousWeight != null ? String(previousWeight) : "",
  );
  const [reps, setReps] = useState<string>(
    initialReps != null ? String(initialReps) : previousReps != null ? String(previousReps) : "",
  );
  const [rpe, setRpe] = useState<string>("");

  const setLabel = isWarmup ? "C" : String(index);

  const handleComplete = () => {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps, 10) || 0;
    if (r === 0) return;
    const rpeVal = rpe ? parseFloat(rpe) : undefined;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(w, r, rpeVal);
  };

  // Set badge fill: warmup → orange-yellow, completed work → lime, otherwise outline.
  const badgeBg = completed ? (isWarmup ? colors.mHombros : colors.accent) : "transparent";
  const badgeBorder = completed ? "transparent" : colors.border;
  const badgeText = completed
    ? colors.accentInk
    : isWarmup
      ? colors.mHombros
      : colors.muted;

  const cellBg = completed ? colors.surfaceAlt : "transparent";
  const cellBorder = isActive ? colors.ink : colors.border;

  const checkBg = completed ? colors.accent : "transparent";
  const checkBorder = completed ? colors.accentEdge : colors.border;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: isPr ? colors.accentSoft : "transparent",
          borderColor: isPr ? colors.accentEdge : "transparent",
          borderWidth: isPr ? 1 : 0,
          padding: isPr ? 4 : 0,
        },
      ]}
    >
      <View
        style={[
          styles.setBadge,
          {
            backgroundColor: badgeBg,
            borderColor: badgeBorder,
            borderWidth: completed ? 0 : 1,
          },
        ]}
      >
        <Text variant="label" weight="bold" color={badgeText}>
          {setLabel}
        </Text>
      </View>

      <View style={styles.previousContainer}>
        <Text variant="mono" color={colors.muted} style={{ fontSize: 11, textAlign: "center" }}>
          {previousWeight != null && previousReps != null
            ? `${previousWeight}×${previousReps}`
            : "—"}
        </Text>
      </View>

      <View style={styles.inputsContainer}>
        <TextInput
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={colors.muted}
          editable={!completed}
          style={[
            styles.input,
            {
              color: colors.ink,
              backgroundColor: cellBg,
              borderColor: cellBorder,
            },
          ]}
        />
        <TextInput
          value={reps}
          onChangeText={setReps}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.muted}
          editable={!completed}
          style={[
            styles.input,
            {
              color: colors.ink,
              backgroundColor: cellBg,
              borderColor: cellBorder,
            },
          ]}
        />
        {!isWarmup ? (
          <TextInput
            value={rpe}
            onChangeText={setRpe}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={colors.muted}
            editable={!completed}
            style={[
              styles.input,
              {
                color: colors.ink,
                backgroundColor: cellBg,
                borderColor: cellBorder,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.input,
              {
                backgroundColor: cellBg,
                borderColor: cellBorder,
                opacity: 0.4,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <Text variant="mono" color={colors.muted}>
              —
            </Text>
          </View>
        )}
      </View>

      <Pressable
        onPress={completed ? onUncomplete : handleComplete}
        onLongPress={onRemove}
        style={({ pressed }) => [
          styles.checkBtn,
          {
            backgroundColor: checkBg,
            borderColor: checkBorder,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather
          name="check"
          size={14}
          color={completed ? colors.accentInk : colors.muted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
  },
  setBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  previousContainer: {
    width: 56,
  },
  inputsContainer: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  input: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 6,
    fontSize: 14,
    textAlign: "center",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontWeight: "600",
    borderWidth: 1,
  },
  checkBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
