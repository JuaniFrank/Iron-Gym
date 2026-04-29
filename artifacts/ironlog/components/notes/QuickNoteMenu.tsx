import * as Haptics from "expo-haptics";
import React, { useMemo } from "react";
import { Modal, Platform, Pressable, View } from "react-native";

import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { frequentChips } from "@/utils/notes";

interface QuickNoteMenuProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  setId?: string;
  exerciseId: string;
  setIndex: number;
  onMoreOptions: () => void;
}

/**
 * Menú flotante que aparece sobre el botón check al hacer long-press (cf.
 * D-10). Muestra los top 4 chips frecuentes para "effort" + atajo a "más
 * opciones" que abre el NoteSheet completo.
 *
 * UX: modal pequeño centrado abajo (no posicionado sobre el botón porque
 * RN no da coordenadas globales del Pressable de origen sin medir refs).
 * Visualmente flota encima del flow.
 */
export function QuickNoteMenu({
  visible,
  onClose,
  sessionId,
  setId,
  exerciseId,
  setIndex,
  onMoreOptions,
}: QuickNoteMenuProps) {
  const colors = useThemeColors();
  const { addNote, notes, sessions } = useIronLog();

  const chips = useMemo(() => {
    return frequentChips(notes, sessions, "effort", { cap: 4 });
  }, [notes, sessions]);

  const handleChipTap = (chip: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    addNote({
      sessionId,
      setId,
      exerciseId,
      category: "effort",
      text: chip,
      source: "chip",
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
        }}
      >
        <View style={{ padding: 22, paddingBottom: 60 }}>
          <Pressable onPress={() => undefined}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Text variant="tiny" color={colors.muted} style={{ marginBottom: 8 }}>
                NOTA RÁPIDA · SET {setIndex}
              </Text>
              <Row gap={6} style={{ flexWrap: "wrap" }}>
                {chips.map((chip) => (
                  <Pressable
                    key={chip}
                    onPress={() => handleChipTap(chip)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text variant="label" color={colors.ink}>
                      {chip}
                    </Text>
                  </Pressable>
                ))}
              </Row>
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: 10,
                }}
              />
              <Pressable
                onPress={onMoreOptions}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  alignItems: "center",
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text variant="label" color={colors.accentEdge} weight="medium">
                  Más opciones…
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
