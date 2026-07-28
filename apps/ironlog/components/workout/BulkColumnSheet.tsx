import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

export type BulkField = "weight" | "reps" | "rpe";

const INPUT_ACCESSORY_ID = "bulk-column-sheet-accessory";

interface BulkColumnSheetProps {
  visible: boolean;
  field: BulkField;
  /** Number of work sets to fill. */
  workSetCount: number;
  /** Anchor — value of the cell that triggered the sheet. */
  anchor: number | undefined;
  /** Receives one value per work set, in order. */
  onApply: (values: (number | undefined)[]) => void;
  onClose: () => void;
}

const FIELD_CONFIG: Record<
  BulkField,
  { title: string; unit: string; presetSteps: number[] }
> = {
  weight: { title: "Pesos", unit: "kg", presetSteps: [-2.5, -5, +2.5, +5] },
  reps: { title: "Reps", unit: "reps", presetSteps: [-1, -2, +1, +2] },
  rpe: { title: "RPE", unit: "rpe", presetSteps: [-0.5, +0.5] },
};

function defaultAnchor(field: BulkField): number {
  if (field === "weight") return 20;
  if (field === "reps") return 10;
  return 8;
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function clampForField(n: number, field: BulkField): number {
  if (n < 0) return 0;
  if (field === "reps") return Math.round(n);
  if (field === "rpe") return Math.min(10, Math.round(n * 2) / 2);
  return roundQuarter(n);
}

function formatNum(n: number | undefined, field: BulkField): string {
  if (n == null) return "—";
  if (field === "reps") return String(Math.round(n));
  return String(clampForField(n, field)).replace(".", ",");
}

function buildPattern(
  base: number,
  step: number,
  count: number,
  field: BulkField,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(clampForField(base + step * i, field));
  }
  return out;
}

export function BulkColumnSheet({
  visible,
  field,
  workSetCount,
  anchor,
  onApply,
  onClose,
}: BulkColumnSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const cfg = FIELD_CONFIG[field];

  // Local input value for "igualar todos a X". Re-seeds when the sheet opens.
  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (!visible) return;
    const seed = anchor ?? defaultAnchor(field);
    setText(formatNum(seed, field));
  }, [visible, anchor, field]);

  const parsedAnchor = useMemo(() => {
    const cleaned = text.replace(",", ".").trim();
    if (cleaned === "") return undefined;
    const v = field === "reps" ? parseInt(cleaned, 10) : parseFloat(cleaned);
    return Number.isFinite(v) ? v : undefined;
  }, [text, field]);

  const haptic = () => {
    if (Platform.OS === "web") return;
    Haptics.selectionAsync();
  };

  const apply = (values: (number | undefined)[]) => {
    haptic();
    onApply(values);
    onClose();
  };

  const presets = useMemo(() => {
    if (parsedAnchor == null || workSetCount <= 1) return [];
    return cfg.presetSteps.map((step) => ({
      step,
      values: buildPattern(parsedAnchor, step, workSetCount, field),
    }));
  }, [parsedAnchor, workSetCount, cfg.presetSteps, field]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable onPress={() => Keyboard.dismiss()}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 12) + 6,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ alignItems: "center", paddingVertical: 6 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.borderStrong,
                  opacity: 0.5,
                }}
              />
            </View>

            <View style={{ paddingHorizontal: 22, paddingTop: 4, paddingBottom: 12 }}>
              <Text variant="tiny" color={colors.muted}>
                AJUSTAR COLUMNA
              </Text>
              <Row gap={6} ai="baseline" style={{ marginTop: 4 }}>
                <Text variant="title">{cfg.title}</Text>
                <Text variant="caption" muted>
                  · {workSetCount} {workSetCount === 1 ? "set" : "sets"}
                </Text>
              </Row>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 8 }}>
              <Text variant="tiny" color={colors.muted} style={{ marginBottom: 8 }}>
                IGUALAR TODOS
              </Text>
              <Row gap={10} ai="center">
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    height: 44,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceAlt,
                    gap: 6,
                  }}
                >
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder={cfg.unit}
                    placeholderTextColor={colors.mutedSoft}
                    keyboardType={field === "reps" ? "number-pad" : "decimal-pad"}
                    autoFocus={anchor == null}
                    selectTextOnFocus
                    inputAccessoryViewID={
                      Platform.OS === "ios" ? INPUT_ACCESSORY_ID : undefined
                    }
                    style={{
                      flex: 1,
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.ink,
                      fontFamily: Platform.select({
                        ios: "Menlo",
                        android: "monospace",
                        default: "monospace",
                      }),
                    }}
                  />
                  <Text variant="caption" muted>
                    {cfg.unit}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    if (parsedAnchor == null) return;
                    apply(Array(workSetCount).fill(clampForField(parsedAnchor, field)));
                  }}
                  disabled={parsedAnchor == null}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: colors.ink,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: parsedAnchor == null ? 0.35 : pressed ? 0.85 : 1,
                  })}
                >
                  <Text variant="label" weight="semibold" color={colors.bg}>
                    Aplicar
                  </Text>
                </Pressable>
              </Row>
            </View>

            <View style={{ paddingHorizontal: 22, paddingTop: 14 }}>
              <Text variant="tiny" color={colors.muted} style={{ marginBottom: 8 }}>
                EN CASCADA
              </Text>
              {presets.length === 0 ? (
                <Text variant="caption" muted>
                  {workSetCount <= 1
                    ? "Agregá más sets para ver patrones."
                    : "Ingresá un valor base para ver patrones."}
                </Text>
              ) : (
                <Col gap={8}>
                  {presets.map((p) => (
                    <PresetRow
                      key={p.step}
                      step={p.step}
                      unit={cfg.unit}
                      preview={p.values.map((v) => formatNum(v, field)).join(" · ")}
                      onPress={() => apply(p.values)}
                    />
                  ))}
                </Col>
              )}
            </View>

            <View style={{ paddingHorizontal: 22, paddingTop: 16 }}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => ({
                  height: 44,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text variant="label" color={colors.muted}>
                  Cancelar
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: "transparent",
            }}
          >
            <Pressable
              onPress={() => Keyboard.dismiss()}
              hitSlop={8}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.ink,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                opacity: pressed ? 0.85 : 1,
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
              })}
            >
              <MaterialCommunityIcons
                name="keyboard-close"
                size={18}
                color={colors.bg}
              />
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </Modal>
  );
}

function PresetRow({
  step,
  unit,
  preview,
  onPress,
}: {
  step: number;
  unit: string;
  preview: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const sign = step >= 0 ? "+" : "−";
  const arrow = step >= 0 ? "↑" : "↓";
  const abs = Math.abs(step).toString().replace(".", ",");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceAlt : "transparent",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text variant="label" weight="bold" color={colors.accentEdge}>
          {arrow}
        </Text>
      </View>
      <Col flex={1} gap={2}>
        <Text variant="body" weight="medium">
          {sign}
          {abs} {unit} por set
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {preview}
        </Text>
      </Col>
    </Pressable>
  );
}
