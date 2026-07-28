import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Col, Row } from "@/components/ui/Stack";
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

  // Parent often re-renders frequently (e.g. the active screen ticks elapsed
  // time each second). If `onComplete` were in the interval effect's deps,
  // every re-render would tear down and restart the interval before it could
  // fire — freezing the countdown. Keep the latest callback in a ref instead.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

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
            onCompleteRef.current?.();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  const adjust = (delta: number) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setRemaining((r) => Math.max(0, r + delta));
  };

  const pct = durationSeconds > 0 ? remaining / durationSeconds : 0;
  const r = 64;
  const C = 2 * Math.PI * r;
  const handleX = 70 + r * Math.cos(-Math.PI / 2 + pct * 2 * Math.PI);
  const handleY = 70 + r * Math.sin(-Math.PI / 2 + pct * 2 * Math.PI);

  return (
    <View
      style={{
        backgroundColor: colors.ink,
        borderRadius: 20,
        padding: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          right: -40,
          top: -40,
          width: 200,
          height: 200,
          borderRadius: 999,
          backgroundColor: colors.accent,
          opacity: 0.1,
        }}
      />

      <Row jc="space-between" style={{ marginBottom: 14 }}>
        <Row gap={8}>
          <Feather name="clock" size={14} color={colors.accent} />
          <Text variant="tiny" color={colors.accent}>
            DESCANSO
          </Text>
        </Row>
        <Pressable onPress={onClose} hitSlop={8}>
          <Feather name="x" size={16} color="rgba(242,240,232,0.5)" />
        </Pressable>
      </Row>

      <Row gap={20} ai="center">
        <View style={{ width: 140, height: 140 }}>
          <Svg width={140} height={140} viewBox="0 0 140 140">
            <Circle
              cx={70}
              cy={70}
              r={r}
              fill="none"
              stroke="rgba(242,240,232,0.1)"
              strokeWidth={4}
            />
            <Circle
              cx={70}
              cy={70}
              r={r}
              fill="none"
              stroke={colors.accent}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              transform="rotate(-90 70 70)"
            />
            <Circle cx={handleX} cy={handleY} r={7} fill={colors.accent} stroke={colors.ink} strokeWidth={3} />
          </Svg>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              variant="display"
              color={colors.bg}
              style={{ fontSize: 38, lineHeight: 38 }}
            >
              {formatTime(remaining)}
            </Text>
            <Text variant="tiny" color="rgba(242,240,232,0.5)">
              RESTANTE
            </Text>
          </View>
        </View>
        <Col gap={6} flex={1}>
          <Text variant="tiny" color="rgba(242,240,232,0.5)">
            {paused ? "EN PAUSA" : "EN MARCHA"}
          </Text>
          <Text variant="body" color={colors.bg}>
            Ajusta con −15 / +15.
          </Text>
          <Row gap={6} style={{ marginTop: 8 }}>
            <Pressable
              onPress={() => adjust(-15)}
              style={({ pressed }) => ({
                flex: 1,
                height: 36,
                borderRadius: 10,
                backgroundColor: "rgba(242,240,232,0.08)",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text variant="label" color={colors.bg}>
                −15
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setPaused((p) => !p);
              }}
              style={({ pressed }) => ({
                flex: 1.2,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.accent,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Feather name={paused ? "play" : "pause"} size={12} color={colors.accentInk} />
              <Text variant="label" weight="semibold" color={colors.accentInk}>
                {paused ? "Reanudar" : "Pausar"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => adjust(15)}
              style={({ pressed }) => ({
                flex: 1,
                height: 36,
                borderRadius: 10,
                backgroundColor: "rgba(242,240,232,0.08)",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text variant="label" color={colors.bg}>
                +15
              </Text>
            </Pressable>
          </Row>
        </Col>
      </Row>
    </View>
  );
}
