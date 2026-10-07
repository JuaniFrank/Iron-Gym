import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Animated, AppState, Platform, Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";
import {
  adjustEndsAt,
  effectiveNow,
  isFinished,
  progress,
  remainingMs,
  remainingSeconds,
  resumeEndsAt,
} from "@/domains/workout/restTimer";
import { formatTime } from "@/utils/date";

export interface RestTimerState {
  /** Absolute timestamp (ms) when the rest ends. */
  endsAt: number;
  /** Snapshot (ms) taken when the timer was paused, `null` while running. */
  pausedAt: number | null;
}

interface RestTimerProps {
  /** Absolute timestamp (ms) when the rest ends. The countdown is derived from
   *  it, so background time counts. */
  endsAt: number;
  /** Pause snapshot (ms), `null` while running. */
  pausedAt: number | null;
  /** Original duration, only used for the visual arc. */
  durationSeconds: number;
  /** Called when the user pauses, resumes or adjusts +-15. The parent owns the
   *  state (so pinning/unpinning, which remounts the timer, keeps it) and
   *  re-schedules its end-of-rest notification from it. */
  onChange: (next: RestTimerState) => void;
  /** Fires once when the countdown reaches 0 (again if extended afterwards). */
  onComplete?: () => void;
  onClose?: () => void;
  pinned: boolean;
  onTogglePin: () => void;
}

export function RestTimer({
  endsAt,
  pausedAt,
  durationSeconds,
  onChange,
  onComplete,
  onClose,
  pinned,
  onTogglePin,
}: RestTimerProps) {
  const colors = useThemeColors();
  const [now, setNow] = useState(() => Date.now());
  // A timer that mounts already finished (e.g. re-mounted by pinning) must not
  // celebrate a second time.
  const completedRef = useRef(isFinished(endsAt, effectiveNow(pausedAt, Date.now())));

  // Keep the latest callback in a ref: the parent re-renders every second and
  // must not tear down the effects below.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Only `scale` is animated, and with the native driver. Mixing a second
  // Animated.Value (e.g. borderColor) on the same view makes RN promote both
  // to one driver and crash.
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Tick (250ms keeps the display smooth); frozen while paused.
  useEffect(() => {
    if (pausedAt != null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [pausedAt]);

  // The interval does not run in background: resync on foreground so the
  // display shows the real elapsed time right away.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => sub.remove();
  }, []);

  const clock = effectiveNow(pausedAt, now);
  const remainingMillis = remainingMs(endsAt, clock);
  const remaining = remainingSeconds(endsAt, clock);

  // Fires once when reaching 0; re-arms as soon as time is left again (a new
  // rest, or +15 after finishing).
  useEffect(() => {
    if (remaining > 0) {
      completedRef.current = false;
      return;
    }
    if (completedRef.current) return;
    completedRef.current = true;

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onCompleteRef.current?.();

    // Pulse only in foreground; in background the OS notification does the job.
    if (AppState.currentState === "active") {
      const native = Platform.OS !== "web";
      const bump = (toValue: number, friction: number, tension: number) =>
        Animated.spring(pulseScale, {
          toValue,
          useNativeDriver: native,
          friction,
          tension,
        });
      pulseAnimRef.current?.stop();
      pulseAnimRef.current = Animated.sequence([
        bump(1.06, 4, 120),
        bump(1, 5, 100),
        bump(1.06, 4, 120),
        bump(1, 5, 100),
      ]);
      pulseAnimRef.current.start();
    }
  }, [remaining, pulseScale]);

  useEffect(
    () => () => {
      pulseAnimRef.current?.stop();
    },
    [],
  );

  const adjust = (deltaSec: number) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const next = adjustEndsAt({ endsAt, deltaSec, pausedAt, now: Date.now() });
    onChange({ endsAt: next, pausedAt });
  };

  const togglePause = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const at = Date.now();
    if (pausedAt != null) {
      onChange({ endsAt: resumeEndsAt(endsAt, pausedAt, at), pausedAt: null });
    } else {
      onChange({ endsAt, pausedAt: at });
    }
  };

  const pct = progress(remainingMillis, durationSeconds);
  const paused = pausedAt != null;
  const r = 64;
  const C = 2 * Math.PI * r;
  const handleX = 70 + r * Math.cos(-Math.PI / 2 + pct * 2 * Math.PI);
  const handleY = 70 + r * Math.sin(-Math.PI / 2 + pct * 2 * Math.PI);


  return (
    <Animated.View
      style={{
        backgroundColor: colors.ink,
        borderRadius: 20,
        padding: 18,
        position: "relative",
        overflow: "hidden",
        transform: [{ scale: pulseScale }],
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
        <Row gap={4}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              onTogglePin();
            }}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pinned
                ? "rgba(215,255,95,0.18)"
                : "transparent",
              opacity: pressed ? 0.6 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={pinned ? "Despinear timer" : "Pinear timer arriba"}
          >
            <MaterialCommunityIcons
              name={pinned ? "pin" : "pin-outline"}
              size={14}
              color={pinned ? colors.accent : "rgba(242,240,232,0.6)"}
            />
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
            <Feather name="x" size={16} color="rgba(242,240,232,0.5)" />
          </Pressable>
        </Row>
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
            <Circle
              cx={handleX}
              cy={handleY}
              r={7}
              fill={colors.accent}
              stroke={colors.ink}
              strokeWidth={3}
            />
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
              onPress={togglePause}
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
              <Feather
                name={paused ? "play" : "pause"}
                size={12}
                color={colors.accentInk}
              />
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
    </Animated.View>
  );
}
