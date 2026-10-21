import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { Text } from "@/components/ui/Text";
import { TermHint } from "@/components/workout/TermHint";
import { useThemeColors } from "@/contexts/ThemeContext";
import {
  parseCompletion,
  parseDraftPatch,
  type ParsedDraftPatch,
  type SetInputStrings,
} from "@/domains/workout/setInputs";

/** Debounce of the draft autosave while the user is typing. */
const DRAFT_DEBOUNCE_MS = 300;

interface SetRowProps {
  index: number;
  isWarmup?: boolean;
  /** Initial text of the inputs, resolved by the screen with
   *  `resolveSetInputs` (completed > draft > planned > previous). The inputs
   *  are seeded once on mount, so the screen must only render the row after
   *  the plan and drafts have loaded. For a completed row the text follows the
   *  logged values (read-only). */
  initialInputs: SetInputStrings;
  previousWeight?: number;
  previousReps?: number;
  /** Target values from a SessionPlan. Only used to style the row as
   *  "planned"; the prefill itself arrives through `initialInputs`. */
  plannedWeight?: number;
  plannedReps?: number;
  completed: boolean;
  /** Highlights the row as a PR (lime tinted bg + edge border). */
  isPr?: boolean;
  /** Highlights the row as the active/next set. */
  isActive?: boolean;
  /** Si este set ya tiene 1+ notas. Muestra badge "•" en el check. */
  hasNotes?: boolean;
  /**
   * Resolve to `false` when the set could not be saved: the row then keeps
   * its pending draft instead of dropping it.
   */
  onComplete: (weight: number, reps: number, rpe?: number) => void | Promise<boolean>;
  onUncomplete: () => void;
  onRemove: () => void;
  /** Tap en el ícono edit-2 al lado del check. Abre NoteSheet. */
  onNotePress?: () => void;
  /** Long-press en el botón check. Si se omite, fallback al onRemove
   *  (preserva comportamiento legacy). */
  onCheckLongPress?: () => void;
  /** Debounced (300ms) autosave of the inputs of a not-completed row. Fires
   *  only after the user typed (never from values that came from the plan or
   *  previous session) and flushes any pending change on unmount. Omit to
   *  disable draft persistence. */
  onDraftChange?: (patch: ParsedDraftPatch) => void;
}

export function SetRow({
  index,
  isWarmup,
  initialInputs,
  previousWeight,
  previousReps,
  plannedWeight,
  plannedReps,
  completed,
  isPr,
  isActive,
  hasNotes,
  onComplete,
  onUncomplete,
  onRemove,
  onNotePress,
  onCheckLongPress,
  onDraftChange,
}: SetRowProps) {
  const colors = useThemeColors();
  // Small phones (iPhone 13 Pro = 390pt and below) cannot fit "42.5" in one
  // line once the note pencil is visible, so only they get tighter padding and
  // font; larger phones and tablets keep the regular sizing.
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 400;
  const inputFontSize = compact ? 13 : 14;
  const inputPaddingH = compact ? 4 : 6;
  const inputsGap = compact ? 4 : 6;
  const [weight, setWeight] = useState<string>(initialInputs.weight);
  const [reps, setReps] = useState<string>(initialInputs.reps);
  const [rpe, setRpe] = useState<string>(initialInputs.rpe);

  // Latest typed values + draft debounce bookkeeping. Refs, so the unmount
  // flush and the timer never read a stale closure.
  const valuesRef = useRef<SetInputStrings>(initialInputs);
  const draftPendingRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  const cancelDraft = useCallback(() => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    draftPendingRef.current = false;
  }, []);

  const flushDraft = useCallback(() => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    if (!draftPendingRef.current) return;
    draftPendingRef.current = false;
    const v = valuesRef.current;
    onDraftChangeRef.current?.(parseDraftPatch(v.weight, v.reps, v.rpe));
  }, []);

  // Persist whatever is still pending when the row goes away (collapse,
  // navigation) so the last <=300ms of typing is not lost.
  useEffect(() => flushDraft, [flushDraft]);

  // A completed row is read-only and the DB is its source of truth: follow the
  // logged values (e.g. when an earlier set is removed and rows shift).
  const { weight: initW, reps: initR, rpe: initE } = initialInputs;
  useEffect(() => {
    if (!completed) return;
    cancelDraft();
    valuesRef.current = { weight: initW, reps: initR, rpe: initE };
    setWeight(initW);
    setReps(initR);
    setRpe(initE);
  }, [completed, initW, initR, initE, cancelDraft]);

  const edit = (field: keyof SetInputStrings, text: string) => {
    valuesRef.current = { ...valuesRef.current, [field]: text };
    if (field === "weight") setWeight(text);
    else if (field === "reps") setReps(text);
    else setRpe(text);
    if (!onDraftChangeRef.current) return;
    draftPendingRef.current = true;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(flushDraft, DRAFT_DEBOUNCE_MS);
  };

  const isPlanned =
    !completed &&
    (plannedWeight != null || plannedReps != null);

  const setLabel = isWarmup ? "C" : String(index);
  // Spoken name of this row for screen readers ("set 2" / "set de calentamiento 1").
  const setName = isWarmup ? `set de calentamiento ${index}` : `set ${index}`;

  const handleComplete = () => {
    // A rejected completion keeps its pending draft (still unfinished input).
    const parsed = parseCompletion(weight, reps, rpe);
    if (!parsed) return;
    // logSet clears the slot's draft; a pending autosave would resurrect it.
    cancelDraft();
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const result = onComplete(parsed.weight, parsed.reps, parsed.rpe);
    if (result) {
      void result.then((saved) => {
        if (saved) return;
        // The save failed: the inputs are still unfinished, keep their draft.
        draftPendingRef.current = true;
        flushDraft();
      });
    }
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
        {isPr ? (
          // Tappable trophy: opens the PR explanation. Keeps the completed
          // badge look and replaces the set number with the icon.
          <TermHint term="PR">
            <Feather name="award" size={14} color={colors.accentInk} />
          </TermHint>
        ) : (
          <Text variant="label" weight="bold" color={badgeText}>
            {setLabel}
          </Text>
        )}
      </View>

      <View style={styles.previousContainer}>
        <Text variant="mono" color={colors.muted} style={{ fontSize: 11, textAlign: "center" }}>
          {previousWeight != null && previousReps != null
            ? `${previousWeight}×${previousReps}`
            : "—"}
        </Text>
      </View>

      <View style={[styles.inputsContainer, { gap: inputsGap }]}>
        <TextInput
          value={weight}
          accessibilityLabel={`Peso (kg) del ${setName}`}
          onChangeText={(t) => edit("weight", t)}
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
              fontSize: inputFontSize,
              paddingHorizontal: inputPaddingH,
            },
          ]}
        />
        <TextInput
          value={reps}
          accessibilityLabel={`Repeticiones del ${setName}`}
          onChangeText={(t) => edit("reps", t)}
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
              fontSize: inputFontSize,
              paddingHorizontal: inputPaddingH,
            },
          ]}
        />
        {!isWarmup ? (
          <TextInput
            value={rpe}
            accessibilityLabel={`RPE del ${setName}`}
            onChangeText={(t) => edit("rpe", t)}
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
                fontSize: inputFontSize,
                paddingHorizontal: inputPaddingH,
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
                paddingHorizontal: inputPaddingH,
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
          accessibilityRole="button"
          accessibilityLabel={`Nota del ${setName}`}
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
        accessibilityRole="button"
        accessibilityLabel={
          completed ? `Desmarcar ${setName}` : `Completar ${setName}`
        }
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

// RN-web renders <input> with an intrinsic width (~20ch) and `min-width: auto`,
// so `flex: 1` never shrinks below it and the row overflows. Web only.
const webShrink = Platform.OS === "web" ? { minWidth: 0, width: 0 } : {};

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
    ...webShrink,
  },
  input: {
    flex: 1,
    ...webShrink,
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
