import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { IconButton } from "@/components/ui/IconButton";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { useThemeColors } from "@/contexts/ThemeContext";
import { useAllRoutines } from "@/domains/routines/queries";
import {
  clearOverrideForDate,
  setOverrideForDate,
  swapDates,
} from "@/domains/schedule/mutators";
import {
  resolvePlanFor,
  useSchedule,
  useScheduleOverrides,
} from "@/domains/schedule/queries";
import {
  startEmptyWorkout,
  startWorkout,
} from "@/domains/workout/mutators";
import {
  useActiveWorkoutId,
  useSessions,
} from "@/domains/workout/queries";
import type { ResolvedPlan, Routine, WorkoutSession } from "@/types";
import { DAY_LABELS_FULL, dateKey, getDayOfWeek, startOfDay } from "@/utils/date";

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

type DayStatus =
  | "today" //         hoy + entrenamiento pendiente
  | "todayRest" //     hoy + es rest (con o sin override)
  | "completed" //     se cerró una sesión en esa fecha
  | "missed" //        pasado, era training, no hay sesión finalizada
  | "skipped" //       override null sobre lo que sería training
  | "rest" //          rest natural por schedule
  | "scheduled"; //    futuro con training pendiente

interface DayInfo {
  ts: number;
  index: number;
  plan: ResolvedPlan;
  status: DayStatus;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
  /**
   * Si este card admite drag (mover hacia otra fecha) Y ser destino. Pasado
   * inmutable; rest natural se queda quieto; today completado tampoco.
   */
  draggable: boolean;
}

// Altura aproximada de cada fila incluyendo el gap entre cards. Sirve para
// detectar el destino del drag por translación (no usamos onLayout para
// mantener el código simple — 7 filas fijas, los cards comparten layout).
const ROW_HEIGHT = 92;

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface DaySwapSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function DaySwapSheet({ visible, onClose }: DaySwapSheetProps) {
  const colors = useThemeColors();
  const allRoutines = useAllRoutines();
  const activeWorkoutId = useActiveWorkoutId();
  const sessions = useSessions();
  const scheduleOverrides = useScheduleOverrides();
  const schedule = useSchedule();

  // El sheet usa la fecha al momento de abrirse (no se reactualiza si el
  // usuario lo deja abierto tras la medianoche — caso borde aceptable).
  const todayTs = useMemo(() => startOfDay(Date.now()), [visible]);

  const getPlanForDate = useMemo(
    () => (ts: number) => resolvePlanFor(ts, scheduleOverrides, schedule),
    [scheduleOverrides, schedule],
  );

  const finishedSessions = useMemo(
    () => sessions.filter((s): s is WorkoutSession & { endedAt: number } =>
      s.endedAt != null,
    ),
    [sessions],
  );

  const todayPlan = getPlanForDate(todayTs);
  const todayHasOverride = scheduleOverrides.some(
    (o) => o.dateKey === dateKey(todayTs),
  );

  // Lunes → Domingo de la semana actual.
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

  const days = useMemo<DayInfo[]>(() => {
    return weekDates.map((ts, index) => {
      const plan = getPlanForDate(ts);
      const isPast = ts < todayTs;
      const isToday = ts === todayTs;
      const isFuture = ts > todayTs;
      const completed = finishedSessions.some(
        (s) => dateKey(s.endedAt) === dateKey(ts),
      );

      let status: DayStatus;
      if (completed) status = "completed";
      else if (isToday) status = plan.kind === "training" ? "today" : "todayRest";
      else if (plan.kind === "rest")
        status = plan.isOverride ? "skipped" : "rest";
      else if (isPast) status = "missed";
      else status = "scheduled";

      // SOURCE de drag = "fila con entrenamiento" hoy o futuro. Skipped es
      // rest con override (no hay workout para arrastrar) → no draggable.
      // Past es inmutable. La validación de TARGET es independiente y vive
      // en `isValidDropTarget` para permitir soltar sobre rest/skipped.
      const draggable = !isPast && plan.kind === "training";

      return { ts, index, plan, status, isPast, isToday, isFuture, draggable };
    });
  }, [weekDates, getPlanForDate, todayTs, finishedSessions]);

  // Reglas centralizadas de validez para drop / picker. Reusables y testables.
  const isValidDropTarget = (target: DayInfo, sourceTs: number): boolean => {
    if (target.ts === sourceTs) return false;
    if (target.ts < todayTs) return false; // pasado inmutable
    if (target.status === "completed") return false; // no reescribir historia
    return true;
  };

  const pickerTargetState = (
    target: DayInfo,
    sourceTs: number,
  ): { enabled: boolean; reason: "source" | "past" | "occupied" | null } => {
    if (target.ts === sourceTs) return { enabled: false, reason: "source" };
    if (target.ts < todayTs) return { enabled: false, reason: "past" };
    // Para el picker (move-to-rest) sólo aceptamos slots libres. Los días
    // con entrenamiento (override o schedule) salen "OCUPADO".
    if (target.plan.kind === "training")
      return { enabled: false, reason: "occupied" };
    return { enabled: true, reason: null };
  };

  // -------------------------------------------------------------------------
  // Estado de overlays (action menu + reschedule picker)
  // -------------------------------------------------------------------------

  const [menuTs, setMenuTs] = useState<number | null>(null);
  const [pickerTs, setPickerTs] = useState<number | null>(null);

  const haptic = (style: "light" | "select" | "success" = "light") => {
    if (Platform.OS === "web") return;
    if (style === "select") Haptics.selectionAsync();
    else if (style === "success")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // -------------------------------------------------------------------------
  // Acciones
  // -------------------------------------------------------------------------

  const handleFreestyle = async () => {
    if (activeWorkoutId) {
      onClose();
      router.push("/workout/active");
      return;
    }
    haptic();
    await startEmptyWorkout();
    onClose();
    router.push("/workout/active");
  };

  const handleResetToday = async () => {
    haptic("select");
    await clearOverrideForDate(todayTs);
    onClose();
  };

  const handleStartToday = async () => {
    setMenuTs(null);
    if (activeWorkoutId) {
      onClose();
      router.push("/workout/active");
      return;
    }
    if (todayPlan.kind !== "training") return;
    haptic("success");
    await startWorkout(todayPlan.routineId, todayPlan.routineDayId);
    onClose();
    router.push("/workout/active");
  };

  const handleSkipDay = async (ts: number) => {
    setMenuTs(null);
    haptic("select");
    await setOverrideForDate(ts, null);
  };

  const handleResetDay = async (ts: number) => {
    setMenuTs(null);
    haptic("select");
    await clearOverrideForDate(ts);
  };

  /**
   * "Hacer hoy" desde un missed pasado. NO arranca la sesión: sólo escribe
   * el override y cierra. El usuario inicia desde Home con la CTA habitual.
   */
  const handleMakeToday = async (sourceTs: number) => {
    setMenuTs(null);
    const sourcePlan = getPlanForDate(sourceTs);
    if (sourcePlan.kind !== "training") return;
    haptic("success");
    // Inmutabilidad del pasado: nunca tocamos `sourceTs`. Sólo override hoy.
    await setOverrideForDate(todayTs, {
      routineId: sourcePlan.routineId,
      routineDayId: sourcePlan.routineDayId,
    });
    onClose();
  };

  const handleOpenReschedule = (ts: number) => {
    setMenuTs(null);
    setPickerTs(ts);
  };

  /**
   * Mueve el entrenamiento del pickerTs hacia toTs. Distingue:
   *  - Pasado missed: sólo escribe override en destino (no toca el pasado).
   *  - Hoy/futuro training: usa swapDates (origen ↔ destino). Como el
   *    destino siempre es rest (filtrado en picker), el origen queda rest.
   */
  const handlePickReschedule = async (toTs: number) => {
    if (pickerTs == null) return;
    const fromTs = pickerTs;
    if (fromTs === toTs) {
      setPickerTs(null);
      return;
    }
    const fromInfo = days.find((d) => d.ts === fromTs);
    if (!fromInfo || fromInfo.plan.kind !== "training") {
      setPickerTs(null);
      return;
    }
    haptic("success");
    if (fromInfo.isPast) {
      await setOverrideForDate(toTs, {
        routineId: fromInfo.plan.routineId,
        routineDayId: fromInfo.plan.routineDayId,
      });
    } else {
      await swapDates(fromTs, toTs);
    }
    setPickerTs(null);
  };

  /**
   * Drop tras un drag. La SOURCE viene garantizada por `gesture.enabled`
   * (sólo training hoy/futuro). El TARGET puede ser rest natural, skipped
   * u otro training — usamos swapDates que cubre los tres casos.
   */
  const handleSwapByDrag = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const fromInfo = days[fromIdx];
    const toInfo = days[toIdx];
    if (!fromInfo || !toInfo) return;
    if (!fromInfo.draggable) return; // belt-and-suspenders
    if (!isValidDropTarget(toInfo, fromInfo.ts)) return;
    haptic("success");
    await swapDates(fromInfo.ts, toInfo.ts);
  };

  // -------------------------------------------------------------------------
  // Drag & drop — shared values en el padre, leídos por cada DayItem.
  // -------------------------------------------------------------------------

  const draggingIndex = useSharedValue<number>(-1);
  const dragY = useSharedValue<number>(0);

  // Para que la card pulsada por tap (no por drag) no abra el menú durante
  // un drag, marcamos en JS si hubo movimiento (gesto pan activo). Reanimated
  // worklet → JS thread necesita runOnJS.
  const [isDragging, setIsDragging] = useState(false);

  const handleTapDay = (info: DayInfo) => {
    if (isDragging) return;
    // Días sin acciones contextuales (rest natural / completado) no abren
    // menú: el sheet queda con la card destacada y el usuario sigue.
    if (info.status === "rest" || info.status === "todayRest") return;
    if (info.status === "completed") return;
    haptic("select");
    setMenuTs(info.ts);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const todayLabel = DAY_LABELS_FULL[getDayOfWeek(todayTs)];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Screen noPadding>
          <Header
            title=""
            compact
            right={<IconButton icon="x" onPress={onClose} />}
          />
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 40,
            }}
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

            <Row
              jc="space-between"
              ai="center"
              style={{ paddingHorizontal: 4, paddingVertical: 10 }}
            >
              <Text variant="tiny" color={colors.muted}>
                ESTA SEMANA
              </Text>
              <Text variant="tiny" color={colors.mutedSoft}>
                Tap · acciones   |   Mantener · mover
              </Text>
            </Row>

            <View>
              {days.map((info) => (
                <DayItem
                  key={info.ts}
                  info={info}
                  totalItems={days.length}
                  routines={allRoutines}
                  draggingIndex={draggingIndex}
                  dragY={dragY}
                  onSwap={handleSwapByDrag}
                  onPressTap={() => handleTapDay(info)}
                  onDragStateChange={setIsDragging}
                />
              ))}
            </View>

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
              Saltear o reprogramar sólo afecta esta semana — la planificación
              original se mantiene intacta.
            </Text>
          </ScrollView>
        </Screen>

        {menuTs != null ? (
          <ActionMenu
            day={days.find((d) => d.ts === menuTs) ?? null}
            routines={allRoutines}
            onClose={() => setMenuTs(null)}
            onStartToday={handleStartToday}
            onSkip={handleSkipDay}
            onReschedule={handleOpenReschedule}
            onResetOverride={handleResetDay}
            onMakeToday={handleMakeToday}
          />
        ) : null}

        {pickerTs != null ? (
          <ReschedulePicker
            fromTs={pickerTs}
            days={days}
            routines={allRoutines}
            getTargetState={pickerTargetState}
            onClose={() => setPickerTs(null)}
            onPick={handlePickReschedule}
          />
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// DayItem — fila animada con drag + tap
// ---------------------------------------------------------------------------

interface DayItemProps {
  info: DayInfo;
  totalItems: number;
  routines: Routine[];
  draggingIndex: ReturnType<typeof useSharedValue<number>>;
  dragY: ReturnType<typeof useSharedValue<number>>;
  onSwap: (fromIdx: number, toIdx: number) => void;
  onPressTap: () => void;
  onDragStateChange: (isDragging: boolean) => void;
}

function DayItem({
  info,
  totalItems,
  routines,
  draggingIndex,
  dragY,
  onSwap,
  onPressTap,
  onDragStateChange,
}: DayItemProps) {
  const colors = useThemeColors();

  // -------------------------------------------------------------------------
  // Animaciones derivadas
  // -------------------------------------------------------------------------

  const isCurrentlyDragged = useDerivedValue(
    () => draggingIndex.value === info.index,
  );

  const isDropTarget = useDerivedValue(() => {
    if (draggingIndex.value === -1) return false;
    if (draggingIndex.value === info.index) return false;
    const candidate =
      draggingIndex.value + Math.round(dragY.value / ROW_HEIGHT);
    const clamped = Math.max(0, Math.min(totalItems - 1, candidate));
    return clamped === info.index;
  });

  const animatedContainer = useAnimatedStyle(() => {
    const dragging = isCurrentlyDragged.value;
    return {
      transform: [
        { translateY: dragging ? dragY.value : 0 },
        { scale: dragging ? 1.04 : 1 },
      ],
      zIndex: dragging ? 100 : 1,
      shadowColor: "#000",
      shadowOpacity: dragging ? 0.22 : 0,
      shadowRadius: dragging ? 12 : 0,
      shadowOffset: { width: 0, height: dragging ? 8 : 0 },
      elevation: dragging ? 12 : 0,
    };
  });

  const animatedHighlight = useAnimatedStyle(() => ({
    borderWidth: isDropTarget.value ? 2 : 0,
    borderColor: isDropTarget.value ? colors.accentEdge : "transparent",
    borderRadius: 22,
  }));

  // -------------------------------------------------------------------------
  // Gesture
  // -------------------------------------------------------------------------

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(280)
    .enabled(info.draggable)
    .onStart(() => {
      "worklet";
      draggingIndex.value = info.index;
      runOnJS(onDragStateChange)(true);
      runOnJS(triggerHapticSelection)();
    })
    .onUpdate((e) => {
      "worklet";
      dragY.value = e.translationY;
    })
    .onEnd(() => {
      "worklet";
      const candidate =
        draggingIndex.value + Math.round(dragY.value / ROW_HEIGHT);
      const target = Math.max(0, Math.min(totalItems - 1, candidate));
      const source = draggingIndex.value;
      if (source !== -1 && target !== source) {
        runOnJS(onSwap)(source, target);
      }
      dragY.value = withSpring(0, { damping: 18, stiffness: 220 });
      draggingIndex.value = -1;
      runOnJS(onDragStateChange)(false);
    })
    .onFinalize(() => {
      "worklet";
      // Por si onEnd no se llama (cancelación). Reset suave.
      if (draggingIndex.value === info.index) {
        dragY.value = withTiming(0, { duration: 160 });
        draggingIndex.value = -1;
        runOnJS(onDragStateChange)(false);
      }
    });

  // -------------------------------------------------------------------------
  // Visual base (el card)
  // -------------------------------------------------------------------------

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          {
            marginBottom: 8,
          },
          animatedContainer,
        ]}
      >
        <Animated.View style={animatedHighlight}>
          <DayCard info={info} routines={routines} onPress={onPressTap} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

function triggerHapticSelection() {
  if (Platform.OS === "web") return;
  Haptics.selectionAsync();
}

// ---------------------------------------------------------------------------
// DayCard — visual de una fila (sin drag/animación, sólo presentación)
// ---------------------------------------------------------------------------

interface DayCardProps {
  info: DayInfo;
  routines: Routine[];
  onPress: () => void;
}

function DayCard({ info, routines, onPress }: DayCardProps) {
  const colors = useThemeColors();
  const { ts, plan, status, isToday } = info;

  const dayLabel = DAY_LABELS_FULL[getDayOfWeek(ts)];
  const dateLabel = new Date(ts).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
  const trainingLabel =
    plan.kind === "training" ? planLabel(plan, routines) : null;

  const meta = statusMeta(status, colors);

  // Title: para training muestra el nombre del día; para rest "Descanso".
  const title =
    plan.kind === "training"
      ? routines.find((r) => r.id === plan.routineId)?.days.find(
          (d) => d.id === plan.routineDayId,
        )?.name ?? "Entrenamiento"
      : "Descanso";

  // Card colour: hoy con accent, missed con borde rojo, completado con
  // borde success, skipped con dashed muted, resto default.
  const cardStyle = (() => {
    const base = { borderWidth: 1.5 };
    if (status === "missed") {
      return { ...base, borderColor: colors.danger };
    }
    if (status === "completed") {
      return { ...base, borderColor: colors.ok };
    }
    if (status === "skipped") {
      return {
        ...base,
        borderColor: colors.borderStrong,
        borderStyle: "dashed" as const,
        opacity: 0.78,
      };
    }
    return {} as const;
  })();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${dayLabel} ${dateLabel} — ${title}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}
    >
      <Card
        padding={0}
        variant={isToday && plan.kind === "training" ? "accent" : "default"}
        style={cardStyle}
      >
        <Row gap={12} style={{ paddingVertical: 14, paddingHorizontal: 14 }}>
          {/* Date pill */}
          <Col
            ai="center"
            jc="center"
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor:
                isToday && plan.kind === "training"
                  ? colors.accent
                  : plan.kind === "training"
                    ? colors.surfaceAlt
                    : "transparent",
              borderWidth: plan.kind === "training" || isToday ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <Text
              variant="tiny"
              color={
                isToday && plan.kind === "training"
                  ? colors.accentInk
                  : colors.muted
              }
            >
              {dayLabel.slice(0, 3).toUpperCase()}
            </Text>
            <Text
              variant="mono"
              color={
                isToday && plan.kind === "training"
                  ? colors.accentInk
                  : colors.ink
              }
              style={{ fontSize: 13, fontWeight: "600" }}
            >
              {new Date(ts).getDate()}
            </Text>
          </Col>

          {/* Center column */}
          <Col flex={1} gap={3}>
            <Row gap={6} ai="center">
              <Text
                variant="title"
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {title}
              </Text>
              {plan.isOverride && plan.kind === "training" ? (
                <Badge
                  label="AJUSTADO"
                  bg={colors.accentSoft}
                  fg={colors.accentEdge}
                />
              ) : null}
            </Row>
            <Text variant="caption" muted numberOfLines={1}>
              {dateLabel}
              {trainingLabel ? ` · ${trainingLabel}` : ""}
            </Text>
            {meta.label ? (
              <Row gap={5} ai="center" style={{ marginTop: 2 }}>
                {meta.icon ? (
                  <Feather name={meta.icon} size={11} color={meta.color} />
                ) : null}
                <Text variant="tiny" color={meta.color} weight="semibold">
                  {meta.label}
                </Text>
              </Row>
            ) : null}
          </Col>

          {/* Right indicator */}
          <RightIndicator status={status} draggable={info.draggable} />
        </Row>
      </Card>
    </Pressable>
  );
}

function RightIndicator({
  status,
  draggable,
}: {
  status: DayStatus;
  draggable: boolean;
}) {
  const colors = useThemeColors();
  if (status === "completed") {
    return <Feather name="check-circle" size={16} color={colors.ok} />;
  }
  if (status === "missed") {
    return <Feather name="alert-circle" size={16} color={colors.danger} />;
  }
  if (status === "skipped") {
    return <Feather name="skip-forward" size={16} color={colors.muted} />;
  }
  if (draggable) {
    // Las cards draggables muestran un grip (afordancia visual de drag).
    // Tap sigue abriendo el menú; mantener pulsado activa el arrastre.
    return <Feather name="move" size={15} color={colors.mutedSoft} />;
  }
  return null;
}

function statusMeta(
  status: DayStatus,
  colors: ReturnType<typeof useThemeColors>,
): {
  label: string | null;
  color: string;
  icon: React.ComponentProps<typeof Feather>["name"] | null;
} {
  switch (status) {
    case "today":
      return { label: "HOY · TAP PARA ACCIONES", color: colors.accentEdge, icon: null };
    case "todayRest":
      return { label: "HOY · DESCANSO", color: colors.muted, icon: "moon" };
    case "completed":
      return { label: "COMPLETADO", color: colors.ok, icon: null };
    case "missed":
      return { label: "NO COMPLETADO", color: colors.danger, icon: null };
    case "skipped":
      return { label: "SALTADO", color: colors.muted, icon: null };
    case "rest":
      return { label: "DESCANSO", color: colors.muted, icon: "moon" };
    case "scheduled":
      return { label: null, color: colors.muted, icon: null };
  }
}

// ---------------------------------------------------------------------------
// ActionMenu — overlay con acciones contextuales para un día
// ---------------------------------------------------------------------------

interface ActionMenuProps {
  day: DayInfo | null;
  routines: Routine[];
  onClose: () => void;
  onStartToday: () => void;
  onSkip: (ts: number) => void;
  onReschedule: (ts: number) => void;
  onResetOverride: (ts: number) => void;
  onMakeToday: (pastTs: number) => void;
}

function ActionMenu({
  day,
  routines,
  onClose,
  onStartToday,
  onSkip,
  onReschedule,
  onResetOverride,
  onMakeToday,
}: ActionMenuProps) {
  const colors = useThemeColors();
  if (!day) return null;
  const { ts, plan, status, isToday, isPast } = day;
  const trainingLabel = plan.kind === "training" ? planLabel(plan, routines) : null;
  const dayLabel = DAY_LABELS_FULL[getDayOfWeek(ts)];

  type ActionItem = {
    key: string;
    label: string;
    icon: React.ComponentProps<typeof Feather>["name"];
    onPress: () => void;
    tone?: "default" | "primary" | "danger";
    helper?: string;
  };
  const items: ActionItem[] = [];

  // Today con training pendiente: priorizamos "Empezar".
  if (status === "today") {
    items.push({
      key: "start",
      label: "Empezar entrenamiento",
      icon: "play",
      onPress: onStartToday,
      tone: "primary",
    });
    items.push({
      key: "reschedule",
      label: "Reprogramar a otro día",
      icon: "shuffle",
      onPress: () => onReschedule(ts),
    });
    items.push({
      key: "skip",
      label: "Saltear hoy",
      icon: "skip-forward",
      onPress: () => onSkip(ts),
      tone: "danger",
    });
  } else if (status === "scheduled") {
    items.push({
      key: "reschedule",
      label: "Reprogramar a otro día",
      icon: "shuffle",
      onPress: () => onReschedule(ts),
    });
    items.push({
      key: "skip",
      label: "Saltear entrenamiento",
      icon: "skip-forward",
      onPress: () => onSkip(ts),
      tone: "danger",
    });
  } else if (status === "missed") {
    items.push({
      key: "make-today",
      label: "Hacer hoy",
      icon: "sunrise",
      onPress: () => onMakeToday(ts),
      tone: "primary",
      helper: "Setea el plan en el día de hoy. Lo iniciás desde Home.",
    });
    items.push({
      key: "reschedule",
      label: "Reprogramar a otro día",
      icon: "shuffle",
      onPress: () => onReschedule(ts),
    });
  } else if (status === "skipped") {
    items.push({
      key: "reset",
      label: "Cancelar salto",
      icon: "rotate-ccw",
      onPress: () => onResetOverride(ts),
      tone: "primary",
    });
  }

  // "Restablecer plan original" — disponible cuando el día tiene un override
  // de training (no de skip, no de pasado).
  if (plan.isOverride && plan.kind === "training" && !isPast) {
    items.push({
      key: "reset-original",
      label: "Restablecer plan original",
      icon: "rotate-ccw",
      onPress: () => onResetOverride(ts),
    });
  }

  if (items.length === 0) {
    items.push({
      key: "noop",
      label: "Cerrar",
      icon: "x",
      onPress: onClose,
    });
  }

  return (
    <Overlay onClose={onClose}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 28,
          gap: 14,
        }}
      >
        <Col gap={4}>
          <Text variant="tiny" color={colors.muted}>
            {dayLabel.toUpperCase()} ·{" "}
            {new Date(ts).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "short",
            })}
          </Text>
          <Text variant="h2" numberOfLines={1}>
            {plan.kind === "training"
              ? trainingLabel ?? "Entrenamiento"
              : "Descanso"}
          </Text>
        </Col>

        <Col gap={8}>
          {items.map((item) => (
            <ActionRow
              key={item.key}
              label={item.label}
              icon={item.icon}
              tone={item.tone}
              helper={item.helper}
              onPress={item.onPress}
            />
          ))}
        </Col>
      </View>
    </Overlay>
  );
}

function ActionRow({
  label,
  icon,
  tone = "default",
  helper,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  tone?: "default" | "primary" | "danger";
  helper?: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const palette = (() => {
    if (tone === "primary")
      return { bg: colors.accent, fg: colors.accentInk, border: colors.accent };
    if (tone === "danger")
      return { bg: "transparent", fg: colors.danger, border: colors.danger };
    return { bg: colors.surfaceAlt, fg: colors.ink, border: colors.border };
  })();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 50,
        paddingVertical: helper ? 10 : 0,
        borderRadius: 12,
        paddingHorizontal: 14,
        backgroundColor: palette.bg,
        borderWidth: tone === "danger" ? 1 : 0,
        borderColor: palette.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Feather name={icon} size={16} color={palette.fg} />
      <Col flex={1} gap={1}>
        <Text variant="label" weight="semibold" color={palette.fg}>
          {label}
        </Text>
        {helper ? (
          <Text
            variant="tiny"
            color={
              tone === "primary"
                ? "rgba(0,0,0,0.55)"
                : tone === "danger"
                  ? colors.danger
                  : colors.muted
            }
            numberOfLines={2}
          >
            {helper}
          </Text>
        ) : null}
      </Col>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// ReschedulePicker — overlay para elegir el destino del swap
// ---------------------------------------------------------------------------

type PickerTargetState = {
  enabled: boolean;
  reason: "source" | "past" | "occupied" | null;
};

interface ReschedulePickerProps {
  fromTs: number;
  days: DayInfo[];
  routines: Routine[];
  getTargetState: (target: DayInfo, sourceTs: number) => PickerTargetState;
  onClose: () => void;
  onPick: (toTs: number) => void;
}

function ReschedulePicker({
  fromTs,
  days,
  routines,
  getTargetState,
  onClose,
  onPick,
}: ReschedulePickerProps) {
  const colors = useThemeColors();
  const fromLabel = DAY_LABELS_FULL[getDayOfWeek(fromTs)];
  const fromInfo = days.find((d) => d.ts === fromTs);
  const fromTrainingLabel =
    fromInfo && fromInfo.plan.kind === "training"
      ? planLabel(fromInfo.plan, routines)
      : null;

  // Mostramos los 7 días con estado disabled. El user ve la semana completa
  // y entiende por qué algunos días no están disponibles.
  const targets = days.map((d) => ({ info: d, state: getTargetState(d, fromTs) }));
  const hasAnyEnabled = targets.some((t) => t.state.enabled);

  return (
    <Overlay onClose={onClose}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 28,
          gap: 14,
          maxHeight: "85%",
        }}
      >
        <Col gap={4}>
          <Text variant="tiny" color={colors.muted}>
            REPROGRAMAR
          </Text>
          <Text variant="h2" numberOfLines={1}>
            Mover {fromTrainingLabel ?? fromLabel}
          </Text>
          <Text variant="caption" muted>
            Elegí un día libre esta semana. Los pasados y los días ya ocupados
            están deshabilitados.
          </Text>
        </Col>

        {!hasAnyEnabled ? (
          <View
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Row gap={8} ai="center">
              <Feather name="info" size={14} color={colors.muted} />
              <Text variant="caption" muted style={{ flex: 1 }}>
                No hay días libres esta semana. Saltea un día primero o esperá
                a la próxima.
              </Text>
            </Row>
          </View>
        ) : null}

        <ScrollView showsVerticalScrollIndicator={false}>
          <Col gap={8}>
            {targets.map(({ info, state }) => (
              <RescheduleTarget
                key={info.ts}
                info={info}
                routines={routines}
                state={state}
                onPress={state.enabled ? () => onPick(info.ts) : undefined}
              />
            ))}
          </Col>
        </ScrollView>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.surfaceAlt,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text variant="label" weight="semibold">
            Cancelar
          </Text>
        </Pressable>
      </View>
    </Overlay>
  );
}

function RescheduleTarget({
  info,
  routines,
  state,
  onPress,
}: {
  info: DayInfo;
  routines: Routine[];
  state: PickerTargetState;
  onPress: (() => void) | undefined;
}) {
  const colors = useThemeColors();
  const dayLabel = DAY_LABELS_FULL[getDayOfWeek(info.ts)];
  const dateLabel = new Date(info.ts).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
  const plan = info.plan;
  const targetTitle =
    plan.kind === "training"
      ? routines.find((r) => r.id === plan.routineId)?.days.find(
          (d) => d.id === plan.routineDayId,
        )?.name ?? "Entrenamiento"
      : "Descanso";

  const reasonBadge: { label: string; bg: string; fg: string } | null = (() => {
    switch (state.reason) {
      case "source":
        return { label: "ORIGEN", bg: colors.surfaceAlt, fg: colors.muted };
      case "past":
        return { label: "PASADO", bg: colors.surfaceAlt, fg: colors.muted };
      case "occupied":
        return { label: "OCUPADO", bg: colors.surfaceAlt, fg: colors.muted };
      default:
        return null;
    }
  })();

  const disabled = !state.enabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={disabled ? "text" : "button"}
      accessibilityLabel={`${dayLabel} ${dateLabel} — ${targetTitle}${
        disabled ? ` (${reasonBadge?.label.toLowerCase() ?? "no disponible"})` : ""
      }`}
      style={({ pressed }) => ({
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      <Card
        padding={0}
        style={
          state.enabled
            ? { borderWidth: 1, borderColor: colors.accentEdge }
            : undefined
        }
      >
        <Row
          gap={12}
          style={{ paddingVertical: 12, paddingHorizontal: 14 }}
          ai="center"
        >
          <Col
            ai="center"
            jc="center"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor:
                plan.kind === "training" ? colors.surfaceAlt : "transparent",
              borderWidth: plan.kind === "rest" ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            <Text variant="tiny" color={colors.muted}>
              {dayLabel.slice(0, 3).toUpperCase()}
            </Text>
            <Text variant="mono" style={{ fontSize: 12, fontWeight: "600" }}>
              {new Date(info.ts).getDate()}
            </Text>
          </Col>
          <Col flex={1} gap={2}>
            <Row gap={6} ai="center">
              <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
                {targetTitle}
              </Text>
              {reasonBadge ? (
                <Badge
                  label={reasonBadge.label}
                  bg={reasonBadge.bg}
                  fg={reasonBadge.fg}
                />
              ) : null}
            </Row>
            <Text variant="caption" muted numberOfLines={1}>
              {dateLabel}
            </Text>
          </Col>
          {state.enabled ? (
            <Feather name="arrow-right" size={16} color={colors.accentEdge} />
          ) : (
            <Feather name="lock" size={14} color={colors.mutedSoft} />
          )}
        </Row>
      </Card>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Overlay — backdrop + bottom sheet container compartido
// ---------------------------------------------------------------------------

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.35)",
      }}
    >
      <Pressable
        onPress={onClose}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
      />
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers genéricos
// ---------------------------------------------------------------------------

function planLabel(plan: ResolvedPlan, routines: Routine[]): string | null {
  if (plan.kind !== "training") return null;
  const r = routines.find((x) => x.id === plan.routineId);
  const d = r?.days.find((x) => x.id === plan.routineDayId);
  if (!r || !d) return null;
  return `${d.name} · ${r.name}`;
}

function Badge({
  label,
  bg,
  fg,
}: {
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: bg,
      }}
    >
      <Text variant="tiny" color={fg}>
        {label}
      </Text>
    </View>
  );
}
