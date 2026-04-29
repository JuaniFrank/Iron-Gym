import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, Platform, Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";

interface SeveritySliderProps {
  /** 1–10. */
  value: number | undefined;
  onChange: (n: number) => void;
  /** Labels para los 3 buckets. Default: ["leve", "molesta", "fuerte"]. */
  bucketLabels?: [string, string, string];
}

/**
 * Slider 1–10 con 3 buckets visuales (cf. D-3 + D-19). El usuario ve la
 * label del bucket actual; el número crudo se guarda.
 *
 * Implementación liviana sin lib externa — Pressable con coordenadas locales.
 */
export function SeveritySlider({
  value,
  onChange,
  bucketLabels = ["leve", "molesta", "fuerte"],
}: SeveritySliderProps) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);

  const v = Math.max(1, Math.min(10, Math.round(value ?? 5)));
  const percent = (v - 1) / 9; // 0..1

  const bucketIdx = v <= 3 ? 0 : v <= 6 ? 1 : 2;
  const bucketColor =
    bucketIdx === 0
      ? colors.accentEdge
      : bucketIdx === 1
        ? colors.warning
        : colors.danger;

  const handleTouch = (event: GestureResponderEvent) => {
    if (width === 0) return;
    const x = event.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / width));
    const next = Math.round(1 + ratio * 9);
    if (next !== v) {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      onChange(next);
    }
  };

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  return (
    <View>
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}
      >
        <Text variant="caption" color={colors.muted}>
          {bucketLabels[bucketIdx]}
        </Text>
        <Text variant="caption" color={colors.muted}>
          {v}/10
        </Text>
      </View>
      <Pressable
        onPress={handleTouch}
        onLayout={onLayout}
        onResponderMove={handleTouch}
        onMoveShouldSetResponder={() => true}
        onStartShouldSetResponder={() => true}
        style={{
          height: 36,
          justifyContent: "center",
        }}
      >
        {/* track */}
        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
        {/* fill */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 14,
            height: 8,
            width: `${percent * 100}%`,
            borderRadius: 4,
            backgroundColor: bucketColor,
          }}
        />
        {/* thumb */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: `${percent * 100}%`,
            top: 4,
            width: 28,
            height: 28,
            marginLeft: -14,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: bucketColor,
          }}
        />
      </Pressable>
    </View>
  );
}
