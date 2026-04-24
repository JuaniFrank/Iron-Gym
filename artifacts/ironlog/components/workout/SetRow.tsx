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
  const setColor = isWarmup ? colors.warning : colors.foreground;

  const handleComplete = () => {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps, 10) || 0;
    if (r === 0) return;
    const rpeVal = rpe ? parseFloat(rpe) : undefined;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(w, r, rpeVal);
  };

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: completed ? colors.accent : colors.secondary,
          borderColor: completed ? colors.primary : "transparent",
          borderWidth: 1,
          opacity: completed ? 1 : 1,
        },
      ]}
    >
      <View style={[styles.setBadge, { backgroundColor: completed ? colors.primary : colors.background }]}>
        <Text
          variant="label"
          weight="bold"
          color={completed ? colors.primaryForeground : setColor}
        >
          {setLabel}
        </Text>
      </View>

      <View style={styles.previousContainer}>
        <Text variant="caption" muted style={{ textAlign: "center" }}>
          {previousWeight != null && previousReps != null
            ? `${previousWeight} × ${previousReps}`
            : "—"}
        </Text>
      </View>

      <View style={styles.inputsContainer}>
        <TextInput
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          editable={!completed}
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: completed ? "transparent" : colors.background,
              fontFamily: "Inter_600SemiBold",
            },
          ]}
        />
        <TextInput
          value={reps}
          onChangeText={setReps}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          editable={!completed}
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: completed ? "transparent" : colors.background,
              fontFamily: "Inter_600SemiBold",
            },
          ]}
        />
        {!isWarmup ? (
          <TextInput
            value={rpe}
            onChangeText={setRpe}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={colors.mutedForeground}
            editable={!completed}
            style={[
              styles.input,
              {
                color: colors.mutedForeground,
                backgroundColor: completed ? "transparent" : colors.background,
                fontFamily: "Inter_500Medium",
              },
            ]}
          />
        ) : (
          <View style={styles.input} />
        )}
      </View>

      <Pressable
        onPress={completed ? onUncomplete : handleComplete}
        onLongPress={onRemove}
        style={({ pressed }) => [
          styles.checkBtn,
          {
            backgroundColor: completed ? colors.primary : colors.background,
            borderColor: completed ? colors.primary : colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather
          name={completed ? "check" : "check"}
          size={18}
          color={completed ? colors.primaryForeground : colors.mutedForeground}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  setBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  previousContainer: {
    width: 64,
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
    paddingHorizontal: 8,
    fontSize: 15,
    textAlign: "center",
  },
  checkBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
