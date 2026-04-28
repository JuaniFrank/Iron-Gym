import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";

export default function FoodNewScreen() {
  const colors = useThemeColors();
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
      <Header title="" back compact />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text variant="h1" style={{ marginBottom: 6, paddingHorizontal: 4 }}>
          Nuevo alimento
        </Text>
        <Text variant="tiny" color={colors.muted} style={{ marginBottom: 16, paddingHorizontal: 4 }}>
          VALORES POR 100 GRAMOS
        </Text>
        <Col gap={10}>
          <Input fieldLabel="NOMBRE" value={name} onChangeText={setName} autoFocus />
          <Input
            fieldLabel="CALORÍAS"
            value={cal}
            onChangeText={setCal}
            keyboardType="decimal-pad"
            suffix="kcal"
          />
          <Row gap={8}>
            <View style={{ flex: 1 }}>
              <Input
                fieldLabel="PROTEÍNA"
                value={pro}
                onChangeText={setPro}
                keyboardType="decimal-pad"
                suffix="g"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                fieldLabel="CARBOS"
                value={car}
                onChangeText={setCar}
                keyboardType="decimal-pad"
                suffix="g"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                fieldLabel="GRASAS"
                value={fat}
                onChangeText={setFat}
                keyboardType="decimal-pad"
                suffix="g"
              />
            </View>
          </Row>
        </Col>
        <Button
          label="Crear alimento"
          icon="check"
          fullWidth
          size="lg"
          style={{ marginTop: 24 }}
          onPress={handleCreate}
        />
      </ScrollView>
    </Screen>
  );
}
