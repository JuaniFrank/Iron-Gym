import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";
import { formatTime } from "@/utils/date";

interface RestTimerProps {
  durationSeconds: number;
  onComplete?: () => void;
  onClose?: () => void;
}

export function RestTimer({ durationSeconds, onComplete, onClose }: RestTimerProps) {
  const colors = useThemeColors();
  const [remaining, setRemaining] = useState(durationSeconds);
  const [paused, setPaused] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    setRemaining(durationSeconds);
  }, [durationSeconds]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (!completedRef.current) {
            completedRef.current = true;
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            onComplete?.();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, onComplete]);

  const adjust = (delta: number) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setRemaining((r) => Math.max(0, r + delta));
  };

  const pct = durationSeconds > 0 ? remaining / durationSeconds : 0;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: colors.radius,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="clock" size={14} color={colors.primary} />
          </View>
          <Text variant="label" muted>
            Descanso
          </Text>
        </View>

        <Pressable onPress={onClose} hitSlop={8}>
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <Text variant="display" style={{ textAlign: "center", marginVertical: 8, fontVariant: ["tabular-nums"] }}>
        {formatTime(remaining)}
      </Text>

      <View
        style={{
          height: 6,
          backgroundColor: colors.secondary,
          borderRadius: 3,
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <View
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            backgroundColor: colors.primary,
            borderRadius: 3,
          }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => adjust(-15)}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: colors.secondary,
            paddingVertical: 12,
            borderRadius: colors.radius,
            alignItems: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text variant="label" weight="semibold">
            −15s
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            setPaused((p) => !p);
          }}
          style={({ pressed }) => ({
            flex: 1.4,
            backgroundColor: colors.primary,
            paddingVertical: 12,
            borderRadius: colors.radius,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Feather name={paused ? "play" : "pause"} size={16} color={colors.primaryForeground} />
          <Text variant="label" weight="semibold" color={colors.primaryForeground}>
            {paused ? "Reanudar" : "Pausar"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => adjust(15)}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: colors.secondary,
            paddingVertical: 12,
            borderRadius: colors.radius,
            alignItems: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text variant="label" weight="semibold">
            +15s
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
