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
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { calorieGoalForGoal, calculateTDEE, macroSplitForGoal } from "@/utils/calculations";

export default function SettingsScreen() {
  const colors = useThemeColors();
  const { profile, updateProfile, defaultRestSeconds, setDefaultRest, resetAll } = useIronLog();

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
      <Header title="Ajustes" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <Text variant="title" style={{ marginBottom: 12 }}>
            Apariencia
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

        <Card>
          <Text variant="title" style={{ marginBottom: 12 }}>
            Unidades
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

        <Card>
          <Text variant="title" style={{ marginBottom: 12 }}>
            Descanso por defecto
          </Text>
          <Input
            value={rest}
            onChangeText={(v) => {
              setRest(v);
              const n = parseInt(v, 10);
              if (!isNaN(n) && n > 0) setDefaultRest(n);
            }}
            keyboardType="number-pad"
            rightAdornment={
              <Text variant="caption" muted>
                seg
              </Text>
            }
            hint="Tiempo de descanso entre series cuando creas un nuevo ejercicio"
          />
        </Card>

        <Card>
          <Text variant="title" style={{ marginBottom: 6 }}>
            Metas nutricionales
          </Text>
          <Text variant="caption" muted style={{ marginBottom: 12 }}>
            Sugerido: {defaultCal} kcal · {defaultMacros.protein}P / {defaultMacros.carbs}C / {defaultMacros.fat}G
          </Text>
          <View style={{ gap: 10 }}>
            <Input label="Calorías (kcal)" value={calGoal} onChangeText={setCalGoal} keyboardType="number-pad" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Input label="Prot (g)" value={proGoal} onChangeText={setProGoal} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Carb (g)" value={carGoal} onChangeText={setCarGoal} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Grasa (g)" value={fatGoal} onChangeText={setFatGoal} keyboardType="number-pad" />
              </View>
            </View>
            <Button label="Guardar metas" icon="check" onPress={saveNutrition} />
          </View>
        </Card>

        <Card>
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
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.destructive + "20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title" color={colors.destructive}>
                Borrar todos los datos
              </Text>
              <Text variant="caption" muted>
                Restablecer la app a estado inicial
              </Text>
            </View>
          </Pressable>
        </Card>
      </ScrollView>
    </Screen>
  );
}
