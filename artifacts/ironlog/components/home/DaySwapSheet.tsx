import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { IconButton } from "@/components/ui/IconButton";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useIronLog } from "@/contexts/IronLogContext";
import { useThemeColors } from "@/contexts/ThemeContext";
import type { ResolvedPlan, Routine } from "@/types";
import { DAY_LABELS_FULL, dateKey, getDayOfWeek, startOfDay } from "@/utils/date";

interface DaySwapSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function DaySwapSheet({ visible, onClose }: DaySwapSheetProps) {
  const colors = useThemeColors();
  const {
    allRoutines,
    activeWorkoutId,
    scheduleOverrides,
    startEmptyWorkout,
    startWorkout,
    swapDates,
    setOverrideForDate,
    clearOverrideForDate,
    getPlanForDate,
  } = useIronLog();

  const todayTs = useMemo(() => startOfDay(Date.now()), [visible]);
  const todayPlan = getPlanForDate(todayTs);
  const todayHasOverride = scheduleOverrides.some(
    (o) => o.dateKey === dateKey(todayTs),
  );

  // Build the 7 calendar dates for the current Mon-Sun week.
  const weekDates = useMemo(() => {
    const dow = getDayOfWeek(todayTs);
    const monday = new Date(todayTs);
    monday.setDate(monday.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.getTime();
    });
  }, [todayTs]);

  const haptic = (style: "light" | "select" = "light") => {
    if (Platform.OS === "web") return;
    if (style === "select") Haptics.selectionAsync();
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFreestyle = () => {
    if (activeWorkoutId) {
      onClose();
      router.push("/workout/active");
      return;
    }
    haptic();
    startEmptyWorkout();
    onClose();
    router.push("/workout/active");
  };

  const handlePickDay = (targetTs: number) => {
    if (activeWorkoutId) {
      onClose();
      router.push("/workout/active");
      return;
    }
    if (targetTs === todayTs) {
      // Tapping today: if we have an override, this is the "reset" path.
      if (todayHasOverride) {
        haptic("select");
        clearOverrideForDate(todayTs);
      }
      onClose();
      return;
    }

    const targetPlan = getPlanForDate(targetTs);
    if (targetPlan.kind !== "training") return;

    haptic();
    if (targetTs > todayTs) {
      // Future training day → swap (today ⇄ target)
      swapDates(todayTs, targetTs);
    } else {
      // Past training day → only override today (don't rewrite history)
      setOverrideForDate(todayTs, {
        routineId: targetPlan.routineId,
        routineDayId: targetPlan.routineDayId,
      });
    }
    startWorkout(targetPlan.routineId, targetPlan.routineDayId);
    onClose();
    router.push("/workout/active");
  };

  const handleResetToday = () => {
    haptic("select");
    clearOverrideForDate(todayTs);
    onClose();
  };

  const todayLabel = DAY_LABELS_FULL[getDayOfWeek(todayTs)];

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
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Col gap={6} style={{ marginBottom: 18, paddingHorizontal: 4 }}>
            <Text variant="h1">¿Qué hacés hoy?</Text>
            <Text variant="body" muted>
              {todayPlan.kind === "rest"
                ? `${todayLabel} es descanso. Si te animás, podés entrenar igual.`
                : `${todayLabel}: ${planLabel(todayPlan, allRoutines) ?? ""}`}
            </Text>
          </Col>

          <Pressable onPress={handleFreestyle}>
            <Card variant="ink" style={{ marginBottom: 14 }}>
              <Row gap={12}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colors.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather name="zap" size={18} color={colors.accentInk} />
                </View>
                <Col flex={1} gap={2}>
                  <Text variant="title" color={colors.bg}>
                    Sesión libre
                  </Text>
                  <Text variant="caption" color="rgba(242,240,232,0.65)">
                    Empezá sin un plan; vas armando ejercicios sobre la marcha.
                  </Text>
                </Col>
                <Feather name="arrow-right" size={16} color={colors.bg} />
              </Row>
            </Card>
          </Pressable>

          <Text
            variant="tiny"
            color={colors.muted}
            style={{ paddingHorizontal: 4, paddingVertical: 10 }}
          >
            ELEGIR OTRO DÍA DE LA SEMANA
          </Text>

          <Col gap={8}>
            {weekDates.map((ts) => (
              <DayChoice
                key={ts}
                ts={ts}
                todayTs={todayTs}
                plan={getPlanForDate(ts)}
                routines={allRoutines}
                onPress={() => handlePickDay(ts)}
              />
            ))}
          </Col>

          {todayHasOverride ? (
            <Pressable onPress={handleResetToday} style={{ marginTop: 14 }}>
              <Card variant="ghost">
                <Row gap={8} jc="center">
                  <Feather name="rotate-ccw" size={14} color={colors.muted} />
                  <Text variant="label" muted>
                    Restablecer plan original de hoy
                  </Text>
                </Row>
              </Card>
            </Pressable>
          ) : null}

          <Text
            variant="caption"
            muted
            style={{ marginTop: 18, paddingHorizontal: 8, textAlign: "center" }}
          >
            Adelantar un día futuro intercambia ambas fechas. Recuperar uno pasado
            solo modifica hoy.
          </Text>
        </ScrollView>
      </Screen>
    </Modal>
  );
}

function planLabel(plan: ResolvedPlan, routines: Routine[]): string | null {
  if (plan.kind !== "training") return null;
  const r = routines.find((x) => x.id === plan.routineId);
  const d = r?.days.find((x) => x.id === plan.routineDayId);
  if (!r || !d) return null;
  return `${d.name} · ${r.name}`;
}

function DayChoice({
  ts,
  todayTs,
  plan,
  routines,
  onPress,
}: {
  ts: number;
  todayTs: number;
  plan: ResolvedPlan;
  routines: Routine[];
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const isToday = ts === todayTs;
  const isPast = ts < todayTs;
  const isFuture = ts > todayTs;
  const isTraining = plan.kind === "training";
  const isRest = plan.kind === "rest";

  // Past rest days are useless to swap with → disabled.
  // Future rest days are also pointless to "adelantar" → disabled.
  const disabled = !isToday && isRest;

  const dayLabel = DAY_LABELS_FULL[getDayOfWeek(ts)];
  const dateLabel = new Date(ts).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });

  const trainingLabel = isTraining ? planLabel(plan, routines) : null;

  const actionHint = (() => {
    if (isToday) return plan.isOverride ? "Tocá para restablecer" : "Plan de hoy";
    if (!isTraining) return "Descanso";
    if (isPast) return "Recuperar — solo cambia hoy";
    if (isFuture) return "Adelantar — intercambia ambos días";
    return "";
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({ opacity: pressed && !disabled ? 0.85 : 1 })}
    >
      <Card
        padding={0}
        variant={isToday ? "accent" : "default"}
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        <Row gap={12} style={{ paddingVertical: 14, paddingHorizontal: 14 }}>
          <Col
            ai="center"
            jc="center"
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: isToday
                ? colors.accent
                : isTraining
                  ? colors.surfaceAlt
                  : "transparent",
              borderWidth: isTraining || isToday ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <Text
              variant="tiny"
              color={isToday ? colors.accentInk : colors.muted}
            >
              {dayLabel.slice(0, 3).toUpperCase()}
            </Text>
            <Text
              variant="mono"
              color={isToday ? colors.accentInk : colors.ink}
              style={{ fontSize: 13, fontWeight: "600" }}
            >
              {new Date(ts).getDate()}
            </Text>
          </Col>

          <Col flex={1} gap={2}>
            <Row gap={6} ai="center">
              <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
                {isTraining
                  ? routines.find((r) => r.id === plan.routineId)?.days.find(
                      (d) => d.id === plan.routineDayId,
                    )?.name ?? "Entrenamiento"
                  : "Descanso"}
              </Text>
              {plan.isOverride ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: colors.accentSoft,
                  }}
                >
                  <Text variant="tiny" color={colors.accentEdge}>
                    AJUSTADO
                  </Text>
                </View>
              ) : null}
            </Row>
            <Text variant="caption" muted numberOfLines={1}>
              {dateLabel}
              {trainingLabel ? ` · ${trainingLabel}` : ""}
            </Text>
            <Text
              variant="tiny"
              color={
                isToday
                  ? colors.accentEdge
                  : isFuture && isTraining
                    ? colors.ink
                    : colors.muted
              }
              style={{ marginTop: 2 }}
            >
              {actionHint}
            </Text>
          </Col>

          {!disabled && !isToday ? (
            <Feather
              name={isPast ? "rotate-ccw" : "shuffle"}
              size={16}
              color={colors.muted}
            />
          ) : null}
        </Row>
      </Card>
    </Pressable>
  );
}
