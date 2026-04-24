import { router } from "expo-router";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
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
      <Header title="Perfil" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <Text variant="title" style={{ marginBottom: 12 }}>
            Datos personales
          </Text>
          <View style={{ gap: 10 }}>
            <Input label="Nombre" value={draft.name} onChangeText={(v) => set("name", v)} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Edad"
                  value={String(draft.age)}
                  onChangeText={(v) => set("age", parseInt(v, 10) || 0)}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Altura (cm)"
                  value={String(draft.heightCm)}
                  onChangeText={(v) => set("heightCm", parseFloat(v) || 0)}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Peso (kg)"
                  value={String(draft.weightKg)}
                  onChangeText={(v) => set("weightKg", parseFloat(v) || 0)}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View>
              <Text variant="label" muted style={{ marginBottom: 6 }}>
                Sexo
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
          </View>
        </Card>

        <Card>
          <Text variant="title" style={{ marginBottom: 12 }}>
            Actividad
          </Text>
          <View style={{ gap: 8 }}>
            {(
              [
                { v: "sedentary", l: "Sedentario", d: "Poco o nada de ejercicio" },
                { v: "light", l: "Ligero", d: "Ejercicio 1-3 días/semana" },
                { v: "moderate", l: "Moderado", d: "Ejercicio 3-5 días/semana" },
                { v: "active", l: "Activo", d: "Ejercicio 6-7 días/semana" },
                { v: "veryActive", l: "Muy activo", d: "Ejercicio intenso diario" },
              ] as const
            ).map((opt) => {
              const active = draft.activityLevel === opt.v;
              return (
                <View
                  key={opt.v}
                  onTouchEnd={() => set("activityLevel", opt.v)}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: active ? colors.accent : colors.secondary,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : "transparent",
                  }}
                >
                  <Text variant="label" weight="semibold" color={active ? colors.primary : colors.foreground}>
                    {opt.l}
                  </Text>
                  <Text variant="caption" muted>
                    {opt.d}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        <Card>
          <Text variant="title" style={{ marginBottom: 12 }}>
            Objetivo
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

        <Card style={{ backgroundColor: colors.accent, borderColor: colors.primary }}>
          <Text variant="tiny" color={colors.primary} weight="bold">
            CALCULADO
          </Text>
          <View style={{ flexDirection: "row", marginTop: 8, gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.accentForeground}>BMR (descanso)</Text>
              <Text variant="h3" color={colors.primary}>
                {Math.round(bmr)} kcal
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.accentForeground}>TDEE (gasto diario)</Text>
              <Text variant="h3" color={colors.primary}>
                {tdee} kcal
              </Text>
            </View>
          </View>
        </Card>

        <Button
          label="Guardar cambios"
          icon="check"
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
