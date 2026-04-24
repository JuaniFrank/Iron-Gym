import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import { DAY_LABELS, DAY_LABELS_FULL, MONTH_LABELS, dateKey } from "@/utils/date";

export default function PlanningScreen() {
  const colors = useThemeColors();
  const { schedule, allRoutines, scheduleRoutine, unscheduleDay, sessions } = useIronLog();
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const trainedKeys = useMemo(
    () => new Set(sessions.filter((s) => s.endedAt).map((s) => dateKey(s.endedAt!))),
    [sessions],
  );

  // Build calendar
  const firstOfMonth = new Date(calendarMonth.year, calendarMonth.month, 1);
  const startDow = (firstOfMonth.getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calendarMonth.year, calendarMonth.month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthChange = (delta: number) => {
    setCalendarMonth((m) => {
      const nm = m.month + delta;
      const newDate = new Date(m.year, nm, 1);
      return { year: newDate.getFullYear(), month: newDate.getMonth() };
    });
  };

  return (
    <Screen noPadding>
      <Header title="Planificación" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Weekly schedule */}
        <View>
          <Text variant="h3" style={{ marginBottom: 12 }}>
            Plan semanal
          </Text>
          <View style={{ gap: 8 }}>
            {DAY_LABELS_FULL.map((label, i) => {
              const sched = schedule.find((s) => s.dayOfWeek === i);
              const routine = sched ? allRoutines.find((r) => r.id === sched.routineId) : null;
              const day = routine?.days.find((d) => d.id === sched?.routineDayId);

              return (
                <Pressable key={i} onPress={() => setEditingDay(i)}>
                  <Card>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: routine ? colors.accent : colors.secondary,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <Text variant="caption" weight="bold" color={routine ? colors.primary : colors.mutedForeground}>
                          {label.slice(0, 3).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="title">{label}</Text>
                        <Text variant="caption" muted>
                          {routine ? `${routine.name} · ${day?.name ?? ""}` : "Descanso"}
                        </Text>
                      </View>
                      <Feather
                        name={routine ? "edit-2" : "plus"}
                        size={18}
                        color={colors.mutedForeground}
                      />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Deload note */}
        <Card style={{ backgroundColor: colors.accent, borderColor: colors.primary }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <Feather name="info" size={18} color={colors.primary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text variant="title" color={colors.primary}>
                Semana de descarga
              </Text>
              <Text variant="caption" color={colors.accentForeground} style={{ marginTop: 2 }}>
                Cada 4-6 semanas reduce el peso al 50% y el volumen al 50% para recuperar y volver más fuerte.
              </Text>
            </View>
          </View>
        </Card>

        {/* Calendar */}
        <View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text variant="h3">
              {MONTH_LABELS[calendarMonth.month]} {calendarMonth.year}
            </Text>
            <View style={{ flexDirection: "row", gap: 4 }}>
              <Pressable
                onPress={() => monthChange(-1)}
                style={({ pressed }) => ({
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.secondary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Feather name="chevron-left" size={16} color={colors.foreground} />
              </Pressable>
              <Pressable
                onPress={() => monthChange(1)}
                style={({ pressed }) => ({
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.secondary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Feather name="chevron-right" size={16} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
          <Card>
            <View style={{ flexDirection: "row", marginBottom: 8 }}>
              {DAY_LABELS.map((d) => (
                <Text
                  key={d}
                  variant="tiny"
                  muted
                  style={{ flex: 1, textAlign: "center" }}
                >
                  {d}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {cells.map((cell, i) => {
                if (!cell) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
                const k = dateKey(cell.getTime());
                const trained = trainedKeys.has(k);
                const isToday = k === dateKey(Date.now());
                const dow = (cell.getDay() + 6) % 7;
                const sched = schedule.find((s) => s.dayOfWeek === dow);
                return (
                  <View
                    key={i}
                    style={{
                      width: `${100 / 7}%`,
                      aspectRatio: 1,
                      padding: 2,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: trained ? colors.primary : isToday ? colors.accent : "transparent",
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: isToday ? 2 : 0,
                        borderColor: isToday ? colors.primary : "transparent",
                      }}
                    >
                      <Text
                        variant="label"
                        weight={trained || isToday ? "bold" : "medium"}
                        color={
                          trained
                            ? "#FFFFFF"
                            : isToday
                            ? colors.primary
                            : colors.foreground
                        }
                      >
                        {cell.getDate()}
                      </Text>
                      {sched && !trained ? (
                        <View
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: colors.primary,
                            marginTop: 2,
                          }}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Day picker modal */}
      <Modal
        visible={editingDay !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditingDay(null)}
      >
        <Screen noPadding>
          <Header
            title={editingDay !== null ? DAY_LABELS_FULL[editingDay] : "Día"}
            right={
              <Pressable onPress={() => setEditingDay(null)} hitSlop={8}>
                <Feather name="x" size={22} color={colors.foreground} />
              </Pressable>
            }
          />
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Pressable
              onPress={() => {
                if (editingDay !== null) {
                  unscheduleDay(editingDay);
                  setEditingDay(null);
                }
              }}
            >
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Feather name="moon" size={20} color={colors.mutedForeground} />
                  <Text variant="title" style={{ marginLeft: 12, flex: 1 }}>
                    Descanso
                  </Text>
                </View>
              </Card>
            </Pressable>

            {allRoutines.map((r) =>
              r.days.map((d) => (
                <Pressable
                  key={`${r.id}-${d.id}`}
                  onPress={() => {
                    if (editingDay !== null) {
                      scheduleRoutine({ dayOfWeek: editingDay, routineId: r.id, routineDayId: d.id });
                      setEditingDay(null);
                    }
                  }}
                >
                  <Card>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: colors.accent,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <Feather name="zap" size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="title">{d.name}</Text>
                        <Text variant="caption" muted>
                          {r.name} · {d.exercises.length} ejercicios
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              )),
            )}
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}
