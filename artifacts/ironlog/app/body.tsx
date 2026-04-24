import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import { Alert, Image, Modal, Platform, Pressable, ScrollView, View, Dimensions } from "react-native";

import { LineChart } from "@/components/charts/LineChart";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { formatLength, formatWeight, navyBodyFat } from "@/utils/calculations";
import { formatDateShort } from "@/utils/date";

export default function BodyScreen() {
  const colors = useThemeColors();
  const {
    profile,
    bodyWeights,
    measurements,
    photos,
    logBodyWeight,
    deleteBodyWeight,
    logMeasurement,
    deleteMeasurement,
    addProgressPhoto,
    deleteProgressPhoto,
  } = useIronLog();

  const [tab, setTab] = useState<"weight" | "measurements" | "photos">("weight");
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [weightInput, setWeightInput] = useState(String(profile.weightKg));

  const screenWidth = Dimensions.get("window").width - 64;
  const sortedWeights = [...bodyWeights].sort((a, b) => a.date - b.date);
  const sortedMeasurements = [...measurements].sort((a, b) => b.date - a.date);

  const latestM = sortedMeasurements[0];
  const bodyFat = latestM
    ? navyBodyFat(profile.sex, profile.heightCm, latestM.neck ?? 0, latestM.waist ?? 0, latestM.hips ?? 0)
    : null;

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tus fotos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      addProgressPhoto(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permiso requerido", "Necesitamos acceso a la cámara.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      addProgressPhoto(result.assets[0].uri);
    }
  };

  return (
    <Screen noPadding>
      <Header title="Cuerpo" back />
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <SegmentedControl
          options={[
            { label: "Peso", value: "weight" as const },
            { label: "Medidas", value: "measurements" as const },
            { label: "Fotos", value: "photos" as const },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 12 }}>
        {tab === "weight" && (
          <>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <View>
                  <Text variant="title">Peso</Text>
                  <Text variant="caption" muted>
                    {bodyWeights.length} registros
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowWeightForm(true)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  })}
                >
                  <Feather name="plus" size={14} color={colors.primaryForeground} />
                  <Text variant="caption" color={colors.primaryForeground} weight="semibold">
                    Registrar
                  </Text>
                </Pressable>
              </View>
              {sortedWeights.length > 1 ? (
                <LineChart
                  data={sortedWeights.map((b) => ({ x: b.date, y: b.weightKg }))}
                  width={screenWidth}
                  height={180}
                  yLabelFormatter={(v) => v.toFixed(1)}
                />
              ) : (
                <Text variant="body" muted style={{ textAlign: "center", paddingVertical: 24 }}>
                  Registra al menos 2 pesos para ver el gráfico
                </Text>
              )}
            </Card>

            <View style={{ gap: 6 }}>
              {sortedWeights.length === 0 ? (
                <EmptyState icon="activity" title="Sin registros" description="Empieza registrando tu peso de hoy." />
              ) : (
                [...sortedWeights].reverse().map((b) => (
                  <Pressable key={b.id} onLongPress={() => deleteBodyWeight(b.id)}>
                    <Card>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                          <Text variant="label" weight="semibold">
                            {formatWeight(b.weightKg, profile.units)}
                          </Text>
                          <Text variant="caption" muted>
                            {formatDateShort(b.date)}
                          </Text>
                        </View>
                        <Feather name="more-vertical" size={16} color={colors.mutedForeground} />
                      </View>
                    </Card>
                  </Pressable>
                ))
              )}
            </View>
          </>
        )}

        {tab === "measurements" && (
          <>
            {bodyFat != null ? (
              <Card style={{ backgroundColor: colors.accent, borderColor: colors.primary }}>
                <Text variant="tiny" color={colors.primary} weight="bold">
                  GRASA CORPORAL ESTIMADA (NAVY)
                </Text>
                <Text variant="h1" color={colors.primary} style={{ marginTop: 4 }}>
                  {bodyFat.toFixed(1)}%
                </Text>
              </Card>
            ) : null}

            <Button label="Nueva medición" icon="plus" onPress={() => setShowMeasureForm(true)} />

            {sortedMeasurements.length === 0 ? (
              <EmptyState icon="sliders" title="Sin medidas" description="Registra tus medidas para calcular % de grasa corporal." />
            ) : (
              sortedMeasurements.map((m) => (
                <Pressable key={m.id} onLongPress={() => deleteMeasurement(m.id)}>
                  <Card>
                    <Text variant="label" weight="semibold">
                      {formatDateShort(m.date)}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
                      {m.waist ? <MeasureChip label="Cintura" value={formatLength(m.waist, profile.units)} /> : null}
                      {m.chest ? <MeasureChip label="Pecho" value={formatLength(m.chest, profile.units)} /> : null}
                      {m.hips ? <MeasureChip label="Cadera" value={formatLength(m.hips, profile.units)} /> : null}
                      {m.neck ? <MeasureChip label="Cuello" value={formatLength(m.neck, profile.units)} /> : null}
                      {m.shoulders ? <MeasureChip label="Hombros" value={formatLength(m.shoulders, profile.units)} /> : null}
                      {m.leftArm ? <MeasureChip label="Brazo izq" value={formatLength(m.leftArm, profile.units)} /> : null}
                      {m.rightArm ? <MeasureChip label="Brazo der" value={formatLength(m.rightArm, profile.units)} /> : null}
                      {m.leftThigh ? <MeasureChip label="Muslo izq" value={formatLength(m.leftThigh, profile.units)} /> : null}
                      {m.rightThigh ? <MeasureChip label="Muslo der" value={formatLength(m.rightThigh, profile.units)} /> : null}
                    </View>
                  </Card>
                </Pressable>
              ))
            )}
          </>
        )}

        {tab === "photos" && (
          <>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button label="Galería" icon="image" onPress={handlePickPhoto} variant="outline" style={{ flex: 1 }} />
              {Platform.OS !== "web" && (
                <Button label="Cámara" icon="camera" onPress={handleTakePhoto} style={{ flex: 1 }} />
              )}
            </View>

            {photos.length === 0 ? (
              <EmptyState icon="camera" title="Sin fotos" description="Documenta tu progreso con fotos periódicas." />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {photos.map((p) => (
                  <Pressable
                    key={p.id}
                    onLongPress={() => {
                      Alert.alert("Eliminar foto", "¿Borrar esta foto?", [
                        { text: "Cancelar", style: "cancel" },
                        { text: "Eliminar", style: "destructive", onPress: () => deleteProgressPhoto(p.id) },
                      ]);
                    }}
                    style={{
                      width: (screenWidth - 16) / 3,
                      aspectRatio: 0.75,
                      borderRadius: 12,
                      overflow: "hidden",
                      backgroundColor: colors.secondary,
                    }}
                  >
                    <Image source={{ uri: p.uri }} style={{ width: "100%", height: "100%" }} />
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: 6,
                        backgroundColor: "rgba(0,0,0,0.6)",
                      }}
                    >
                      <Text variant="tiny" color="#FFFFFF">
                        {formatDateShort(p.date)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <WeightFormModal
        visible={showWeightForm}
        onClose={() => setShowWeightForm(false)}
        initial={weightInput}
        onSave={(v) => {
          logBodyWeight(v);
          setWeightInput(String(v));
          setShowWeightForm(false);
        }}
      />

      <MeasurementFormModal
        visible={showMeasureForm}
        onClose={() => setShowMeasureForm(false)}
        onSave={(data) => {
          logMeasurement({ date: Date.now(), ...data });
          setShowMeasureForm(false);
        }}
      />
    </Screen>
  );
}

function MeasureChip({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        backgroundColor: colors.secondary,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
      }}
    >
      <Text variant="tiny" muted>
        {label}
      </Text>
      <Text variant="label" weight="semibold">
        {value}
      </Text>
    </View>
  );
}

function WeightFormModal({
  visible,
  onClose,
  initial,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  initial: string;
  onSave: (v: number) => void;
}) {
  const colors = useThemeColors();
  const [v, setV] = useState(initial);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen noPadding>
        <Header
          title="Registrar peso"
          right={
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          }
        />
        <View style={{ padding: 16, gap: 16 }}>
          <Input
            label="Peso (kg)"
            value={v}
            onChangeText={setV}
            keyboardType="decimal-pad"
            autoFocus
          />
          <Button
            label="Guardar"
            icon="check"
            fullWidth
            size="lg"
            onPress={() => {
              const n = parseFloat(v);
              if (isNaN(n) || n <= 0) return;
              onSave(n);
            }}
          />
        </View>
      </Screen>
    </Modal>
  );
}

function MeasurementFormModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const colors = useThemeColors();
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [hips, setHips] = useState("");
  const [neck, setNeck] = useState("");
  const [shoulders, setShoulders] = useState("");
  const [leftArm, setLeftArm] = useState("");
  const [rightArm, setRightArm] = useState("");
  const [leftThigh, setLeftThigh] = useState("");
  const [rightThigh, setRightThigh] = useState("");

  const num = (v: string) => (v.trim() === "" ? undefined : parseFloat(v));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen noPadding>
        <Header
          title="Nueva medición"
          right={
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          <Text variant="caption" muted>
            Todas las medidas en cm. Deja en blanco las que no quieras registrar.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Input label="Cintura" value={waist} onChangeText={setWaist} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Input label="Pecho" value={chest} onChangeText={setChest} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Input label="Cadera" value={hips} onChangeText={setHips} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Input label="Cuello" value={neck} onChangeText={setNeck} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Input label="Hombros" value={shoulders} onChangeText={setShoulders} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Input label="Brazo izq" value={leftArm} onChangeText={setLeftArm} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Input label="Brazo der" value={rightArm} onChangeText={setRightArm} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Input label="Muslo izq" value={leftThigh} onChangeText={setLeftThigh} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Input label="Muslo der" value={rightThigh} onChangeText={setRightThigh} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ marginTop: 12 }}>
            <Button
              label="Guardar"
              icon="check"
              fullWidth
              size="lg"
              onPress={() =>
                onSave({
                  waist: num(waist),
                  chest: num(chest),
                  hips: num(hips),
                  neck: num(neck),
                  shoulders: num(shoulders),
                  leftArm: num(leftArm),
                  rightArm: num(rightArm),
                  leftThigh: num(leftThigh),
                  rightThigh: num(rightThigh),
                })
              }
            />
          </View>
        </ScrollView>
      </Screen>
    </Modal>
  );
}
