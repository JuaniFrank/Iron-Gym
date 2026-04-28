import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { UserProfile } from "@/types";
import { calculateBMR, calculateTDEE } from "@/utils/calculations";

export default function ProfileScreen() {
  const colors = useThemeColors();
  const { profile, updateProfile } = useIronLog();
  const [draft, setDraft] = useState<UserProfile>(profile);

  const tdee = calculateTDEE(draft);
  const bmr = calculateBMR(draft);

  const set = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Screen noPadding>
      <Header title="" back compact />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text variant="h1" style={{ marginBottom: 18, paddingHorizontal: 4 }}>
          Perfil
        </Text>

        <Card style={{ marginBottom: 12 }}>
          <Text variant="tiny" color={colors.muted} style={{ marginBottom: 14 }}>
            DATOS PERSONALES
          </Text>
          <Col gap={10}>
            <Input fieldLabel="NOMBRE" value={draft.name} onChangeText={(v) => set("name", v)} />
            <Row gap={8}>
              <View style={{ flex: 1 }}>
                <Input
                  fieldLabel="EDAD"
                  value={String(draft.age)}
                  onChangeText={(v) => set("age", parseInt(v, 10) || 0)}
                  keyboardType="number-pad"
                  suffix="años"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  fieldLabel="ALTURA"
                  value={String(draft.heightCm)}
                  onChangeText={(v) => set("heightCm", parseFloat(v) || 0)}
                  keyboardType="decimal-pad"
                  suffix="cm"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  fieldLabel="PESO"
                  value={String(draft.weightKg)}
                  onChangeText={(v) => set("weightKg", parseFloat(v) || 0)}
                  keyboardType="decimal-pad"
                  suffix="kg"
                />
              </View>
            </Row>
            <View>
              <Text variant="tiny" color={colors.muted} style={{ marginBottom: 6 }}>
                SEXO
              </Text>
              <SegmentedControl
                options={[
                  { label: "Hombre", value: "male" as const },
                  { label: "Mujer", value: "female" as const },
                ]}
                value={draft.sex}
                onChange={(v) => set("sex", v)}
              />
            </View>
          </Col>
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <Text variant="tiny" color={colors.muted} style={{ marginBottom: 14 }}>
            NIVEL DE ACTIVIDAD
          </Text>
          <Col gap={6}>
            {(
              [
                { v: "sedentary", l: "Sedentario", d: "Poco o nada" },
                { v: "light", l: "Ligero", d: "1-3 días / semana" },
                { v: "moderate", l: "Moderado", d: "3-5 días / semana" },
                { v: "active", l: "Activo", d: "6-7 días / semana" },
                { v: "veryActive", l: "Muy activo", d: "Trabajo físico + entreno" },
              ] as const
            ).map((opt) => {
              const active = draft.activityLevel === opt.v;
              return (
                <Pressable
                  key={opt.v}
                  onPress={() => set("activityLevel", opt.v)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: active ? colors.accentSoft : colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: active ? colors.accentEdge : "transparent",
                  }}
                >
                  <Row jc="space-between">
                    <Col gap={2}>
                      <Text
                        variant="label"
                        weight="semibold"
                        color={active ? colors.accentEdge : colors.ink}
                      >
                        {opt.l}
                      </Text>
                      <Text variant="caption" muted>
                        {opt.d}
                      </Text>
                    </Col>
                    {active ? <Feather name="check" size={14} color={colors.accentEdge} /> : null}
                  </Row>
                </Pressable>
              );
            })}
          </Col>
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <Text variant="tiny" color={colors.muted} style={{ marginBottom: 10 }}>
            OBJETIVO
          </Text>
          <SegmentedControl
            options={[
              { label: "Bajar", value: "lose" as const },
              { label: "Mantener", value: "maintain" as const },
              { label: "Músculo", value: "muscle" as const },
              { label: "Subir", value: "gain" as const },
            ]}
            value={draft.goal}
            onChange={(v) => set("goal", v)}
          />
        </Card>

        <Card variant="accent" style={{ marginBottom: 18 }}>
          <Text variant="tiny" color={colors.accentEdge} style={{ marginBottom: 12 }}>
            CALCULADO AUTOMÁTICAMENTE
          </Text>
          <Row gap={20}>
            <Col gap={4} flex={1}>
              <Text variant="tiny" color={colors.muted}>
                BMR
              </Text>
              <Text variant="h2" color={colors.accentEdge}>
                {Math.round(bmr).toLocaleString()}
              </Text>
              <Text variant="caption" muted>
                kcal en descanso
              </Text>
            </Col>
            <Divider vertical />
            <Col gap={4} flex={1}>
              <Text variant="tiny" color={colors.muted}>
                TDEE
              </Text>
              <Text variant="h2" color={colors.accentEdge}>
                {tdee.toLocaleString()}
              </Text>
              <Text variant="caption" muted>
                kcal gasto diario
              </Text>
            </Col>
          </Row>
        </Card>

        <Button
          label="Guardar cambios"
          variant="dark"
          fullWidth
          size="lg"
          onPress={() => {
            updateProfile(draft);
            router.back();
          }}
        />
      </ScrollView>
    </Screen>
  );
}
