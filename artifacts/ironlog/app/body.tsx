import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Alert, Dimensions, Image, Modal, Platform, Pressable, ScrollView, View } from "react-native";

import { LineChart } from "@/components/charts/LineChart";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Col, Row } from "@/components/ui/Stack";
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

  const screenWidth = Dimensions.get("window").width - 76;
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
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      addProgressPhoto(result.assets[0].uri);
    }
  };

  return (
    <Screen noPadding>
      <Header title="" back compact />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}>
        <Text variant="h1" style={{ marginBottom: 18, paddingHorizontal: 4 }}>
          Cuerpo
        </Text>
        <SegmentedControl
          options={[
            { label: "Peso", value: "weight" as const },
            { label: "Medidas", value: "measurements" as const },
            { label: "Fotos", value: "photos" as const },
          ]}
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 14 }}
        />

        {tab === "weight" && (
          <Col gap={12}>
            <Card>
              <Row jc="space-between" style={{ marginBottom: 12 }}>
                <Col gap={4}>
                  <Text variant="h3">Peso corporal</Text>
                  <Text variant="caption" muted>
                    {bodyWeights.length} {bodyWeights.length === 1 ? "registro" : "registros"}
                  </Text>
                </Col>
                <Pressable
                  onPress={() => setShowWeightForm(true)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: colors.accent,
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  })}
                >
                  <Feather name="plus" size={12} color={colors.accentInk} />
                  <Text variant="label" weight="semibold" color={colors.accentInk}>
                    Registrar
                  </Text>
                </Pressable>
              </Row>
              {sortedWeights.length > 1 ? (
                <LineChart
                  data={sortedWeights.map((b, i) => ({ x: i, y: b.weightKg }))}
                  width={screenWidth}
                  height={110}
                />
              ) : (
                <Text
                  variant="body"
                  muted
                  style={{ textAlign: "center", paddingVertical: 24 }}
                >
                  Registra al menos 2 pesos para ver el gráfico
                </Text>
              )}
            </Card>

            <Col gap={6}>
              {sortedWeights.length === 0 ? (
                <EmptyState
                  icon="activity"
                  title="Sin registros"
                  description="Empieza registrando tu peso de hoy."
                />
              ) : (
                [...sortedWeights].reverse().map((b) => (
                  <Pressable key={b.id} onLongPress={() => deleteBodyWeight(b.id)}>
                    <Card padding={0}>
                      <Row jc="space-between" style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
                        <Col gap={2}>
                          <Text variant="mono" color={colors.ink} style={{ fontSize: 15, fontWeight: "600" }}>
                            {formatWeight(b.weightKg, profile.units)}
                          </Text>
                          <Text variant="caption" muted>
                            {formatDateShort(b.date)}
                          </Text>
                        </Col>
                        <Feather name="more-vertical" size={14} color={colors.muted} />
                      </Row>
                    </Card>
                  </Pressable>
                ))
              )}
            </Col>
          </Col>
        )}

        {tab === "measurements" && (
          <Col gap={12}>
            {bodyFat != null ? (
              <Card variant="accent">
                <Text variant="tiny" color={colors.accentEdge} style={{ marginBottom: 8 }}>
                  GRASA CORPORAL ESTIMADA · NAVY
                </Text>
                <Row jc="space-between" ai="baseline">
                  <Text variant="hero" color={colors.accentEdge}>
                    {bodyFat.toFixed(1)}
                    <Text variant="h2" color={colors.accentEdge}>
                      {" "}%
                    </Text>
                  </Text>
                </Row>
              </Card>
            ) : null}

            <Pressable
              onPress={() => setShowMeasureForm(true)}
              style={({ pressed }) => ({
                width: "100%",
                height: 48,
                borderRadius: 14,
                backgroundColor: colors.ink,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Feather name="plus" size={14} color={colors.bg} />
              <Text variant="label" weight="semibold" color={colors.bg}>
                Nueva medición
              </Text>
            </Pressable>

            {sortedMeasurements.length === 0 ? (
              <EmptyState
                icon="sliders"
                title="Sin medidas"
                description="Registra tus medidas para calcular % de grasa corporal."
              />
            ) : (
              <Col gap={8}>
                {sortedMeasurements.map((m) => {
                  const entries: { label: string; value: number | undefined }[] = [
                    { label: "CINTURA", value: m.waist },
                    { label: "PECHO", value: m.chest },
                    { label: "CADERA", value: m.hips },
                    { label: "CUELLO", value: m.neck },
                    { label: "HOMBROS", value: m.shoulders },
                    { label: "BRAZO IZQ", value: m.leftArm },
                    { label: "BRAZO DER", value: m.rightArm },
                    { label: "MUSLO IZQ", value: m.leftThigh },
                    { label: "MUSLO DER", value: m.rightThigh },
                  ].filter((e) => e.value != null);
                  return (
                    <Pressable key={m.id} onLongPress={() => deleteMeasurement(m.id)}>
                      <Card>
                        <Row jc="space-between" style={{ marginBottom: 12 }}>
                          <Text variant="label" weight="semibold">
                            {formatDateShort(m.date)}
                          </Text>
                          <Text variant="tiny" color={colors.muted}>
                            {entries.length} medida{entries.length === 1 ? "" : "s"}
                          </Text>
                        </Row>
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            rowGap: 8,
                            columnGap: 8,
                          }}
                        >
                          {entries.map((e) => (
                            <View
                              key={e.label}
                              style={{
                                width: "31%",
                                backgroundColor: colors.surfaceAlt,
                                borderRadius: 10,
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                              }}
                            >
                              <Text variant="tiny" color={colors.muted}>
                                {e.label}
                              </Text>
                              <Text
                                variant="mono"
                                color={colors.ink}
                                style={{ fontSize: 14, fontWeight: "600", marginTop: 2 }}
                              >
                                {e.value!.toString()}
                                <Text variant="mono" color={colors.muted} style={{ fontSize: 9 }}>
                                  {" "}
                                  {profile.units === "metric" ? "cm" : "in"}
                                </Text>
                              </Text>
                            </View>
                          ))}
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </Col>
            )}
          </Col>
        )}

        {tab === "photos" && (
          <Col gap={12}>
            <Row gap={8}>
              <Button
                label="Galería"
                icon="image"
                onPress={handlePickPhoto}
                variant="outline"
                style={{ flex: 1 }}
              />
              {Platform.OS !== "web" && (
                <Button
                  label="Cámara"
                  icon="camera"
                  variant="dark"
                  onPress={handleTakePhoto}
                  style={{ flex: 1 }}
                />
              )}
            </Row>

            {photos.length === 0 ? (
              <EmptyState
                icon="camera"
                title="Sin fotos"
                description="Documenta tu progreso con fotos periódicas."
              />
            ) : (
              <View
                style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}
              >
                {photos.map((p) => (
                  <Pressable
                    key={p.id}
                    onLongPress={() => {
                      Alert.alert("Eliminar foto", "¿Borrar esta foto?", [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Eliminar",
                          style: "destructive",
                          onPress: () => deleteProgressPhoto(p.id),
                        },
                      ]);
                    }}
                    style={{
                      width: (screenWidth - 16) / 3,
                      aspectRatio: 0.75,
                      borderRadius: 12,
                      overflow: "hidden",
                      backgroundColor: colors.surfaceAlt,
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
                        backgroundColor: "rgba(14,14,12,0.6)",
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
          </Col>
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
  const [v, setV] = useState(initial);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <Screen noPadding>
        <Header
          title=""
          compact
          right={<IconButton icon="x" onPress={onClose} />}
        />
        <View style={{ paddingHorizontal: 20 }}>
          <Text variant="h1" style={{ marginBottom: 18, paddingHorizontal: 4 }}>
            Registrar peso
          </Text>
          <Input
            fieldLabel="PESO"
            value={v}
            onChangeText={setV}
            keyboardType="decimal-pad"
            suffix="kg"
            autoFocus
          />
          <Button
            label="Guardar"
            icon="check"
            variant="dark"
            fullWidth
            size="lg"
            style={{ marginTop: 18 }}
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
  onSave: (data: Record<string, number | undefined>) => void;
}) {
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <Screen noPadding>
        <Header
          title=""
          compact
          right={<IconButton icon="x" onPress={onClose} />}
        />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <Text variant="h1" style={{ marginBottom: 6, paddingHorizontal: 4 }}>
            Nueva medición
          </Text>
          <Text variant="caption" muted style={{ marginBottom: 18, paddingHorizontal: 4 }}>
            Todas en cm. Deja en blanco las que no apliquen.
          </Text>
          <Col gap={10}>
            <Row gap={8}>
              <View style={{ flex: 1 }}>
                <Input fieldLabel="CINTURA" value={waist} onChangeText={setWaist} keyboardType="decimal-pad" suffix="cm" />
              </View>
              <View style={{ flex: 1 }}>
                <Input fieldLabel="PECHO" value={chest} onChangeText={setChest} keyboardType="decimal-pad" suffix="cm" />
              </View>
            </Row>
            <Row gap={8}>
              <View style={{ flex: 1 }}>
                <Input fieldLabel="CADERA" value={hips} onChangeText={setHips} keyboardType="decimal-pad" suffix="cm" />
              </View>
              <View style={{ flex: 1 }}>
                <Input fieldLabel="CUELLO" value={neck} onChangeText={setNeck} keyboardType="decimal-pad" suffix="cm" />
              </View>
            </Row>
            <Input fieldLabel="HOMBROS" value={shoulders} onChangeText={setShoulders} keyboardType="decimal-pad" suffix="cm" />
            <Row gap={8}>
              <View style={{ flex: 1 }}>
                <Input fieldLabel="BRAZO IZQ" value={leftArm} onChangeText={setLeftArm} keyboardType="decimal-pad" suffix="cm" />
              </View>
              <View style={{ flex: 1 }}>
                <Input fieldLabel="BRAZO DER" value={rightArm} onChangeText={setRightArm} keyboardType="decimal-pad" suffix="cm" />
              </View>
            </Row>
            <Row gap={8}>
              <View style={{ flex: 1 }}>
                <Input fieldLabel="MUSLO IZQ" value={leftThigh} onChangeText={setLeftThigh} keyboardType="decimal-pad" suffix="cm" />
              </View>
              <View style={{ flex: 1 }}>
                <Input fieldLabel="MUSLO DER" value={rightThigh} onChangeText={setRightThigh} keyboardType="decimal-pad" suffix="cm" />
              </View>
            </Row>
          </Col>
          <Button
            label="Guardar"
            icon="check"
            variant="dark"
            fullWidth
            size="lg"
            style={{ marginTop: 18 }}
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
        </ScrollView>
      </Screen>
    </Modal>
  );
}
