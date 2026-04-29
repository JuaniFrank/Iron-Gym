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
  /** Pre-defined target values from a SessionPlan. Used to pre-fill the
   *  inputs before the set is completed, with priority over `previousX`. */
  plannedWeight?: number;
  plannedReps?: number;
  plannedRpe?: number;
  completed: boolean;
  /** Highlights the row as a PR (lime tinted bg + edge border). */
  isPr?: boolean;
  /** Highlights the row as the active/next set. */
  isActive?: boolean;
  /** Si este set ya tiene 1+ notas. Muestra badge "•" en el check. */
  hasNotes?: boolean;
  onComplete: (weight: number, reps: number, rpe?: number) => void;
  onUncomplete: () => void;
  onRemove: () => void;
  /** Tap en el ícono edit-2 al lado del check. Abre NoteSheet. */
  onNotePress?: () => void;
  /** Long-press en el botón check. Si se omite, fallback al onRemove
   *  (preserva comportamiento legacy). */
  onCheckLongPress?: () => void;
}

export function SetRow({
  index,
  isWarmup,
  initialWeight,
  initialReps,
  previousWeight,
  previousReps,
  plannedWeight,
  plannedReps,
  plannedRpe,
  completed,
  isPr,
  isActive,
  hasNotes,
  onComplete,
  onUncomplete,
  onRemove,
  onNotePress,
  onCheckLongPress,
}: SetRowProps) {
  const colors = useThemeColors();
  // Pre-fill priority for not-yet-completed sets: plan > previous > empty.
  // When completed, we always show the actual value (`initialX`).
  const [weight, setWeight] = useState<string>(
    initialWeight != null
      ? String(initialWeight)
      : plannedWeight != null
        ? String(plannedWeight)
        : previousWeight != null
          ? String(previousWeight)
          : "",
  );
  const [reps, setReps] = useState<string>(
    initialReps != null
      ? String(initialReps)
      : plannedReps != null
        ? String(plannedReps)
        : previousReps != null
          ? String(previousReps)
          : "",
  );
  const [rpe, setRpe] = useState<string>(
    plannedRpe != null && !completed ? String(plannedRpe) : "",
  );

  const isPlanned =
    !completed &&
    (plannedWeight != null || plannedReps != null || plannedRpe != null);

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

  // Cell visuals — orden de prioridad:
  // 1. completed → fondo gris atenuado (ya está, atrás)
  // 2. active (próximo a hacer) → fondo neutro + border ink fuerte (presencia)
  // 3. planned (futuro con valores prefijados) → bg transparente, solo border
  //    accentEdge sutil para señalar "valor sugerido". Esto evita que se
  //    confunda con el active/PR styling, que también es lima.
  // 4. blank → border default.
  const cellBg = completed
    ? colors.surfaceAlt
    : "transparent";
  const cellBorder = isActive
    ? colors.ink
    : isPlanned
      ? colors.accentEdge
      : colors.border;
  const cellBorderWidth = isActive ? 1.5 : 1;

  const checkBg = completed ? colors.accent : "transparent";
  const checkBorder = completed ? colors.accentEdge : colors.border;

  // Wrapper highlight — solo PR. El active row se distingue por borders más
  // fuertes en los inputs, no por wrapper, para no chocar con el PR styling.
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
              borderWidth: cellBorderWidth,
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
              borderWidth: cellBorderWidth,
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
                borderWidth: cellBorderWidth,
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

      {onNotePress ? (
        <Pressable
          onPress={onNotePress}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 22,
            height: 28,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.5 : hasNotes ? 1 : 0.55,
          })}
        >
          <Feather
            name="edit-2"
            size={12}
            color={hasNotes ? colors.accentEdge : colors.muted}
          />
        </Pressable>
      ) : null}

      <Pressable
        onPress={completed ? onUncomplete : handleComplete}
        onLongPress={onCheckLongPress ?? onRemove}
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
        {hasNotes ? (
          <View
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.accentEdge,
            }}
          />
        ) : null}
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
