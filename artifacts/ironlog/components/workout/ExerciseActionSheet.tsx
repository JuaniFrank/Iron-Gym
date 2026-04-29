import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface ExerciseActionSheetProps {
  visible: boolean;
  onClose: () => void;
  exerciseName: string;
  index: number;
  total: number;
  isSkipped: boolean;
  hasLoggedSets: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReplace: () => void;
  onToggleSkip: () => void;
  onRemove: () => void;
}

export function ExerciseActionSheet({
  visible,
  onClose,
  exerciseName,
  index,
  total,
  isSkipped,
  hasLoggedSets,
  onMoveUp,
  onMoveDown,
  onReplace,
  onToggleSkip,
  onRemove,
}: ExerciseActionSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const haptic = () => {
    if (Platform.OS === "web") return;
    Haptics.selectionAsync();
  };

  const wrap = (fn: () => void) => () => {
    haptic();
    onClose();
    // Defer the action a tick so the modal close animation can run before
    // any navigation/state change repaints the underlying screen.
    setTimeout(fn, 80);
  };

  const isFirst = index === 0;
  const isLast = index === total - 1;

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
        <Pressable onPress={() => undefined}>
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
            {/* Drag handle (visual only) */}
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
                EJERCICIO
              </Text>
              <Text variant="title" numberOfLines={1} style={{ marginTop: 4 }}>
                {exerciseName}
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <ActionRow
              icon="arrow-up"
              label="Mover arriba"
              disabled={isFirst}
              onPress={wrap(onMoveUp)}
            />
            <ActionRow
              icon="arrow-down"
              label="Mover abajo"
              disabled={isLast}
              onPress={wrap(onMoveDown)}
            />

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

            <ActionRow
              icon="repeat"
              label="Reemplazar ejercicio"
              hint="Cambiar por otro del mismo músculo"
              onPress={wrap(onReplace)}
            />
            <ActionRow
              icon={isSkipped ? "rotate-ccw" : "skip-forward"}
              label={isSkipped ? "Volver a hacer" : "Saltar este ejercicio"}
              hint={
                isSkipped
                  ? "Vuelve a contar para volumen y PRs"
                  : "Queda visible pero no suma a tu volumen"
              }
              onPress={wrap(onToggleSkip)}
            />

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

            <ActionRow
              icon="trash-2"
              label="Quitar de esta sesión"
              destructive
              hint={
                hasLoggedSets
                  ? "También borra los sets logueados acá"
                  : "No afecta a la rutina original"
              }
              onPress={wrap(onRemove)}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  destructive,
  disabled,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const tint = destructive ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingHorizontal: 22,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        opacity: disabled ? 0.35 : pressed ? 0.55 : 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: destructive ? "rgba(197,68,58,0.10)" : colors.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name={icon} size={15} color={tint} />
      </View>
      <Col flex={1} gap={2}>
        <Text variant="body" color={tint} weight="medium">
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" muted numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </Col>
    </Pressable>
  );
}
