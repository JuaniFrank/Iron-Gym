import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { showAlert } from "@/utils/alert";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { IconButton } from "@/components/ui/IconButton";
import { Screen } from "@/components/ui/Screen";
import { Col, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { NoteSheet } from "@/components/notes/NoteSheet";
import { QuickNoteMenu } from "@/components/notes/QuickNoteMenu";
import { ExerciseActionSheet } from "@/components/workout/ExerciseActionSheet";
import { RestTimer, type RestTimerState } from "@/components/workout/RestTimer";
import { SetRow } from "@/components/workout/SetRow";
import { TermHint } from "@/components/workout/TermHint";
import { useThemeColors } from "@/contexts/ThemeContext";
import { useAllExercises } from "@/domains/exercises/queries";
import { useAllNotes } from "@/domains/notes/queries";
import {
  useDefaultRestSeconds,
  useRestNotificationConfig,
} from "@/domains/profile/queries";
import { useRoutineById } from "@/domains/routines/queries";
import { useSessionPlan } from "@/domains/schedule/queries";
import { isFinished, planRestStart } from "@/domains/workout/restTimer";
import { saveSetThenRest } from "@/domains/workout/completeSet";
import { withSessionEnding } from "@/domains/workout/sessionEnd";
import {
  getLastSetsForExercise,
  getMaxWeightForExercise,
} from "@/domains/workout/helpers";
import {
  cancelWorkout,
  finishWorkout,
  logSet,
  removeSessionExercise,
  removeSet,
  reorderSessionExercises,
  setExerciseCollapsed,
  setSessionExerciseSkipped,
  startWorkout,
  upsertSessionSetDraft,
} from "@/domains/workout/mutators";
import {
  buildDraftKey,
  useActiveSession,
  useActiveWorkoutId,
  useCollapsedExercises,
  useDraftsBySession,
  useSessionsWithStatus,
} from "@/domains/workout/queries";
import { activeScreenView } from "@/domains/workout/activeSessionState";
import {
  computeExerciseRows,
  draftSlotCounts,
  isActiveWorkoutDataLoaded,
  nextExtraWork,
  rowKey,
} from "@/domains/workout/sessionRows";
import { parseDraftPatch, resolveSetInputs } from "@/domains/workout/setInputs";
import {
  cancelRestNotification,
  scheduleRestNotification,
} from "@/services/notifications";
import { dateKey, elapsedMs, formatDuration } from "@/utils/date";
import { errorDetail } from "@/utils/errorDetail";

export default function ActiveWorkoutScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ routineId?: string; dayId?: string }>();
  const { sessions, loaded: sessionsLoaded } = useSessionsWithStatus();
  const activeWorkoutId = useActiveWorkoutId();
  const session = useActiveSession();
  const allExercises = useAllExercises();
  const exerciseById = useMemo(
    () => new Map(allExercises.map((e) => [e.id, e])),
    [allExercises],
  );
  const getExerciseById = (id: string) => exerciseById.get(id);
  const routine = useRoutineById(session?.routineId ?? null);
  const defaultRestSeconds = useDefaultRestSeconds();
  const notes = useAllNotes();
  // `undefined` = still loading (never "empty"): the list below waits for it.
  const drafts = useDraftsBySession(session?.id);
  const restNotifConfig = useRestNotificationConfig();
  const sessionPlan = useSessionPlan(
    session ? dateKey(session.startedAt) : null,
    session?.routineId,
    session?.routineDayId,
  );
  // Which exercise card has its action sheet open (null = closed).
  const [actionForExId, setActionForExId] = useState<string | null>(null);

  // NoteSheet state — abrir nota completa para un set específico (o ejercicio).
  const [noteSheet, setNoteSheet] = useState<{
    setId?: string;
    exerciseId: string;
    contextLabel: string;
  } | null>(null);

  // QuickNoteMenu state — long-press del check de un set abre menú radial
  // con top chips de "effort". (Step 4)
  const [quickMenu, setQuickMenu] = useState<{
    setId: string;
    exerciseId: string;
    setIndex: number;
  } | null>(null);

  // Opened with routine/day params: start that workout, but only once the
  // active id has loaded (`null`, not `undefined`) so an already active
  // workout is never duplicated.
  const startedRef = useRef(false);
  const [startFailed, setStartFailed] = useState(false);
  useEffect(() => {
    if (activeWorkoutId === null && params.routineId && params.dayId && !startedRef.current) {
      startedRef.current = true;
      startWorkout(params.routineId, params.dayId).catch((e) => {
        console.warn("[active] startWorkout failed:", e);
        setStartFailed(true);
      });
    }
  }, [activeWorkoutId, params.routineId, params.dayId, startWorkout]);

  const day = routine?.days.find((d) => d.id === session?.routineDayId) ?? null;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Rest timer. `restingEndsAt` is the source of truth (a timestamp, so it
  // survives background); pause state and pin live here too, so pinning, which
  // moves the timer between the inline slot and the sticky overlay and
  // therefore re-mounts it, never loses them.
  const [restingEndsAt, setRestingEndsAt] = useState<number | null>(null);
  const [restingPausedAt, setRestingPausedAt] = useState<number | null>(null);
  const [restingDuration, setRestingDuration] = useState(0);
  const [restingPinned, setRestingPinned] = useState(false);
  // Id of the scheduled end-of-rest notification, to cancel it on close/adjust.
  const restingNotifIdRef = useRef<string | null>(null);
  const restHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifQueueRef = useRef<Promise<void>>(Promise.resolve());
  const restNotifConfigRef = useRef(restNotifConfig);
  restNotifConfigRef.current = restNotifConfig;
  // Set right before leaving the screen after finishing/discarding, so the
  // unmount flush of a row's pending draft does not write into a closed session.
  const sessionEndedRef = useRef(false);

  const clearRestHideTimeout = () => {
    if (restHideTimeoutRef.current) {
      clearTimeout(restHideTimeoutRef.current);
      restHideTimeoutRef.current = null;
    }
  };
  useEffect(() => clearRestHideTimeout, []);

  // Cancel the previous notification and schedule one for `endsAt` (or none).
  // Serialized so quick close/start/adjust sequences cannot interleave. Nothing
  // is scheduled until the notification prefs are loaded.
  const syncRestNotification = (endsAt: number | null) => {
    notifQueueRef.current = notifQueueRef.current.then(async () => {
      try {
        await cancelRestNotification(restingNotifIdRef.current);
        restingNotifIdRef.current = null;
        const config = restNotifConfigRef.current;
        if (endsAt != null && config) {
          restingNotifIdRef.current = await scheduleRestNotification(endsAt, config);
        }
      } catch (e) {
        console.warn("[active] rest notification sync failed:", e);
      }
    });
  };

  const startRest = (seconds: number) => {
    const plan = planRestStart(seconds, Date.now());
    // 0 s = no rest: a new set still replaces the previous timer, but nothing
    // new is shown (it would sit at 0:00).
    if (!plan) {
      closeRest();
      return;
    }
    clearRestHideTimeout();
    setRestingEndsAt(plan.endsAt);
    setRestingPausedAt(null);
    setRestingDuration(plan.durationSeconds);
    syncRestNotification(plan.endsAt);
  };

  // Slots whose save is in flight: a double tap on the check must log once.
  const savingSetsRef = useRef(new Set<string>());

  const removeSetOrAlert = (setId: string) => {
    if (!session) return;
    removeSet(session.id, setId).catch((e) => {
      console.warn("[active] removeSet failed:", e);
      showAlert("No se pudo eliminar el set", errorDetail(e));
    });
  };

  const closeRest = () => {
    clearRestHideTimeout();
    setRestingEndsAt(null);
    setRestingPausedAt(null);
    syncRestNotification(null);
  };

  // Pause / resume / +-15 from the timer. A paused timer has no notification.
  const handleRestChange = (next: RestTimerState) => {
    clearRestHideTimeout();
    setRestingEndsAt(next.endsAt);
    setRestingPausedAt(next.pausedAt);
    syncRestNotification(next.pausedAt == null ? next.endsAt : null);
  };

  const handleRestComplete = () => {
    // The notification (if any) was consumed; do not try to cancel it later.
    restingNotifIdRef.current = null;
    if (restingPinned) return;
    // Let the pulse animation finish before hiding the inline card.
    clearRestHideTimeout();
    restHideTimeoutRef.current = setTimeout(() => {
      restHideTimeoutRef.current = null;
      setRestingEndsAt(null);
      setRestingPausedAt(null);
    }, 800);
  };

  const handleTogglePin = () => {
    clearRestHideTimeout();
    // Unpinning an already finished timer just dismisses it.
    if (
      restingPinned &&
      restingEndsAt != null &&
      isFinished(restingEndsAt, restingPausedAt ?? Date.now())
    ) {
      closeRest();
    }
    setRestingPinned((p) => !p);
  };

  // Extra empty work rows added with "Añadir set" (on top of the plan); logged
  // sets and drafts grow the rows by themselves (drafts also restore them after
  // a restart, see `computeExerciseRows`).
  const [extraWorkSetsByExercise, setExtraWorkSetsByExercise] = useState<
    Record<string, number>
  >({});

  // Accordion: "Finalizar serie" (only offered once every work set is done)
  // collapses the card to a compact header; tapping the header expands it.
  // Persisted per session (local-only) so it survives leaving the screen;
  // `undefined` while loading, and the screen waits for it.
  const collapsedByExercise = useCollapsedExercises(session?.id);

  const persistCollapsed = (exId: string, isCollapsed: boolean) => {
    if (!session) return;
    setExerciseCollapsed(session.id, exId, isCollapsed).catch((e) => {
      console.warn("[active] collapsed state save failed:", e);
    });
  };

  const handleFinishSet = (exId: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    persistCollapsed(exId, true);
  };

  const expandExercise = (exId: string) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    persistCollapsed(exId, false);
  };

  // Hooks must run unconditionally — keep these before the early return below.
  const skippedSet = useMemo(
    () => new Set(session?.skippedExerciseIds ?? []),
    [session?.skippedExerciseIds],
  );

  // `undefined` = still loading: never flash "Sin sesión activa" meanwhile
  // (also while a workout requested through the route params is starting).
  const view = activeScreenView({
    session,
    startPending: !!params.routineId && !!params.dayId && !startFailed,
  });
  if (view === "loading" || (session && collapsedByExercise === undefined)) {
    return (
      <Screen noPadding>
        <Header title="Sesión" back />
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen noPadding>
        <Header title="Sesión" back />
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <EmptyState
            icon="zap"
            title="Sin sesión activa"
            description="Inicia una rutina para empezar a registrar."
            actionLabel="Ver rutinas"
            onAction={() => router.replace("/workout")}
          />
        </View>
      </Screen>
    );
  }

  // Rows seed their inputs once on mount, so the exercise list waits until
  // every source (plan, drafts, routine, history) has loaded.
  const dataLoaded = isActiveWorkoutDataLoaded({
    plan: sessionPlan,
    drafts,
    routine,
    sessionsLoaded,
  });

  const elapsed = elapsedMs(now, session.startedAt);
  const completedSets = session.sets;
  const completedSetsCount = completedSets.filter(
    (s) => !s.isWarmup && !skippedSet.has(s.exerciseId),
  ).length;
  const totalVolume = completedSets
    .filter((s) => !s.isWarmup && !skippedSet.has(s.exerciseId))
    .reduce((sum, s) => sum + s.weight * s.reps, 0);

  // Total target work-set count across exercises in this session, excluding skipped.
  const targetTotal = session.exerciseOrder.reduce((sum, exId) => {
    if (skippedSet.has(exId)) return sum;
    const re = day?.exercises.find((x) => x.exerciseId === exId);
    return sum + (re?.targetSets ?? 3);
  }, 0);

  const handleAddExercise = () => {
    router.push(`/exercises?sessionId=${session.id}` as never);
  };

  const handleFinish = () => {
    if (completedSetsCount === 0) {
      showAlert("Sin sets", "Registra al menos un set antes de terminar.");
      return;
    }
    showAlert("Terminar sesión", "¿Quieres terminar el entrenamiento?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Terminar",
        onPress: async () => {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          // The flag goes up before awaiting (a row unmounting or its debounce
          // firing while the session closes must not write a draft into it)
          // and comes back down if finishing fails.
          let result: Awaited<ReturnType<typeof finishWorkout>>;
          try {
            result = await withSessionEnding(sessionEndedRef, () =>
              finishWorkout(session.id),
            );
          } catch (e) {
            console.warn("[active] finishWorkout failed:", e);
            showAlert("No se pudo terminar", errorDetail(e));
            return;
          }
          closeRest();
          const achievementIds = result.newAchievements.map((a) => a.id);
          router.replace(
            `/workout/summary?sessionId=${result.session.id}&prs=${result.prs.length}&achievements=${achievementIds.join(",")}`,
          );
        },
      },
    ]);
  };

  const handleCancel = () => {
    showAlert(
      "Descartar sesión",
      "¿Descartar este entrenamiento? Se perderán los sets registrados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: async () => {
            try {
              await withSessionEnding(sessionEndedRef, () =>
                cancelWorkout(session.id),
              );
            } catch (e) {
              console.warn("[active] cancelWorkout failed:", e);
              showAlert("No se pudo descartar", errorDetail(e));
              return;
            }
            closeRest();
            router.replace("/workout");
          },
        },
      ],
    );
  };

  return (
    <Screen noPadding>
      {/* Header strip: down chevron · "EN SESIÓN · Day" · close */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton icon="chevron-down" onPress={() => router.back()} />
        <Col gap={2} ai="center">
          <Text variant="tiny" color={colors.muted}>
            EN SESIÓN
          </Text>
          <Text variant="label" weight="semibold">
            {session.dayName}
          </Text>
        </Col>
        <IconButton icon="x" onPress={handleCancel} color={colors.danger} />
      </View>

      {/* Sticky rest timer: only while pinned, floating above the scroll. */}
      {restingEndsAt != null && restingPinned ? (
        <View
          style={{
            position: "absolute",
            top: insets.top + 60,
            left: 16,
            right: 16,
            zIndex: 10,
          }}
        >
          <RestTimer
            endsAt={restingEndsAt}
            pausedAt={restingPausedAt}
            durationSeconds={restingDuration}
            onChange={handleRestChange}
            onComplete={handleRestComplete}
            onClose={closeRest}
            pinned={restingPinned}
            onTogglePin={handleTogglePin}
          />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          // Leave room for the pinned timer overlay so it hides no content.
          paddingTop: restingEndsAt != null && restingPinned ? 240 : 0,
          paddingBottom: 120 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary tiles */}
        <Card padding={0} style={{ marginBottom: 12 }}>
          <Row jc="space-between" style={{ paddingVertical: 14 }}>
            <SummaryCol label="DURACIÓN" value={formatDuration(elapsed)} />
            <Divider vertical />
            <SummaryCol
              label="SETS"
              value={
                <Text variant="mono" color={colors.ink} style={{ fontSize: 18, fontWeight: "600" }}>
                  {completedSetsCount}
                  {targetTotal > 0 ? (
                    <Text variant="mono" color={colors.muted} style={{ fontSize: 18 }}>
                      /{targetTotal}
                    </Text>
                  ) : null}
                </Text>
              }
            />
            <Divider vertical />
            <SummaryCol
              label="VOLUMEN"
              value={
                <Text variant="mono" color={colors.ink} style={{ fontSize: 18, fontWeight: "600" }}>
                  {Math.round(totalVolume).toLocaleString()}
                  <Text variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
                    kg
                  </Text>
                </Text>
              }
            />
          </Row>
        </Card>

        {restingEndsAt != null && !restingPinned ? (
          <View style={{ marginBottom: 12 }}>
            <RestTimer
              endsAt={restingEndsAt}
              pausedAt={restingPausedAt}
              durationSeconds={restingDuration}
              onChange={handleRestChange}
              onComplete={handleRestComplete}
              onClose={closeRest}
              pinned={restingPinned}
              onTogglePin={handleTogglePin}
            />
          </View>
        ) : null}

        <Col gap={12}>
          {dataLoaded
            ? session.exerciseOrder.map((exId, idx) => {
            const ex = getExerciseById(exId);
            if (!ex) return null;
            const isSkipped = skippedSet.has(exId);

            // Compact "skipped" card — no inputs, just a CTA to undo.
            if (isSkipped) {
              return (
                <Card
                  key={exId}
                  variant="ghost"
                  style={{ borderStyle: "dashed", opacity: 0.85 }}
                >
                  <Row jc="space-between" ai="center">
                    <Row gap={10} flex={1}>
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
                        <Feather name="skip-forward" size={14} color={colors.muted} />
                      </View>
                      <Col flex={1} gap={2}>
                        <Text variant="title" color={colors.muted} numberOfLines={1}>
                          {ex.name}
                        </Text>
                        <Text variant="tiny" color={colors.muted}>
                          SALTADO EN ESTA SESIÓN
                        </Text>
                      </Col>
                    </Row>
                    <Pressable
                      onPress={() => {
                        setSessionExerciseSkipped(session.id, exId, false);
                        if (Platform.OS !== "web") {
                          Haptics.selectionAsync();
                        }
                      }}
                      hitSlop={8}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: colors.accentSoft,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Feather name="rotate-ccw" size={11} color={colors.accentEdge} />
                      <Text variant="label" color={colors.accentEdge}>
                        Volver a hacer
                      </Text>
                    </Pressable>
                  </Row>
                </Card>
              );
            }

            const re = day?.exercises.find((x) => x.exerciseId === exId);
            const targetSets = re?.targetSets ?? 3;
            const targetReps = re?.targetReps ?? 10;
            const warmupSets = re?.warmupSets ?? 0;
            const restSeconds = re?.restSeconds ?? defaultRestSeconds;

            // Collapsed accordion card: same header as the expanded one with a
            // chevron; the whole card is the tap target.
            if (collapsedByExercise?.[exId] ?? false) {
              return (
                <Card key={exId}>
                  <Pressable
                    onPress={() => expandExercise(exId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Expandir ${ex.name}`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Row jc="space-between" ai="center">
                      <Row gap={10} flex={1}>
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
                          <Feather name="check" size={16} color={colors.accentEdge} />
                        </View>
                        <Col gap={2} flex={1}>
                          <Text variant="title" numberOfLines={1}>
                            {ex.name}
                          </Text>
                          <Text variant="caption" muted>
                            {targetSets} × {targetReps} · {restSeconds}s
                          </Text>
                        </Col>
                      </Row>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.surfaceAlt,
                        }}
                      >
                        <Feather name="chevron-down" size={16} color={colors.muted} />
                      </View>
                    </Row>
                  </Pressable>
                </Card>
              );
            }

            const plannedExercise = sessionPlan?.exercises.find(
              (p) => p.exerciseId === exId,
            );
            const plannedWarmupSets = plannedExercise
              ? plannedExercise.sets.filter((s) => s.isWarmup)
              : null;
            const plannedWorkSets = plannedExercise
              ? plannedExercise.sets.filter((s) => !s.isWarmup)
              : null;

            const completedForExercise = session.sets.filter((s) => s.exerciseId === exId);
            const lastSets = getLastSetsForExercise(sessions, exId, session.id);
            // Excluir la sesión en curso — el max es histórico, no incluye
            // los sets que el usuario está logueando ahora mismo.
            const exerciseMax = getMaxWeightForExercise(
              sessions,
              exId,
              session.id,
            );

            // Rows: plan wins over routine defaults; warm-up and work grow
            // independently when more sets were logged, plus manual extras.
            const completedWarmupCount = completedForExercise.filter(
              (s) => s.isWarmup,
            ).length;
            // Drafts keep rows added with "Añadir set" alive after a restart.
            const draftCounts = draftSlotCounts(drafts, exId);
            const rowsArgs = {
              plannedWarmup: plannedWarmupSets?.length ?? null,
              plannedWork: plannedWorkSets?.length ?? null,
              targetSets,
              warmupSets,
              completedWarmup: completedWarmupCount,
              completedWork: completedForExercise.length - completedWarmupCount,
              extraWork: extraWorkSetsByExercise[exId] ?? 0,
              draftWarmupCount: draftCounts.warmup,
              draftWorkCount: draftCounts.work,
            };
            const { rows, allWorkSetsDone } = computeExerciseRows(rowsArgs);

            // First incomplete row → active.
            const firstIncomplete = rows.findIndex((row) => {
              const c = completedForExercise.filter((s) => s.isWarmup === row.isWarmup)[
                row.index - 1
              ];
              return !c;
            });

            return (
              <Card key={exId}>
                <Row jc="space-between" style={{ marginBottom: 14 }}>
                  <Row gap={10} flex={1}>
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
                      <Feather name="activity" size={16} color={colors.accentEdge} />
                    </View>
                    <Col gap={2} flex={1}>
                      <Text variant="title" numberOfLines={1}>
                        {ex.name}
                      </Text>
                      <Text variant="caption" muted>
                        {targetSets} × {targetReps} · {restSeconds}s
                      </Text>
                    </Col>
                  </Row>
                  <Pressable
                    onPress={() => {
                      if (Platform.OS !== "web") {
                        Haptics.selectionAsync();
                      }
                      setActionForExId(exId);
                    }}
                    hitSlop={10}
                    style={({ pressed }) => ({
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: pressed ? colors.surfaceAlt : "transparent",
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Feather name="more-horizontal" size={16} color={colors.muted} />
                  </Pressable>
                </Row>

                {/* Header row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingBottom: 8,
                  }}
                >
                  <TermHint term="SET" width={28} />
                  <TermHint term="PREVIO" width={56} />
                  <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                    <TermHint term="KG" flex={1} />
                    <TermHint term="REPS" flex={1} />
                    <TermHint term="RPE" flex={1} />
                  </View>
                  <View style={{ width: 28 }} />
                </View>

                <Col gap={6}>
                  {rows.map((row, i) => {
                    const completedSet = completedForExercise.filter(
                      (s) => s.isWarmup === row.isWarmup,
                    )[row.index - 1];
                    const previous = row.isWarmup ? undefined : lastSets[row.index - 1];
                    const plannedSet = plannedExercise
                      ? (row.isWarmup ? plannedWarmupSets : plannedWorkSets)?.[
                          row.index - 1
                        ]
                      : undefined;
                    // PR estricto: superar el max histórico (no igualar).
                    // Igualar no es récord; la primera vez no lo era.
                    const isPr =
                      !!completedSet &&
                      !completedSet.isWarmup &&
                      exerciseMax > 0 &&
                      completedSet.weight > exerciseMax;
                    const setNotesCount = completedSet
                      ? notes.filter((n) => n.setId === completedSet.id).length
                      : 0;
                    // Autosaved kg/reps/rpe of a not-completed slot (survives
                    // background → kill). A completed set always wins.
                    const draft = drafts?.get(
                      buildDraftKey(exId, row.index, row.isWarmup),
                    );
                    const initialInputs = resolveSetInputs({
                      completed: completedSet,
                      draft,
                      planned: plannedSet,
                      previous,
                      isWarmup: row.isWarmup,
                    });
                    return (
                      <SetRow
                        key={rowKey(exId, row)}
                        index={row.index}
                        isWarmup={row.isWarmup}
                        initialInputs={initialInputs}
                        previousWeight={previous?.weight}
                        previousReps={previous?.reps}
                        plannedWeight={plannedSet?.weight}
                        plannedReps={plannedSet?.reps}
                        completed={!!completedSet}
                        isPr={isPr}
                        isActive={!completedSet && i === firstIncomplete}
                        hasNotes={setNotesCount > 0}
                        onNotePress={
                          completedSet
                            ? () =>
                                setNoteSheet({
                                  setId: completedSet.id,
                                  exerciseId: exId,
                                  contextLabel: `${ex.name} · Set ${row.index}`,
                                })
                            : undefined
                        }
                        onCheckLongPress={
                          completedSet
                            ? () =>
                                setQuickMenu({
                                  setId: completedSet.id,
                                  exerciseId: exId,
                                  setIndex: row.index,
                                })
                            : undefined
                        }
                        onComplete={(w, r, rpe) => {
                          // The rest timer only starts once the set is saved;
                          // a failed save is reported and the draft is kept.
                          return saveSetThenRest({
                            save: () =>
                              logSet(session.id, {
                                exerciseId: exId,
                                weight: w,
                                reps: r,
                                rpe,
                                isWarmup: row.isWarmup,
                                setIndex: row.index,
                              }),
                            isWarmup: row.isWarmup,
                            startRest: () => startRest(restSeconds),
                            inFlight: savingSetsRef.current,
                            key: `${exId}:${row.isWarmup}:${row.index}`,
                          }).then((res) => {
                            if (res.ok) return true;
                            if ("skipped" in res) return true;
                            console.warn("[active] logSet failed:", res.error);
                            showAlert("No se pudo guardar el set", errorDetail(res.error));
                            return false;
                          });
                        }}
                        onDraftChange={(patch) => {
                          if (sessionEndedRef.current) return;
                          // Fire-and-forget: a failed autosave must never
                          // surface as an unhandled rejection.
                          upsertSessionSetDraft(
                            {
                              sessionId: session.id,
                              exerciseId: exId,
                              setIndex: row.index,
                              isWarmup: row.isWarmup,
                            },
                            patch,
                          ).catch((e) => {
                            console.warn("[active] draft autosave failed:", e);
                          });
                        }}
                        onUncomplete={() => {
                          if (completedSet) removeSetOrAlert(completedSet.id);
                        }}
                        onRemove={() => {
                          if (completedSet) {
                            showAlert("Eliminar set", "¿Borrar este set?", [
                              { text: "Cancelar", style: "cancel" },
                              {
                                text: "Eliminar",
                                style: "destructive",
                                onPress: () => removeSetOrAlert(completedSet.id),
                              },
                            ]);
                          }
                        }}
                      />
                    );
                  })}
                </Col>

                {allWorkSetsDone ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Finalizar serie de ${ex.name}`}
                    style={({ pressed }) => ({
                      marginTop: 12,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: colors.accent,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      opacity: pressed ? 0.85 : 1,
                    })}
                    onPress={() => handleFinishSet(exId)}
                  >
                    <Feather name="check-circle" size={16} color={colors.accentInk} />
                    <Text variant="label" weight="semibold" color={colors.accentInk}>
                      Finalizar serie
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Añadir set a ${ex.name}`}
                  style={({ pressed }) => ({
                    marginTop: 10,
                    height: 38,
                    borderRadius: 10,
                    borderStyle: "dashed",
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    opacity: pressed ? 0.6 : 1,
                  })}
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.selectionAsync();
                    }
                    setExtraWorkSetsByExercise((prev) => ({
                      ...prev,
                      [exId]: nextExtraWork(rowsArgs),
                    }));
                  }}
                >
                  <Feather name="plus" size={12} color={colors.muted} />
                  <Text variant="label" color={colors.muted}>
                    Añadir set
                  </Text>
                </Pressable>
              </Card>
            );
          })
            : null}
        </Col>

        <Button
          label="Añadir ejercicio"
          variant="outline"
          icon="plus"
          fullWidth
          onPress={handleAddExercise}
          style={{ marginTop: 14 }}
        />
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: Math.max(insets.bottom, 16) + 6,
          left: 16,
          right: 16,
        }}
      >
        <Button
          label="Terminar sesión"
          icon="check"
          size="lg"
          variant="dark"
          fullWidth
          onPress={handleFinish}
        />
      </View>

      {(() => {
        if (!actionForExId) return null;
        const idx = session.exerciseOrder.indexOf(actionForExId);
        if (idx === -1) return null;
        const ex = getExerciseById(actionForExId);
        if (!ex) return null;
        const hasLoggedSets = session.sets.some((s) => s.exerciseId === actionForExId);
        const isSkipped = skippedSet.has(actionForExId);
        return (
          <ExerciseActionSheet
            visible
            onClose={() => setActionForExId(null)}
            exerciseName={ex.name}
            index={idx}
            total={session.exerciseOrder.length}
            isSkipped={isSkipped}
            hasLoggedSets={hasLoggedSets}
            onMoveUp={() => reorderSessionExercises(session.id, idx, idx - 1)}
            onMoveDown={() => reorderSessionExercises(session.id, idx, idx + 1)}
            onReplace={() => {
              router.push(
                `/exercises?replaceSessionId=${session.id}&replaceExerciseId=${actionForExId}` as never,
              );
            }}
            onToggleSkip={() => {
              setSessionExerciseSkipped(session.id, actionForExId, !isSkipped);
            }}
            onRemove={() => {
              const exName = ex.name;
              const setsCount = session.sets.filter(
                (s) => s.exerciseId === actionForExId,
              ).length;
              showAlert(
                `Quitar ${exName}`,
                setsCount > 0
                  ? `Tiene ${setsCount} ${setsCount === 1 ? "set logueado" : "sets logueados"} que se van a borrar. La rutina original no cambia.`
                  : "Sale de esta sesión. La rutina original no cambia.",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Quitar",
                    style: "destructive",
                    onPress: () => removeSessionExercise(session.id, actionForExId),
                  },
                ],
              );
            }}
          />
        );
      })()}

      {/* NoteSheet — captura/edición detallada de notas. */}
      <NoteSheet
        visible={noteSheet != null}
        onClose={() => setNoteSheet(null)}
        sessionId={session.id}
        setId={noteSheet?.setId}
        exerciseId={noteSheet?.exerciseId ?? ""}
        contextLabel={noteSheet?.contextLabel}
        existingNotes={
          noteSheet?.setId
            ? notes.filter((n) => n.setId === noteSheet.setId)
            : undefined
        }
      />

      {/* QuickNoteMenu — long-press en check del set abre menú de chips frecuentes. */}
      <QuickNoteMenu
        visible={quickMenu != null}
        onClose={() => setQuickMenu(null)}
        sessionId={session.id}
        setId={quickMenu?.setId}
        exerciseId={quickMenu?.exerciseId ?? ""}
        setIndex={quickMenu?.setIndex ?? 0}
        onMoreOptions={() => {
          const ex = quickMenu ? getExerciseById(quickMenu.exerciseId) : null;
          if (quickMenu && ex) {
            setNoteSheet({
              setId: quickMenu.setId,
              exerciseId: quickMenu.exerciseId,
              contextLabel: `${ex.name} · Set ${quickMenu.setIndex}`,
            });
          }
          setQuickMenu(null);
        }}
      />
    </Screen>
  );
}

function SummaryCol({ label, value }: { label: string; value: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <Col gap={4} ai="center" flex={1}>
      <Text variant="tiny" color={colors.muted}>
        {label}
      </Text>
      {typeof value === "string" ? (
        <Text variant="mono" color={colors.ink} style={{ fontSize: 18, fontWeight: "600" }}>
          {value}
        </Text>
      ) : (
        value
      )}
    </Col>
  );
}
