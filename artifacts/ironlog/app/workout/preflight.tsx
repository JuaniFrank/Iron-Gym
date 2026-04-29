import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ENERGY_OPTIONS,
  ENERGY_SEVERITY,
  ENERGY_TEXT,
  FACTOR_OPTIONS,
  FACTOR_TEXT,
  MultiSelectChips,
  PillGroup,
  SLEEP_OPTIONS,
  SLEEP_SEVERITY,
  SLEEP_TEXT,
} from "@/components/notes/FactorXChips";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";

/**
 * Pre-workout Factor X (cf. ROADMAP §4.14, notes-system.md D-18).
 *
 * Captura sueño + energía + factores contextuales antes de empezar la sesión.
 * Las notas se persisten transaccionalmente con `startWorkout()` — si el
 * usuario cancela, no se guarda nada.
 */
export default function PreflightScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ routineId?: string; dayId?: string }>();
  const { startWorkout, addNote } = useIronLog();

  const [sleep, setSleep] = useState<string | null>(null);
  const [energy, setEnergy] = useState<string | null>(null);
  const [factors, setFactors] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);

  const toggleFactor = (key: string) => {
    setFactors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleStart = () => {
    if (!params.routineId || !params.dayId || starting) return;
    setStarting(true);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Crear sesión primero — necesitamos su ID para asociar las notas (D-18).
    const session = startWorkout(params.routineId, params.dayId);

    if (sleep) {
      addNote({
        sessionId: session.id,
        category: "energy",
        severity: SLEEP_SEVERITY[sleep],
        text: SLEEP_TEXT[sleep],
        source: "preflight",
      });
    }
    if (energy) {
      addNote({
        sessionId: session.id,
        category: "energy",
        severity: ENERGY_SEVERITY[energy],
        text: ENERGY_TEXT[energy],
        source: "preflight",
      });
    }
    factors.forEach((factor) => {
      addNote({
        sessionId: session.id,
        category: "energy",
        text: FACTOR_TEXT[factor] ?? factor,
        source: "preflight",
      });
    });

    router.replace("/workout/active");
  };

  const handleSkip = () => {
    if (!params.routineId || !params.dayId) {
      router.back();
      return;
    }
    if (Platform.OS !== "web") Haptics.selectionAsync();
    startWorkout(params.routineId, params.dayId);
    router.replace("/workout/active");
  };

  return (
    <Screen scroll noPadding>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 8,
        }}
      >
        <Row jc="space-between" ai="center">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
          >
            <Feather name="chevron-left" size={22} color={colors.ink} />
          </Pressable>
          <Text variant="tiny" color={colors.muted}>
            ANTES DE EMPEZAR
          </Text>
          <Pressable
            onPress={handleSkip}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
          >
            <Text variant="label" color={colors.muted}>
              Saltar
            </Text>
          </Pressable>
        </Row>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 120 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingVertical: 16, paddingHorizontal: 4 }}>
          <Text variant="h2">Factor X</Text>
          <Text variant="caption" muted style={{ marginTop: 4 }}>
            10 segundos para registrar tu contexto. Después vas a ver qué factores
            hacen tus mejores sesiones.
          </Text>
        </View>

        <Card style={{ marginBottom: 14 }}>
          <PillGroup
            label="¿CÓMO DORMISTE ANOCHE?"
            options={SLEEP_OPTIONS}
            value={sleep}
            onChange={setSleep}
          />
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <PillGroup
            label="¿ENERGÍA HOY?"
            options={ENERGY_OPTIONS}
            value={energy}
            onChange={setEnergy}
          />
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <MultiSelectChips
            label="¿ALGO DISTINTO HOY? (OPCIONAL)"
            options={FACTOR_OPTIONS}
            selected={factors}
            onToggle={toggleFactor}
          />
        </Card>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: Math.max(insets.bottom, 16) + 6,
          left: 16,
          right: 16,
        }}
      >
        <Button
          label="Empezar entreno"
          icon="play"
          size="lg"
          fullWidth
          onPress={handleStart}
        />
      </View>
    </Screen>
  );
}
