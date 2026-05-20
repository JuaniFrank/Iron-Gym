import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Animated, AppState, Platform, Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";
import { formatTime } from "@/utils/date";

interface RestTimerProps {
  /** Timestamp absoluto cuando termina el rest. Cambia cuando arranca un
   *  nuevo descanso (parent setea con `Date.now() + restSeconds * 1000`). */
  endsAt: number;
  /** Duración original del descanso — usada para el arco visual (no para
   *  el countdown, que se computa de `endsAt - now`). */
  durationSeconds: number;
  onComplete?: () => void;
  onClose?: () => void;
  /** Llamado cuando user pausa, resume o ajusta ±15. `null` → cancelar push.
   *  number → nuevo endsAt para reschedule. */
  onReschedule?: (newEndsAt: number | null) => void;
  pinned: boolean;
  onTogglePin: () => void;
}

export function RestTimer({
  endsAt: propEndsAt,
  durationSeconds,
  onComplete,
  onClose,
  onReschedule,
  pinned,
  onTogglePin,
}: RestTimerProps) {
  const colors = useThemeColors();

  // Effective endsAt — arranca = propEndsAt, se desplaza por pause/resume/±15.
  // Si el parent cambia propEndsAt (nuevo descanso) → reset via useEffect.
  const [effectiveEndsAt, setEffectiveEndsAt] = useState(propEndsAt);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const completedRef = useRef(false);
  const propEndsAtRef = useRef(propEndsAt);

  // Callback refs — evitamos re-mountear el interval cada vez que el padre
  // re-renderea (el active screen tickea cada 1s para el elapsed). Mismo
  // patrón que la versión legacy.
  const onCompleteRef = useRef(onComplete);
  const onRescheduleRef = useRef(onReschedule);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    onRescheduleRef.current = onReschedule;
  }, [onReschedule]);

  // Reset cuando el prop endsAt cambia (parent inició un rest nuevo).
  useEffect(() => {
    if (propEndsAt !== propEndsAtRef.current) {
      propEndsAtRef.current = propEndsAt;
      setEffectiveEndsAt(propEndsAt);
      setPausedAt(null);
      setNow(Date.now());
      completedRef.current = false;
      // Reset animation state too.
      pulseScale.setValue(1);
    }
  }, [propEndsAt]);

  // Tick refresh — 250ms para que el display se vea fluido sin gastar CPU.
  // Si está paused, freezamos: el `pausedAt` snapshot tomado al pausar
  // congela el countdown.
  useEffect(() => {
    if (pausedAt != null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [pausedAt]);

  // AppState — al volver de background, snap `now` a Date.now() para que
  // el countdown muestre el tiempo real transcurrido. Sin esto, el
  // setInterval estuvo pausado en background y el display queda atrasado.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setNow(Date.now());
    });
    return () => sub.remove();
  }, []);

  // Pulse animation ref — disparada cuando remaining → 0 con la app en
  // foreground. Si la app está en background, el push notif del OS hace su
  // trabajo y este pulse no se ve igual. Sólo animamos `scale` con native
  // driver: agregar un segundo Animated.Value para borderColor en el mismo
  // Animated.View hace que RN promueva ambos al mismo driver implícitamente
  // y crashee — el bug que arreglamos en esta iteración.
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Effective "now" — congelado en pausedAt si paused.
  const effectiveNow = pausedAt ?? now;
  const remainingMs = Math.max(0, effectiveEndsAt - effectiveNow);
  const remaining = Math.ceil(remainingMs / 1000);

  // Fire onComplete una sola vez cuando llegamos a 0.
  useEffect(() => {
    if (remaining > 0) return;
    if (completedRef.current) return;
    completedRef.current = true;

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onCompleteRef.current?.();

    // Pulse animation solo si la app está en foreground. En background el OS
    // dispara el push notif y el user no ve la pantalla. Doble bump con
    // spring — se siente más natural que un timing linear y todo native
    // (no hay mezcla de drivers).
    if (AppState.currentState === "active") {
      Animated.sequence([
        Animated.spring(pulseScale, {
          toValue: 1.06,
          useNativeDriver: true,
          friction: 4,
          tension: 120,
        }),
        Animated.spring(pulseScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
          tension: 100,
        }),
        Animated.spring(pulseScale, {
          toValue: 1.06,
          useNativeDriver: true,
          friction: 4,
          tension: 120,
        }),
        Animated.spring(pulseScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
          tension: 100,
        }),
      ]).start();
    }
  }, [remaining, pulseScale]);

  const adjust = (delta: number) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    // No permitir bajar de "ya terminado" — el user puede dar +15 después
    // de que llegó a 0, pero -15 cuando quedan 5s lleva a 0 directo.
    const candidate = effectiveEndsAt + delta * 1000;
    const floor = (pausedAt ?? Date.now()); // pausados: floor en el snapshot
    const newEndsAt = Math.max(floor, candidate);
    setEffectiveEndsAt(newEndsAt);
    // Si todavía corre el countdown (no completedRef), reschedule. Si ya
    // completó, el ±15 igual visualmente extiende pero no re-dispara el
    // push (el user ya recibió el aviso).
    if (!completedRef.current) {
      completedRef.current = false; // re-armar si extendieron tras 0
      onRescheduleRef.current?.(newEndsAt);
    }
  };

  const togglePause = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (pausedAt != null) {
      // Resuming — desplazar el endsAt por el tiempo pausado.
      const delta = Date.now() - pausedAt;
      const newEndsAt = effectiveEndsAt + delta;
      setEffectiveEndsAt(newEndsAt);
      setPausedAt(null);
      onRescheduleRef.current?.(newEndsAt);
    } else {
      // Pausing — congelar y cancelar push.
      setPausedAt(Date.now());
      onRescheduleRef.current?.(null);
    }
  };

  const pct =
    durationSeconds > 0
      ? Math.max(0, Math.min(1, remainingMs / (durationSeconds * 1000)))
      : 0;
  const r = 64;
  const C = 2 * Math.PI * r;
  const handleX = 70 + r * Math.cos(-Math.PI / 2 + pct * 2 * Math.PI);
  const handleY = 70 + r * Math.sin(-Math.PI / 2 + pct * 2 * Math.PI);

  const paused = pausedAt != null;

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
