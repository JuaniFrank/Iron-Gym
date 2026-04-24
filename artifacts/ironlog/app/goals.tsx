import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
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
        title="Metas"
        back
        right={
          <Pressable onPress={() => setShowForm(true)} hitSlop={8}>
            <Feather name="plus" size={22} color={colors.primary} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
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
                <Text variant="tiny" muted>
                  ACTIVAS · {active.length}
                </Text>
                {active.map((g) => (
                  <Card key={g.id}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      <Pressable
                        onPress={() => toggleGoal(g.id)}
                        style={({ pressed }) => ({
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: colors.border,
                          marginRight: 12,
                          marginTop: 2,
                          opacity: pressed ? 0.6 : 1,
                        })}
                      />
                      <View style={{ flex: 1 }}>
                        <Text variant="title">{g.title}</Text>
                        {g.description ? (
                          <Text variant="caption" muted style={{ marginTop: 2 }}>
                            {g.description}
                          </Text>
                        ) : null}
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 }}>
                          <Feather name="calendar" size={12} color={colors.mutedForeground} />
                          <Text variant="caption" muted>
                            {formatRelativeDate(g.targetDate)}
                          </Text>
                        </View>
                      </View>
                      <Pressable onPress={() => deleteGoal(g.id)} hitSlop={8}>
                        <Feather name="x" size={18} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  </Card>
                ))}
              </>
            ) : null}

            {completed.length > 0 ? (
              <>
                <Text variant="tiny" muted style={{ marginTop: 12 }}>
                  COMPLETADAS · {completed.length}
                </Text>
                {completed.map((g) => (
                  <Card key={g.id} style={{ opacity: 0.7 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Pressable
                        onPress={() => toggleGoal(g.id)}
                        style={({ pressed }) => ({
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: colors.primary,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <Feather name="check" size={14} color="#FFFFFF" />
                      </Pressable>
                      <Text variant="title" style={{ flex: 1, textDecorationLine: "line-through" }}>
                        {g.title}
                      </Text>
                      <Pressable onPress={() => deleteGoal(g.id)} hitSlop={8}>
                        <Feather name="x" size={18} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  </Card>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <Screen noPadding>
          <Header
            title="Nueva meta"
            right={
              <Pressable onPress={() => setShowForm(false)} hitSlop={8}>
                <Feather name="x" size={22} color={colors.foreground} />
              </Pressable>
            }
          />
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Input label="Título" value={title} onChangeText={setTitle} placeholder="Ej. Press de banca a 100kg" autoFocus />
            <Input
              label="Descripción (opcional)"
              value={description}
              onChangeText={setDescription}
              multiline
              style={{ minHeight: 80, textAlignVertical: "top", paddingTop: 12 }}
            />
            <Input
              label="Plazo en días"
              value={days}
              onChangeText={setDays}
              keyboardType="number-pad"
            />
            <View style={{ marginTop: 8 }}>
              <Button
                label="Crear meta"
                icon="check"
                fullWidth
                size="lg"
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
            </View>
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}
