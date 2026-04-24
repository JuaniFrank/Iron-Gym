import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";

export default function FoodNewScreen() {
  const { createCustomFood } = useIronLog();
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [pro, setPro] = useState("");
  const [car, setCar] = useState("");
  const [fat, setFat] = useState("");

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert("Falta nombre", "Escribe el nombre del alimento.");
      return;
    }
    const calN = parseFloat(cal);
    if (isNaN(calN) || calN < 0) {
      Alert.alert("Calorías inválidas", "Introduce un valor numérico.");
      return;
    }
    createCustomFood({
      name: name.trim(),
      caloriesPer100g: calN,
      proteinPer100g: parseFloat(pro) || 0,
      carbsPer100g: parseFloat(car) || 0,
      fatPer100g: parseFloat(fat) || 0,
    });
    router.back();
  };

  return (
    <Screen noPadding>
      <Header title="Nuevo alimento" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text variant="caption" muted>
          Valores nutricionales por 100 gramos
        </Text>
        <Input label="Nombre" value={name} onChangeText={setName} autoFocus />
        <Input
          label="Calorías (kcal/100g)"
          value={cal}
          onChangeText={setCal}
          keyboardType="decimal-pad"
        />
        <Input label="Proteína (g)" value={pro} onChangeText={setPro} keyboardType="decimal-pad" />
        <Input label="Carbohidratos (g)" value={car} onChangeText={setCar} keyboardType="decimal-pad" />
        <Input label="Grasas (g)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
        <View style={{ marginTop: 16 }}>
          <Button label="Crear alimento" icon="check" fullWidth size="lg" onPress={handleCreate} />
        </View>
      </ScrollView>
    </Screen>
  );
}
