import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { getFeatureDef } from "@/constants/featureCatalog";
import { useThemeColors } from "@/contexts/ThemeContext";

interface FeatureDiscoveryPromptProps {
  visible: boolean;
  featureId: string;
  onActivate: () => void;
  onLater: () => void;
  onDismiss: () => void;
}

/**
 * Prompt de descubrimiento progresivo de features (cf. D-11).
 *
 * V1: bottom sheet simple con título + descripción + 2 CTAs ("Más tarde",
 * "Activar") + link "No mostrar más".
 *
 * V2 (cf. future-onboardings.md): se reemplaza por onboarding visual con
 * animaciones. La firma queda igual — el call-site no cambia.
 */
export function FeatureDiscoveryPrompt({
  visible,
  featureId,
  onActivate,
  onLater,
  onDismiss,
}: FeatureDiscoveryPromptProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const def = getFeatureDef(featureId);

  if (!def) return null;

  const haptic = () => {
    if (Platform.OS === "web") return;
    Haptics.selectionAsync();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onLater}
      statusBarTranslucent
    >
      <Pressable
        onPress={onLater}
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
            {/* Drag handle */}
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

            <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 }}>
              <Row gap={8} ai="center">
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colors.accentSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather name="zap" size={18} color={colors.accentEdge} />
                </View>
                <Text variant="tiny" color={colors.muted}>
                  DESCUBRÍ
                </Text>
              </Row>
              <Text variant="title" style={{ marginTop: 12 }}>
                {def.title}
              </Text>
              <Text variant="caption" color={colors.muted} style={{ marginTop: 4 }}>
                {def.tagline}
              </Text>
            </View>

            <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 14 }}>
              <Text variant="body" color={colors.ink}>
                {def.description}
              </Text>
            </View>

            {/* CTAs */}
            <Row gap={10} style={{ paddingHorizontal: 22, paddingTop: 8 }}>
              <Pressable
                onPress={() => {
                  haptic();
                  onLater();
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text variant="label" weight="medium" color={colors.muted}>
                  Más tarde
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                  onActivate();
                }}
                style={({ pressed }) => ({
                  flex: 1.4,
                  height: 48,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.ink,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text variant="label" weight="semibold" color={colors.bg}>
                  Activar
                </Text>
              </Pressable>
            </Row>

            {/* No mostrar más */}
            <Pressable
              onPress={() => {
                haptic();
                onDismiss();
              }}
              style={({ pressed }) => ({
                paddingVertical: 14,
                alignItems: "center",
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Text variant="caption" color={colors.muted}>
                No mostrar más
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
