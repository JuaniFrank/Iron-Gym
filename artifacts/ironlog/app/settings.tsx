import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { calorieGoalForGoal, calculateTDEE, macroSplitForGoal } from "@/utils/calculations";

export default function SettingsScreen() {
  const colors = useThemeColors();
  const {
    profile,
    updateProfile,
    defaultRestSeconds,
    setDefaultRest,
    resetAll,
    setDiscoveryStatus,
    resetAllDiscoveries,
    clearAllNotes,
    notes,
  } = useIronLog();

  const tdee = calculateTDEE(profile);
  const defaultCal = calorieGoalForGoal(tdee, profile.goal);
  const defaultMacros = macroSplitForGoal(defaultCal, profile.weightKg, profile.goal);

  const [calGoal, setCalGoal] = useState(String(profile.caloriesGoal ?? defaultCal));
  const [proGoal, setProGoal] = useState(String(profile.proteinGoalG ?? defaultMacros.protein));
  const [carGoal, setCarGoal] = useState(String(profile.carbsGoalG ?? defaultMacros.carbs));
  const [fatGoal, setFatGoal] = useState(String(profile.fatGoalG ?? defaultMacros.fat));
  const [rest, setRest] = useState(String(defaultRestSeconds));

  const saveNutrition = () => {
    updateProfile({
      caloriesGoal: parseInt(calGoal, 10) || defaultCal,
      proteinGoalG: parseInt(proGoal, 10) || defaultMacros.protein,
      carbsGoalG: parseInt(carGoal, 10) || defaultMacros.carbs,
      fatGoalG: parseInt(fatGoal, 10) || defaultMacros.fat,
    });
  };

  return (
    <Screen noPadding>
      <Header title="" back compact />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text variant="h1" style={{ marginBottom: 18, paddingHorizontal: 4 }}>
          Ajustes
        </Text>

        <Card style={{ marginBottom: 12 }}>
          <Text variant="tiny" color={colors.muted} style={{ marginBottom: 10 }}>
            APARIENCIA
          </Text>
          <SegmentedControl
            options={[
              { label: "Sistema", value: "system" as const },
              { label: "Claro", value: "light" as const },
              { label: "Oscuro", value: "dark" as const },
            ]}
            value={profile.theme}
            onChange={(v) => updateProfile({ theme: v })}
          />
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <Text variant="tiny" color={colors.muted} style={{ marginBottom: 10 }}>
            UNIDADES
          </Text>
          <SegmentedControl
            options={[
              { label: "Métrico (kg, cm)", value: "metric" as const },
              { label: "Imperial (lb, in)", value: "imperial" as const },
            ]}
            value={profile.units}
            onChange={(v) => updateProfile({ units: v })}
          />
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <Text variant="tiny" color={colors.muted} style={{ marginBottom: 6 }}>
            DESCANSO POR DEFECTO
          </Text>
          <Input
            fieldLabel=""
            value={rest}
            onChangeText={(v) => {
              setRest(v);
              const n = parseInt(v, 10);
              if (!isNaN(n) && n > 0) setDefaultRest(n);
            }}
            keyboardType="number-pad"
            suffix="seg"
          />
          <Text variant="caption" muted style={{ marginTop: 8 }}>
            Tiempo entre series cuando no se especifica.
          </Text>
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <Text variant="tiny" color={colors.muted} style={{ marginBottom: 4 }}>
            METAS NUTRICIONALES
          </Text>
          <Text variant="caption" muted style={{ marginBottom: 12 }}>
            Sugeridas: {defaultCal.toLocaleString()} kcal · {defaultMacros.protein}g P · {defaultMacros.carbs}g C · {defaultMacros.fat}g G
          </Text>
          <Col gap={8}>
            <Input
              fieldLabel="CALORÍAS"
              value={calGoal}
              onChangeText={setCalGoal}
              keyboardType="number-pad"
              suffix="kcal"
            />
            <Row gap={8}>
              <View style={{ flex: 1 }}>
                <Input
                  fieldLabel="PROT"
                  value={proGoal}
                  onChangeText={setProGoal}
                  keyboardType="number-pad"
                  suffix="g"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  fieldLabel="CARB"
                  value={carGoal}
                  onChangeText={setCarGoal}
                  keyboardType="number-pad"
                  suffix="g"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  fieldLabel="GRASA"
                  value={fatGoal}
                  onChangeText={setFatGoal}
                  keyboardType="number-pad"
                  suffix="g"
                />
              </View>
            </Row>
            <Button label="Guardar metas" icon="check" variant="dark" onPress={saveNutrition} />
          </Col>
        </Card>

        {/* NOTAS Y REFLEXIÓN */}
        <Card style={{ marginBottom: 12 }}>
          <Text variant="tiny" color={colors.muted} style={{ marginBottom: 12 }}>
            NOTAS Y REFLEXIÓN
          </Text>
          <Col gap={4}>
            <FeatureToggleRow
              label="Reflexión post-entreno"
              hint="3 preguntas rápidas al cerrar la sesión"
              activated={
                profile.featureDiscoveries?.find((d) => d.featureId === "recap")
                  ?.status === "activated"
              }
              onToggle={(on) =>
                setDiscoveryStatus("recap", on ? "activated" : "dismissed")
              }
            />
            <FeatureToggleRow
              label="Factor X pre-entreno"
              hint="Sueño, energía y contexto antes de empezar"
              activated={
                profile.featureDiscoveries?.find((d) => d.featureId === "preflight")
                  ?.status === "activated"
              }
              onToggle={(on) =>
                setDiscoveryStatus("preflight", on ? "activated" : "dismissed")
              }
            />
          </Col>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />

          <Pressable
            onPress={() =>
              Alert.alert(
                "Resetear descubrimientos",
                "Las features opt-in volverán a aparecer cuando se cumplan sus condiciones. No afecta a tus notas guardadas.",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Resetear",
                    onPress: () => resetAllDiscoveries(),
                  },
                ],
              )
            }
            style={({ pressed }) => ({
              paddingVertical: 10,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text variant="label" color={colors.accentEdge}>
              Resetear descubrimientos
            </Text>
            <Text variant="caption" muted>
              Volver a ofrecer features opt-in
            </Text>
          </Pressable>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />

          <Pressable
            onPress={() =>
              Alert.alert(
                "Borrar todas las notas",
                `Vas a eliminar ${notes.length} ${notes.length === 1 ? "nota" : "notas"}. No se puede deshacer.`,
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Borrar",
                    style: "destructive",
                    onPress: () => clearAllNotes(),
                  },
                ],
              )
            }
            style={({ pressed }) => ({
              paddingVertical: 10,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text variant="label" color={colors.danger}>
              Borrar todas las notas
            </Text>
            <Text variant="caption" muted>
              {notes.length} {notes.length === 1 ? "nota guardada" : "notas guardadas"}
            </Text>
          </Pressable>
        </Card>

        <Pressable
          onPress={() =>
            Alert.alert(
              "Borrar todos los datos",
              "Esto eliminará todas tus rutinas, sesiones, comidas y registros corporales. No se puede deshacer.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar todo",
                  style: "destructive",
                  onPress: async () => {
                    await resetAll();
                    router.replace("/");
                  },
                },
              ],
            )
          }
          style={({ pressed }) => ({
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Card style={{ borderColor: colors.danger, marginBottom: 14 }}>
            <Row gap={12}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: "rgba(197,68,58,0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="trash-2" size={16} color={colors.danger} />
              </View>
              <Col gap={2} flex={1}>
                <Text variant="title" color={colors.danger}>
                  Borrar todos los datos
                </Text>
                <Text variant="caption" muted>
                  Restablecer la app a estado inicial
                </Text>
              </Col>
              <Feather name="chevron-right" size={14} color={colors.muted} />
            </Row>
          </Card>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Toggle row para activar/desactivar features opt-in.

function FeatureToggleRow({
  label,
  hint,
  activated,
  onToggle,
}: {
  label: string;
  hint: string;
  activated: boolean;
  onToggle: (activated: boolean) => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => onToggle(!activated)}
      style={({ pressed }) => ({
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Col flex={1} gap={2}>
        <Text variant="label" weight="medium">
          {label}
        </Text>
        <Text variant="caption" muted>
          {hint}
        </Text>
      </Col>
      <View
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          backgroundColor: activated ? colors.accent : colors.surfaceAlt,
          borderWidth: 1,
          borderColor: activated ? colors.accentEdge : colors.border,
          padding: 2,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: activated ? colors.accentInk : colors.muted,
            alignSelf: activated ? "flex-end" : "flex-start",
          }}
        />
      </View>
    </Pressable>
  );
}
