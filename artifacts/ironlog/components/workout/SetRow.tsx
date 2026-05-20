import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
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

interface SetRowProps {
  index: number;
  isWarmup?: boolean;
  initialWeight?: number;
  initialReps?: number;
  initialRpe?: number;
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
  /** Autosave debounced de inputs no-completados. Si se omite, el SetRow no
   *  persiste drafts (modo legacy). Sólo se llama después de que el user
   *  efectivamente tipea (no en mount), para no contaminar la tabla de
   *  drafts con valores que vinieron del plan/previous. */
  onDraftChange?: (patch: {
    weight: number | null;
    reps: number | null;
    rpe: number | null;
  }) => void;
}

export function SetRow({
  index,
  isWarmup,
  initialWeight,
  initialReps,
  initialRpe,
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
  onDraftChange,
}: SetRowProps) {
  const colors = useThemeColors();
  // Pantallas chicas (iPhone 13 Pro = 390pt y abajo): los inputs mono no
  // entran un "42.5" en una sola línea una vez que aparece el lápiz al
  // completarse. Solo en esos devices encogemos padding y font; los Pro Max
  // (430pt) y tablets no necesitan el shrink.
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 400;
  const inputFontSize = compact ? 13 : 14;
  const inputPaddingH = compact ? 4 : 6;
  const inputsGap = compact ? 4 : 6;
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
    initialRpe != null
      ? String(initialRpe)
      : plannedRpe != null && !completed
        ? String(plannedRpe)
        : "",
  );

  // El SessionPlan se carga vía useLiveQuery; los `plannedX` llegan después
  // del primer render. El useState lazy initializer solo corre una vez, así
  // que sin esto la fila quedaría vacía pese a tener un plan. Solo rellenamos
  // campos vacíos (no pisamos lo que el usuario haya tocado) y solo mientras
  // el set no esté completado.
  useEffect(() => {
    if (completed || plannedWeight == null) return;
    setWeight((prev) => (prev === "" ? String(plannedWeight) : prev));
  }, [plannedWeight, completed]);
  useEffect(() => {
    if (completed || plannedReps == null) return;
    setReps((prev) => (prev === "" ? String(plannedReps) : prev));
  }, [plannedReps, completed]);
  useEffect(() => {
    if (completed || plannedRpe == null) return;
    setRpe((prev) => (prev === "" ? String(plannedRpe) : prev));
  }, [plannedRpe, completed]);

  // initial* puede llegar tarde porque useLiveQuery retorna `undefined` en el
  // primer render y luego se hidrata. Necesitamos sincronizar el state local
  // cuando aparece. Para sets completed → sync siempre (DB es la verdad,
  // input es read-only). Para sets no-completed → solo fill cuando state está
  // vacío, para no pisar lo que el user está typeando.
  useEffect(() => {
    if (initialWeight == null) return;
    if (completed) {
      setWeight(String(initialWeight));
    } else {
      setWeight((prev) => (prev === "" ? String(initialWeight) : prev));
    }
  }, [initialWeight, completed]);
  useEffect(() => {
    if (initialReps == null) return;
    if (completed) {
      setReps(String(initialReps));
    } else {
      setReps((prev) => (prev === "" ? String(initialReps) : prev));
    }
  }, [initialReps, completed]);
  useEffect(() => {
    if (initialRpe == null) return;
    if (completed) {
      setRpe(String(initialRpe));
    } else {
      setRpe((prev) => (prev === "" ? String(initialRpe) : prev));
    }
  }, [initialRpe, completed]);

  // Autosave de drafts: solo cuando el user efectivamente tipeó (no cuando
  // el state se hidrata desde initial/planned/previous). El ref se flipea a
  // true en el primer onChangeText del user; recién ahí el effect debounced
  // dispara saves.
  const userTouchedRef = useRef(false);
  const draftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!onDraftChange) return;
    if (completed) return;
    if (!userTouchedRef.current) return;
    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
    draftTimeoutRef.current = setTimeout(() => {
      const w = weight === "" ? null : parseFloat(weight);
      const r = reps === "" ? null : parseInt(reps, 10);
      const rp = rpe === "" ? null : parseFloat(rpe);
      onDraftChange({
        weight: Number.isFinite(w as number) ? (w as number) : null,
        reps: Number.isFinite(r as number) ? (r as number) : null,
        rpe: Number.isFinite(rp as number) ? (rp as number) : null,
      });
    }, 300);
    return () => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
    };
  }, [weight, reps, rpe, completed, onDraftChange]);

  const touchAndSetWeight = (text: string) => {
    userTouchedRef.current = true;
    setWeight(text);
  };
  const touchAndSetReps = (text: string) => {
    userTouchedRef.current = true;
    setReps(text);
  };
  const touchAndSetRpe = (text: string) => {
    userTouchedRef.current = true;
    setRpe(text);
  };

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
        {isPr ? (
          // Trofeo tappable — abre el TermHint modal explicando qué es un PR.
          // Mantiene el visual de "set completado" (badge verde) y reemplaza
          // el número por el ícono trofeo; el contexto de cuál set es se
          // sigue infiriendo del orden de filas dentro del card.
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
          onChangeText={touchAndSetWeight}
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
          onChangeText={touchAndSetReps}
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
            onChangeText={touchAndSetRpe}
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
