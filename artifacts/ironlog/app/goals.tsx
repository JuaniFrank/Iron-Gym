import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { formatRelativeDate } from "@/utils/date";

export default function GoalsScreen() {
  const colors = useThemeColors();
  const { goals, addGoal, toggleGoal, deleteGoal } = useIronLog();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState("30");

  const active = goals.filter((g) => !g.completed);
  const completed = goals.filter((g) => g.completed);

  return (
    <Screen noPadding>
      <Header
        title=""
        back
        compact
        right={
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pressable onPress={() => setShowForm(true)} hitSlop={8}>
              <Feather name="plus" size={16} color={colors.accentInk} />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text variant="h1" style={{ marginBottom: 18, paddingHorizontal: 4 }}>
          Metas
        </Text>

        {goals.length === 0 ? (
          <EmptyState
            icon="target"
            title="Sin metas"
            description="Define metas claras para mantenerte enfocado y motivado."
            actionLabel="Crear meta"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <>
            {active.length > 0 ? (
              <>
                <Text
                  variant="tiny"
                  color={colors.muted}
                  style={{ paddingHorizontal: 4, paddingVertical: 10 }}
                >
                  ACTIVAS · {active.length}
                </Text>
                <Col gap={8} style={{ marginBottom: 24 }}>
                  {active.map((g) => (
                    <Card key={g.id} padding={0}>
                      <Row
                        gap={12}
                        ai="flex-start"
                        style={{ paddingVertical: 14, paddingHorizontal: 16 }}
                      >
                        <Pressable
                          onPress={() => toggleGoal(g.id)}
                          style={({ pressed }) => ({
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            borderWidth: 1.5,
                            borderColor: colors.borderStrong,
                            marginTop: 2,
                            opacity: pressed ? 0.6 : 1,
                          })}
                        />
                        <Col gap={6} flex={1}>
                          <Text variant="title">{g.title}</Text>
                          {g.description ? (
                            <Text variant="caption" muted>
                              {g.description}
                            </Text>
                          ) : null}
                          <Row gap={4}>
                            <Feather name="calendar" size={12} color={colors.muted} />
                            <Text variant="tiny" color={colors.muted}>
                              {formatRelativeDate(g.targetDate)}
                            </Text>
                          </Row>
                        </Col>
                        <Pressable onPress={() => deleteGoal(g.id)} hitSlop={8}>
                          <Feather name="x" size={14} color={colors.muted} />
                        </Pressable>
                      </Row>
                    </Card>
                  ))}
                </Col>
              </>
            ) : null}

            {completed.length > 0 ? (
              <>
                <Text
                  variant="tiny"
                  color={colors.muted}
                  style={{ paddingHorizontal: 4, paddingVertical: 10 }}
                >
                  COMPLETADAS · {completed.length}
                </Text>
                <Col gap={8}>
                  {completed.map((g) => (
                    <Card
                      key={g.id}
                      padding={0}
                      style={{ paddingVertical: 14, paddingHorizontal: 16, opacity: 0.65 }}
                    >
                      <Row gap={12}>
                        <Pressable
                          onPress={() => toggleGoal(g.id)}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: colors.accent,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather name="check" size={12} color={colors.accentInk} />
                        </Pressable>
                        <Col gap={2} flex={1}>
                          <Text
                            variant="title"
                            style={{
                              textDecorationLine: "line-through",
                              textDecorationColor: colors.muted,
                            }}
                          >
                            {g.title}
                          </Text>
                          <Text variant="caption" muted>
                            Completada {formatRelativeDate(g.targetDate)}
                          </Text>
                        </Col>
                        <Pressable onPress={() => deleteGoal(g.id)} hitSlop={8}>
                          <Feather name="x" size={14} color={colors.muted} />
                        </Pressable>
                      </Row>
                    </Card>
                  ))}
                </Col>
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowForm(false)}
      >
        <Screen noPadding>
          <Header
            title=""
            compact
            right={<IconButton icon="x" onPress={() => setShowForm(false)} />}
          />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }}>
            <Text variant="h1" style={{ marginBottom: 18, paddingHorizontal: 4 }}>
              Nueva meta
            </Text>
            <Col gap={10}>
              <Input
                fieldLabel="TÍTULO"
                value={title}
                onChangeText={setTitle}
                placeholder="Ej. Press de banca a 100kg"
                autoFocus
              />
              <Input
                fieldLabel="DESCRIPCIÓN"
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Opcional"
              />
              <Input
                fieldLabel="PLAZO"
                value={days}
                onChangeText={setDays}
                keyboardType="number-pad"
                suffix="días"
              />
            </Col>
            <Button
              label="Crear meta"
              icon="check"
              variant="dark"
              fullWidth
              size="lg"
              style={{ marginTop: 18 }}
              onPress={() => {
                if (!title.trim()) {
                  Alert.alert("Falta título", "Escribe un título para la meta.");
                  return;
                }
                const dn = parseInt(days, 10) || 30;
                addGoal({
                  title: title.trim(),
                  description: description.trim() || undefined,
                  targetDate: Date.now() + dn * 24 * 60 * 60 * 1000,
                });
                setTitle("");
                setDescription("");
                setDays("30");
                setShowForm(false);
              }}
            />
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}
