import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { IconButton } from "@/components/ui/IconButton";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
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

  const firstOfMonth = new Date(calendarMonth.year, calendarMonth.month, 1);
  const startDow = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(new Date(calendarMonth.year, calendarMonth.month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthChange = (delta: number) => {
    setCalendarMonth((m) => {
      const newDate = new Date(m.year, m.month + delta, 1);
      return { year: newDate.getFullYear(), month: newDate.getMonth() };
    });
  };

  return (
    <Screen noPadding>
      <Header title="" back compact />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text variant="h1" style={{ marginBottom: 18, paddingHorizontal: 4 }}>
          Planificación
        </Text>

        <Text variant="tiny" color={colors.muted} style={{ paddingHorizontal: 4, paddingVertical: 10 }}>
          PLAN SEMANAL
        </Text>
        <Col gap={6} style={{ marginBottom: 14 }}>
          {DAY_LABELS_FULL.map((label, i) => {
            const sched = schedule.find((s) => s.dayOfWeek === i);
            const routine = sched ? allRoutines.find((r) => r.id === sched.routineId) : null;
            const day = routine?.days.find((d) => d.id === sched?.routineDayId);
            const on = !!routine;
            return (
              <Pressable key={i} onPress={() => setEditingDay(i)}>
                <Card padding={0}>
                  <Row jc="space-between" style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
                    <Row gap={12}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: on ? colors.accentSoft : colors.surfaceAlt,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          variant="label"
                          weight="bold"
                          color={on ? colors.accentEdge : colors.muted}
                        >
                          {label.slice(0, 3).toUpperCase()}
                        </Text>
                      </View>
                      <Col gap={2}>
                        <Text variant="title">{label}</Text>
                        <Text variant="caption" muted>
                          {routine ? `${day?.name ?? ""} · ${routine.name}` : "Descanso"}
                        </Text>
                      </Col>
                    </Row>
                    <Feather
                      name={on ? "edit-2" : "plus"}
                      size={14}
                      color={colors.muted}
                    />
                  </Row>
                </Card>
              </Pressable>
            );
          })}
        </Col>

        <Card variant="accent" style={{ marginBottom: 18 }}>
          <Row gap={10} ai="flex-start">
            <Feather name="info" size={16} color={colors.accentEdge} style={{ marginTop: 2 }} />
            <Col gap={4}>
              <Text variant="title" color={colors.accentEdge}>
                Semana de descarga
              </Text>
              <Text variant="caption" color={colors.inkSoft} style={{ lineHeight: 17 }}>
                Cada 4-6 semanas, reduce el peso al 50% y el volumen al 50% para recuperar y volver
                más fuerte.
              </Text>
            </Col>
          </Row>
        </Card>

        <Row jc="space-between" style={{ marginBottom: 14 }}>
          <Text variant="h3">
            {MONTH_LABELS[calendarMonth.month]} {calendarMonth.year}
          </Text>
          <Row gap={6}>
            <IconButton
              icon="chevron-left"
              size={32}
              iconSize={14}
              onPress={() => monthChange(-1)}
            />
            <IconButton
              icon="chevron-right"
              size={32}
              iconSize={14}
              onPress={() => monthChange(1)}
            />
          </Row>
        </Row>

        <Card padding={12}>
          <Row style={{ marginBottom: 4 }}>
            {DAY_LABELS.map((d) => (
              <View key={d} style={{ flex: 1 }}>
                <Text
                  variant="tiny"
                  color={colors.muted}
                  style={{ textAlign: "center" }}
                >
                  {d}
                </Text>
              </View>
            ))}
          </Row>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {cells.map((cell, i) => {
              if (!cell) {
                return (
                  <View
                    key={i}
                    style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
                  />
                );
              }
              const k = dateKey(cell.getTime());
              const trained = trainedKeys.has(k);
              const isToday = k === dateKey(Date.now());
              const dow = (cell.getDay() + 6) % 7;
              const sched = schedule.find((s) => s.dayOfWeek === dow);
              return (
                <View
                  key={i}
                  style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: isToday
                        ? colors.accentSoft
                        : trained
                          ? colors.ink
                          : "transparent",
                      borderRadius: 9,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: isToday ? 2 : 0,
                      borderColor: isToday ? colors.accentEdge : "transparent",
                    }}
                  >
                    <Text
                      variant="mono"
                      style={{ fontSize: 12, fontWeight: "600" }}
                      color={
                        trained
                          ? colors.bg
                          : isToday
                            ? colors.accentEdge
                            : colors.ink
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
                          backgroundColor: colors.accentEdge,
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
      </ScrollView>

      <Modal
        visible={editingDay !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditingDay(null)}
      >
        <Screen noPadding>
          <Header
            title=""
            compact
            right={<IconButton icon="x" onPress={() => setEditingDay(null)} />}
          />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            <Text variant="h1" style={{ marginBottom: 18, paddingHorizontal: 4 }}>
              {editingDay !== null ? DAY_LABELS_FULL[editingDay] : "Día"}
            </Text>
            <Col gap={8}>
              <Pressable
                onPress={() => {
                  if (editingDay !== null) {
                    unscheduleDay(editingDay);
                    setEditingDay(null);
                  }
                }}
              >
                <Card padding={0}>
                  <Row gap={12} style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: colors.surfaceAlt,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name="moon" size={16} color={colors.muted} />
                    </View>
                    <Text variant="title" style={{ flex: 1 }}>
                      Descanso
                    </Text>
                  </Row>
                </Card>
              </Pressable>

              {allRoutines.map((r) =>
                r.days.map((d) => (
                  <Pressable
                    key={`${r.id}-${d.id}`}
                    onPress={() => {
                      if (editingDay !== null) {
                        scheduleRoutine({
                          dayOfWeek: editingDay,
                          routineId: r.id,
                          routineDayId: d.id,
                        });
                        setEditingDay(null);
                      }
                    }}
                  >
                    <Card padding={0}>
                      <Row gap={12} style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: colors.accentSoft,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather name="zap" size={16} color={colors.accentEdge} />
                        </View>
                        <Col gap={2} flex={1}>
                          <Text variant="title">{d.name}</Text>
                          <Text variant="caption" muted>
                            {r.name} · {d.exercises.length} ejercicios
                          </Text>
                        </Col>
                      </Row>
                    </Card>
                  </Pressable>
                )),
              )}
            </Col>
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}
