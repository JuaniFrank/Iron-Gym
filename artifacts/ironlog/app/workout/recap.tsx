import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BodyMapMini } from "@/components/notes/BodyMapMini";
import { MoodSelector } from "@/components/notes/MoodSelector";
import { SeveritySlider } from "@/components/notes/SeveritySlider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { BODY_PART_SHORT_LABEL } from "@/constants/bodyParts";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { BodyPart } from "@/types";
import { canStillRecap } from "@/utils/notes";

const ACCESSORY_ID = "recap-accessory";

export default function RecapScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const { sessions, notes, addNote } = useIronLog();

  const session = sessions.find((s) => s.id === params.sessionId);
  const isReopened = session?.endedAt != null && session.endedAt < Date.now() - 30_000;

  const [mood, setMood] = useState<number | undefined>(undefined);
  const [selectedParts, setSelectedParts] = useState<Set<BodyPart>>(new Set());
  const [severityByPart, setSeverityByPart] = useState<Record<string, number>>({});
  const [textByPart, setTextByPart] = useState<Record<string, string>>({});
  const [generalText, setGeneralText] = useState<string>("");
  const [saving, setSaving] = useState(false);

  if (!session) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle"
          title="Sesión no encontrada"
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  // Validación D-16: si la sesión ya tenía recap o pasaron 24h, mostrar info.
  const stillEditable = canStillRecap(session, notes);
  if (!stillEditable && session.endedAt != null) {
    const alreadyHasRecap = notes.some(
      (n) => n.sessionId === session.id && n.source === "recap",
    );
    if (alreadyHasRecap) {
      return (
        <Screen>
          <EmptyState
            icon="check-circle"
            title="Reflexión ya registrada"
            description="Esta sesión ya tiene su recap. Solo se puede agregar una vez."
            actionLabel="Volver"
            onAction={() => router.back()}
          />
        </Screen>
      );
    }
    return (
      <Screen>
        <EmptyState
          icon="clock"
          title="Ventana cerrada"
          description="Pasaron más de 24 horas desde el final de la sesión. La reflexión solo se puede agregar dentro de ese tiempo."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const togglePart = (part: BodyPart) => {
    setSelectedParts((prev) => {
      const next = new Set(prev);
      if (next.has(part)) {
        next.delete(part);
        // Limpio severity y text de esa zona
        setSeverityByPart((s) => {
          const copy = { ...s };
          delete copy[part];
          return copy;
        });
        setTextByPart((t) => {
          const copy = { ...t };
          delete copy[part];
          return copy;
        });
      } else {
        next.add(part);
        // Default severity 4 (molesta leve)
        setSeverityByPart((s) => ({ ...s, [part]: s[part] ?? 4 }));
      }
      return next;
    });
  };

  const handleSave = () => {
    if (saving) return;
    setSaving(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Mood note
    if (mood != null) {
      addNote({
        sessionId: session.id,
        category: "mood",
        severity: mood,
        text: "",
        source: "recap",
      });
    }

    // Pain notes por zona seleccionada
    selectedParts.forEach((part) => {
      addNote({
        sessionId: session.id,
        category: "pain",
        bodyPart: part,
        severity: severityByPart[part] ?? 4,
        text: textByPart[part] ?? "",
        source: "recap",
      });
    });

    // Free text general
    if (generalText.trim()) {
      addNote({
        sessionId: session.id,
        category: "other",
        text: generalText.trim(),
        source: "recap",
      });
    }

    router.replace("/");
  };

  const handleSkip = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    router.replace("/");
  };

  return (
    <Screen scroll noPadding>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Row jc="space-between" ai="center">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
          >
            <Feather name="chevron-left" size={22} color={colors.ink} />
          </Pressable>
          <Text variant="tiny" color={colors.muted}>
            REFLEXIÓN
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
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={{ paddingVertical: 16, paddingHorizontal: 4 }}>
          <Text variant="h2">
            {isReopened ? "Reflexioná sobre tu sesión" : "¿Cómo te fue hoy?"}
          </Text>
          <Text variant="caption" muted style={{ marginTop: 4 }}>
            30 segundos para registrar lo que sentiste. Te ayuda a ver patrones.
          </Text>
        </View>

        {/* Mood */}
        <Card style={{ marginBottom: 14 }}>
          <Text variant="caption" color={colors.muted} style={{ marginBottom: 10 }}>
            ¿CÓMO TE SENTISTE?
          </Text>
          <MoodSelector value={mood} onChange={setMood} />
        </Card>

        {/* Body map */}
        <Card style={{ marginBottom: 14 }}>
          <Text variant="caption" color={colors.muted} style={{ marginBottom: 10 }}>
            ¿ALGUNA MOLESTIA?
          </Text>
          <BodyMapMini
            selected={selectedParts}
            onTogglePart={togglePart}
            height={260}
          />

          {selectedParts.size > 0 ? (
            <Col gap={14} style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
              {Array.from(selectedParts).map((part) => (
                <View key={part} style={{ gap: 8 }}>
                  <Text variant="label" weight="semibold">
                    {BODY_PART_SHORT_LABEL[part]}
                  </Text>
                  <SeveritySlider
                    value={severityByPart[part]}
                    onChange={(v) =>
                      setSeverityByPart((s) => ({ ...s, [part]: v }))
                    }
                    bucketLabels={["leve", "molesta", "fuerte"]}
                  />
                  <TextInput
                    value={textByPart[part] ?? ""}
                    onChangeText={(t) =>
                      setTextByPart((p) => ({ ...p, [part]: t }))
                    }
                    placeholder="Qué sentiste? (opcional)"
                    placeholderTextColor={colors.mutedSoft}
                    inputAccessoryViewID={Platform.OS === "ios" ? ACCESSORY_ID : undefined}
                    style={{
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceAlt,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      fontSize: 13,
                      color: colors.ink,
                    }}
                  />
                </View>
              ))}
            </Col>
          ) : null}
        </Card>

        {/* Free text */}
        <Card style={{ marginBottom: 14 }}>
          <Text variant="caption" color={colors.muted} style={{ marginBottom: 10 }}>
            ALGO PARA RECORDAR
          </Text>
          <TextInput
            value={generalText}
            onChangeText={setGeneralText}
            placeholder="Algo que quieras anotar para vos..."
            placeholderTextColor={colors.mutedSoft}
            multiline
            inputAccessoryViewID={Platform.OS === "ios" ? ACCESSORY_ID : undefined}
            style={{
              minHeight: 70,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceAlt,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: colors.ink,
              textAlignVertical: "top",
            }}
          />
        </Card>
      </ScrollView>

      {/* CTA */}
      <View
        style={{
          position: "absolute",
          bottom: Math.max(insets.bottom, 16) + 6,
          left: 16,
          right: 16,
        }}
      >
        <Button
          label="Listo"
          icon="check"
          size="lg"
          fullWidth
          onPress={handleSave}
        />
      </View>

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={ACCESSORY_ID}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              paddingHorizontal: 12,
              paddingVertical: 6,
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
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <MaterialCommunityIcons name="keyboard-close" size={18} color={colors.bg} />
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </Screen>
  );
}
