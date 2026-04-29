import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ACHIEVEMENTS } from "@/constants/achievements";
import { EXERCISES, getExerciseById as getExerciseFromConstants } from "@/constants/exercises";
import { FOOD_DATABASE } from "@/constants/foods";
import { PRESET_ROUTINES } from "@/constants/presetRoutines";
import type {
  AchievementUnlock,
  BodyMeasurementEntry,
  BodyWeightEntry,
  CompletedSet,
  DiscoveryStatus,
  Exercise,
  FeatureDiscoveryState,
  FitnessGoal,
  FoodEntry,
  FoodItem,
  PRRecord,
  ProgressPhoto,
  ResolvedPlan,
  Routine,
  RoutineDay,
  RoutineExercise,
  ScheduledRoutine,
  ScheduleOverride,
  SessionNote,
  SessionPlan,
  UserProfile,
  WorkoutSession,
} from "@/types";
import { dateKey, getDayOfWeek, startOfDay } from "@/utils/date";
import { uid } from "@/utils/id";

const STORAGE_KEY = "ironlog:v1";

/** Bumpear cuando la forma de PersistedState cambia. `migrate()` se aplica al
 *  hidratar si el blob persistido tiene una versión menor. */
const CURRENT_SCHEMA_VERSION = 2;

interface PersistedState {
  schemaVersion: number;
  customExercises: Exercise[];
  customFoods: FoodItem[];
  routines: Routine[];
  sessions: WorkoutSession[];
  bodyWeights: BodyWeightEntry[];
  measurements: BodyMeasurementEntry[];
  photos: ProgressPhoto[];
  foodEntries: FoodEntry[];
  goals: FitnessGoal[];
  schedule: ScheduledRoutine[];
  scheduleOverrides: ScheduleOverride[];
  sessionPlans: SessionPlan[];
  achievements: AchievementUnlock[];
  notes: SessionNote[];
  profile: UserProfile;
  activeWorkoutId: string | null;
  defaultRestSeconds: number;
}

/** Aplica migraciones encadenadas desde `fromVersion` hasta CURRENT_SCHEMA_VERSION.
 *  Cada step de migración recibe el state parcial y devuelve el state actualizado. */
function migrate(
  state: Partial<PersistedState>,
  fromVersion: number,
): Partial<PersistedState> {
  let cur: Partial<PersistedState> = state;
  let v = fromVersion;
  // v1 → v2: agrega `notes: []` (sistema de notas estructuradas).
  if (v < 2) {
    cur = { ...cur, notes: cur.notes ?? [] };
    v = 2;
  }
  // Futuras migraciones: agregar steps acá.
  return { ...cur, schemaVersion: CURRENT_SCHEMA_VERSION };
}

const DEFAULT_PROFILE: UserProfile = {
  name: "Atleta",
  age: 28,
  weightKg: 75,
  heightCm: 175,
  sex: "male",
  activityLevel: "moderate",
  goal: "muscle",
  units: "metric",
  theme: "system",
  caloriesGoal: 2500,
  proteinGoalG: 150,
  carbsGoalG: 280,
  fatGoalG: 80,
};

const DEFAULT_STATE: PersistedState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  customExercises: [],
  customFoods: [],
  routines: [],
  sessions: [],
  bodyWeights: [],
  measurements: [],
  photos: [],
  foodEntries: [],
  goals: [],
  schedule: [],
  scheduleOverrides: [],
  sessionPlans: [],
  achievements: [],
  notes: [],
  profile: DEFAULT_PROFILE,
  activeWorkoutId: null,
  defaultRestSeconds: 90,
};

interface IronLogContextValue extends PersistedState {
  isLoaded: boolean;
  allExercises: Exercise[];
  allFoods: FoodItem[];
  allRoutines: Routine[];
  // Routines
  createRoutine: (name: string, description?: string) => Routine;
  updateRoutine: (id: string, patch: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  cloneRoutine: (id: string) => Routine | null;
  addRoutineDay: (routineId: string, name: string) => void;
  updateRoutineDay: (routineId: string, dayId: string, patch: Partial<RoutineDay>) => void;
  deleteRoutineDay: (routineId: string, dayId: string) => void;
  addExerciseToDay: (routineId: string, dayId: string, exerciseId: string) => void;
  updateRoutineExercise: (
    routineId: string,
    dayId: string,
    exerciseId: string,
    patch: Partial<RoutineExercise>,
  ) => void;
  removeRoutineExercise: (routineId: string, dayId: string, exerciseId: string) => void;
  toggleSuperset: (routineId: string, dayId: string, exerciseId: string, withId: string | null) => void;
  // Exercises
  createCustomExercise: (e: Omit<Exercise, "id" | "isCustom">) => Exercise;
  // Workout
  startWorkout: (routineId: string, dayId: string) => WorkoutSession;
  startEmptyWorkout: (name?: string) => WorkoutSession;
  logSet: (sessionId: string, set: Omit<CompletedSet, "id" | "completedAt">) => void;
  removeSet: (sessionId: string, setId: string) => void;
  finishWorkout: (sessionId: string, notes?: string) => { session: WorkoutSession; prs: PRRecord[]; newAchievements: string[] };
  cancelWorkout: (sessionId: string) => void;
  addExerciseToActiveWorkout: (sessionId: string, exerciseId: string) => void;
  reorderSessionExercises: (sessionId: string, fromIndex: number, toIndex: number) => void;
  replaceSessionExercise: (sessionId: string, fromExerciseId: string, toExerciseId: string) => void;
  setSessionExerciseSkipped: (sessionId: string, exerciseId: string, skipped: boolean) => void;
  removeSessionExercise: (sessionId: string, exerciseId: string) => void;
  setDefaultRest: (seconds: number) => void;
  // Body
  logBodyWeight: (weightKg: number, date?: number) => void;
  deleteBodyWeight: (id: string) => void;
  logMeasurement: (entry: Omit<BodyMeasurementEntry, "id">) => void;
  deleteMeasurement: (id: string) => void;
  addProgressPhoto: (uri: string, weightKg?: number, notes?: string) => void;
  deleteProgressPhoto: (id: string) => void;
  // Nutrition
  logFood: (entry: Omit<FoodEntry, "id">) => void;
  removeFoodEntry: (id: string) => void;
  createCustomFood: (f: Omit<FoodItem, "id" | "isCustom">) => FoodItem;
  // Goals
  addGoal: (goal: Omit<FitnessGoal, "id" | "createdAt" | "completed">) => void;
  toggleGoal: (id: string) => void;
  deleteGoal: (id: string) => void;
  // Schedule
  scheduleRoutine: (entry: ScheduledRoutine) => void;
  unscheduleDay: (dayOfWeek: number) => void;
  // Per-date overrides (additive on top of weekly schedule)
  getPlanForDate: (timestamp: number) => ResolvedPlan;
  setOverrideForDate: (
    timestamp: number,
    plan: { routineId: string; routineDayId: string } | null,
  ) => void;
  clearOverrideForDate: (timestamp: number) => void;
  swapDates: (timestampA: number, timestampB: number) => void;
  // Pre-defined session plans (per calendar date)
  getSessionPlan: (
    dateKey: string,
    routineId?: string,
    routineDayId?: string,
  ) => SessionPlan | undefined;
  upsertSessionPlan: (plan: Omit<SessionPlan, "updatedAt">) => void;
  deleteSessionPlan: (dateKey: string) => void;
  /** Returns the first training day in the calendar days range
   *  `[startOffsetDays, startOffsetDays + daysAhead)` from today.
   *  Defaults: starts today, scans 14 days. `null` if no training is scheduled. */
  getNextTrainingDay: (
    daysAhead?: number,
    startOffsetDays?: number,
  ) =>
    | {
        timestamp: number;
        dateKey: string;
        routineId: string;
        routineDayId: string;
        isToday: boolean;
      }
    | null;
  // Notes (cf. notes-system.md)
  addNote: (input: Omit<SessionNote, "id" | "createdAt">) => SessionNote;
  updateNote: (id: string, patch: Partial<SessionNote>) => void;
  deleteNote: (id: string) => void;
  resolveNote: (id: string) => void;
  unresolveNote: (id: string) => void;
  clearAllNotes: () => void;
  getNoteById: (id: string) => SessionNote | undefined;
  getNotesForSession: (sessionId: string) => SessionNote[];
  getNotesForSet: (setId: string) => SessionNote[];
  getNotesForExercise: (exerciseId: string) => SessionNote[];
  // Feature discovery (cf. feature-discovery.md)
  setDiscoveryStatus: (
    featureId: string,
    status: DiscoveryStatus,
    extra?: Partial<FeatureDiscoveryState>,
  ) => void;
  snoozeDiscovery: (featureId: string, durationMs?: number) => void;
  resetAllDiscoveries: () => void;
  // Profile
  updateProfile: (patch: Partial<UserProfile>) => void;
  // Helpers
  getExerciseById: (id: string) => Exercise | undefined;
  getFoodById: (id: string) => FoodItem | undefined;
  getRoutineById: (id: string) => Routine | undefined;
  getActiveSession: () => WorkoutSession | null;
  getLastSetsForExercise: (exerciseId: string, beforeSessionId?: string) => CompletedSet[];
  getMaxWeightForExercise: (exerciseId: string, excludeSessionId?: string) => number;
  getStreak: () => number;
  resetAll: () => Promise<void>;
}

const IronLogContext = createContext<IronLogContextValue | null>(null);

export function IronLogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PersistedState>;
          const migrated = migrate(parsed, parsed.schemaVersion ?? 1);
          setState({
            ...DEFAULT_STATE,
            ...migrated,
            profile: { ...DEFAULT_PROFILE, ...(migrated.profile ?? {}) },
          });
        }
      } catch {
        // ignore
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [state, isLoaded]);

  const update = useCallback((updater: (prev: PersistedState) => PersistedState) => {
    setState((prev) => updater(prev));
  }, []);

  const allExercises = useMemo(() => [...EXERCISES, ...state.customExercises], [state.customExercises]);
  const allFoods = useMemo(() => [...FOOD_DATABASE, ...state.customFoods], [state.customFoods]);
  const allRoutines = useMemo(() => [...PRESET_ROUTINES, ...state.routines], [state.routines]);

  const getExerciseById = useCallback(
    (id: string): Exercise | undefined => getExerciseFromConstants(id, state.customExercises),
    [state.customExercises],
  );

  const getFoodById = useCallback(
    (id: string): FoodItem | undefined => allFoods.find((f) => f.id === id),
    [allFoods],
  );

  const getRoutineById = useCallback(
    (id: string): Routine | undefined => allRoutines.find((r) => r.id === id),
    [allRoutines],
  );

  const getActiveSession = useCallback(() => {
    if (!state.activeWorkoutId) return null;
    return state.sessions.find((s) => s.id === state.activeWorkoutId) ?? null;
  }, [state.activeWorkoutId, state.sessions]);

  const getLastSetsForExercise = useCallback(
    (exerciseId: string, beforeSessionId?: string): CompletedSet[] => {
      const sessions = state.sessions
        .filter((s) => s.endedAt && s.id !== beforeSessionId && s.sets.some((set) => set.exerciseId === exerciseId && !set.isWarmup))
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
      const last = sessions[0];
      if (!last) return [];
      return last.sets.filter((s) => s.exerciseId === exerciseId && !s.isWarmup);
    },
    [state.sessions],
  );

  const getMaxWeightForExercise = useCallback(
    (exerciseId: string, excludeSessionId?: string): number => {
      let max = 0;
      for (const session of state.sessions) {
        // Excluir la sesión en curso para que el primer set logueado no se
        // marque como PR contra sí mismo (cf. bug histórico de `>=` vs max
        // que incluía la session actual).
        if (excludeSessionId && session.id === excludeSessionId) continue;
        for (const set of session.sets) {
          if (set.exerciseId === exerciseId && !set.isWarmup && set.weight > max) {
            max = set.weight;
          }
        }
      }
      return max;
    },
    [state.sessions],
  );

  const getStreak = useCallback((): number => {
    const trainedKeys = new Set(
      state.sessions.filter((s) => s.endedAt).map((s) => dateKey(s.endedAt ?? s.startedAt)),
    );
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (trainedKeys.has(dateKey(cursor.getTime()))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [state.sessions]);

  // Routines
  const createRoutine = useCallback((name: string, description?: string): Routine => {
    const r: Routine = {
      id: uid(),
      name,
      description,
      days: [{ id: uid(), name: "Día 1", exercises: [] }],
      createdAt: Date.now(),
    };
    update((prev) => ({ ...prev, routines: [...prev.routines, r] }));
    return r;
  }, [update]);

  const updateRoutine = useCallback((id: string, patch: Partial<Routine>) => {
    update((prev) => ({
      ...prev,
      routines: prev.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }, [update]);

  const deleteRoutine = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      routines: prev.routines.filter((r) => r.id !== id),
      schedule: prev.schedule.filter((s) => s.routineId !== id),
    }));
  }, [update]);

  const cloneRoutine = useCallback(
    (id: string): Routine | null => {
      const original = allRoutines.find((r) => r.id === id);
      if (!original) return null;
      const clone: Routine = {
        ...original,
        id: uid(),
        name: `${original.name} (copia)`,
        isPreset: false,
        createdAt: Date.now(),
        days: original.days.map((d) => ({
          ...d,
          id: uid(),
          exercises: d.exercises.map((e) => ({ ...e, id: uid() })),
        })),
      };
      update((prev) => ({ ...prev, routines: [...prev.routines, clone] }));
      return clone;
    },
    [allRoutines, update],
  );

  const addRoutineDay = useCallback((routineId: string, name: string) => {
    update((prev) => ({
      ...prev,
      routines: prev.routines.map((r) =>
        r.id === routineId
          ? { ...r, days: [...r.days, { id: uid(), name, exercises: [] }] }
          : r,
      ),
    }));
  }, [update]);

  const updateRoutineDay = useCallback(
    (routineId: string, dayId: string, patch: Partial<RoutineDay>) => {
      update((prev) => ({
        ...prev,
        routines: prev.routines.map((r) =>
          r.id === routineId
            ? { ...r, days: r.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)) }
            : r,
        ),
      }));
    },
    [update],
  );

  const deleteRoutineDay = useCallback((routineId: string, dayId: string) => {
    update((prev) => ({
      ...prev,
      routines: prev.routines.map((r) =>
        r.id === routineId ? { ...r, days: r.days.filter((d) => d.id !== dayId) } : r,
      ),
    }));
  }, [update]);

  const addExerciseToDay = useCallback(
    (routineId: string, dayId: string, exerciseId: string) => {
      update((prev) => ({
        ...prev,
        routines: prev.routines.map((r) =>
          r.id === routineId
            ? {
                ...r,
                days: r.days.map((d) =>
                  d.id === dayId
                    ? {
                        ...d,
                        exercises: [
                          ...d.exercises,
                          {
                            id: uid(),
                            exerciseId,
                            targetSets: 3,
                            targetReps: 10,
                            warmupSets: 0,
                            restSeconds: prev.defaultRestSeconds,
                          },
                        ],
                      }
                    : d,
                ),
              }
            : r,
        ),
      }));
    },
    [update],
  );

  const updateRoutineExercise = useCallback(
    (
      routineId: string,
      dayId: string,
      reId: string,
      patch: Partial<RoutineExercise>,
    ) => {
      update((prev) => ({
        ...prev,
        routines: prev.routines.map((r) =>
          r.id === routineId
            ? {
                ...r,
                days: r.days.map((d) =>
                  d.id === dayId
                    ? {
                        ...d,
                        exercises: d.exercises.map((e) =>
                          e.id === reId ? { ...e, ...patch } : e,
                        ),
                      }
                    : d,
                ),
              }
            : r,
        ),
      }));
    },
    [update],
  );

  const removeRoutineExercise = useCallback(
    (routineId: string, dayId: string, reId: string) => {
      update((prev) => ({
        ...prev,
        routines: prev.routines.map((r) =>
          r.id === routineId
            ? {
                ...r,
                days: r.days.map((d) =>
                  d.id === dayId
                    ? {
                        ...d,
                        exercises: d.exercises
                          .filter((e) => e.id !== reId)
                          .map((e) => (e.supersetWith === reId ? { ...e, supersetWith: undefined } : e)),
                      }
                    : d,
                ),
              }
            : r,
        ),
      }));
    },
    [update],
  );

  const toggleSuperset = useCallback(
    (routineId: string, dayId: string, reId: string, withId: string | null) => {
      update((prev) => ({
        ...prev,
        routines: prev.routines.map((r) =>
          r.id === routineId
            ? {
                ...r,
                days: r.days.map((d) =>
                  d.id === dayId
                    ? {
                        ...d,
                        exercises: d.exercises.map((e) =>
                          e.id === reId ? { ...e, supersetWith: withId ?? undefined } : e,
                        ),
                      }
                    : d,
                ),
              }
            : r,
        ),
      }));
    },
    [update],
  );

  const createCustomExercise = useCallback(
    (e: Omit<Exercise, "id" | "isCustom">): Exercise => {
      const ex: Exercise = { ...e, id: uid(), isCustom: true };
      update((prev) => ({ ...prev, customExercises: [...prev.customExercises, ex] }));
      return ex;
    },
    [update],
  );

  // Workout
  const startWorkout = useCallback(
    (routineId: string, dayId: string): WorkoutSession => {
      const routine = allRoutines.find((r) => r.id === routineId);
      const day = routine?.days.find((d) => d.id === dayId);
      const session: WorkoutSession = {
        id: uid(),
        routineId,
        routineDayId: dayId,
        routineName: routine?.name ?? "Sesión",
        dayName: day?.name ?? "Día",
        startedAt: Date.now(),
        sets: [],
        exerciseOrder: day?.exercises.map((e) => e.exerciseId) ?? [],
        totalVolumeKg: 0,
        prsAchieved: [],
      };
      update((prev) => ({
        ...prev,
        sessions: [...prev.sessions, session],
        activeWorkoutId: session.id,
      }));
      return session;
    },
    [allRoutines, update],
  );

  const startEmptyWorkout = useCallback(
    (name = "Sesión libre"): WorkoutSession => {
      const session: WorkoutSession = {
        id: uid(),
        routineName: name,
        dayName: "Libre",
        startedAt: Date.now(),
        sets: [],
        exerciseOrder: [],
        totalVolumeKg: 0,
        prsAchieved: [],
      };
      update((prev) => ({
        ...prev,
        sessions: [...prev.sessions, session],
        activeWorkoutId: session.id,
      }));
      return session;
    },
    [update],
  );

  const logSet = useCallback(
    (sessionId: string, set: Omit<CompletedSet, "id" | "completedAt">) => {
      update((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                sets: [
                  ...s.sets,
                  { ...set, id: uid(), completedAt: Date.now() },
                ],
                exerciseOrder: s.exerciseOrder.includes(set.exerciseId)
                  ? s.exerciseOrder
                  : [...s.exerciseOrder, set.exerciseId],
              }
            : s,
        ),
      }));
    },
    [update],
  );

  const removeSet = useCallback((sessionId: string, setId: string) => {
    update((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === sessionId ? { ...s, sets: s.sets.filter((x) => x.id !== setId) } : s,
      ),
    }));
  }, [update]);

  const addExerciseToActiveWorkout = useCallback(
    (sessionId: string, exerciseId: string) => {
      update((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === sessionId && !s.exerciseOrder.includes(exerciseId)
            ? { ...s, exerciseOrder: [...s.exerciseOrder, exerciseId] }
            : s,
        ),
      }));
    },
    [update],
  );

  const reorderSessionExercises = useCallback(
    (sessionId: string, fromIndex: number, toIndex: number) => {
      update((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          if (fromIndex < 0 || fromIndex >= s.exerciseOrder.length) return s;
          if (toIndex < 0 || toIndex >= s.exerciseOrder.length) return s;
          if (fromIndex === toIndex) return s;
          const newOrder = [...s.exerciseOrder];
          const [moved] = newOrder.splice(fromIndex, 1);
          newOrder.splice(toIndex, 0, moved);
          return { ...s, exerciseOrder: newOrder };
        }),
      }));
    },
    [update],
  );

  /**
   * Replace one exercise with another inside an active session, preserving
   * its position. Sets logged for the old id are *migrated* to the new id so
   * the user keeps weight/reps for the substitute movement (most common case
   * is "machine occupied, swap for an analogue"). Skipped flag is preserved.
   */
  const replaceSessionExercise = useCallback(
    (sessionId: string, fromExerciseId: string, toExerciseId: string) => {
      if (fromExerciseId === toExerciseId) return;
      update((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          // If the new exercise is already in the order somewhere else, keep
          // the substitute at the original position and drop the duplicate.
          const fromIdx = s.exerciseOrder.indexOf(fromExerciseId);
          if (fromIdx === -1) return s;
          const newOrder = s.exerciseOrder
            .filter((x, i) => !(x === toExerciseId && i !== fromIdx))
            .map((x) => (x === fromExerciseId ? toExerciseId : x));
          const newSets = s.sets.map((set) =>
            set.exerciseId === fromExerciseId
              ? { ...set, exerciseId: toExerciseId }
              : set,
          );
          const skipped = s.skippedExerciseIds ?? [];
          const newSkipped = skipped.map((x) =>
            x === fromExerciseId ? toExerciseId : x,
          );
          return {
            ...s,
            exerciseOrder: newOrder,
            sets: newSets,
            skippedExerciseIds: newSkipped,
          };
        }),
      }));
    },
    [update],
  );

  const setSessionExerciseSkipped = useCallback(
    (sessionId: string, exerciseId: string, skipped: boolean) => {
      update((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          const current = new Set(s.skippedExerciseIds ?? []);
          if (skipped) current.add(exerciseId);
          else current.delete(exerciseId);
          return { ...s, skippedExerciseIds: Array.from(current) };
        }),
      }));
    },
    [update],
  );

  const removeSessionExercise = useCallback(
    (sessionId: string, exerciseId: string) => {
      update((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            exerciseOrder: s.exerciseOrder.filter((x) => x !== exerciseId),
            sets: s.sets.filter((set) => set.exerciseId !== exerciseId),
            skippedExerciseIds: (s.skippedExerciseIds ?? []).filter(
              (x) => x !== exerciseId,
            ),
          };
        }),
      }));
    },
    [update],
  );

  const finishWorkout = useCallback(
    (sessionId: string, notes?: string) => {
      let resultSession: WorkoutSession | null = null;
      let prs: PRRecord[] = [];
      const newAchievements: string[] = [];
      update((prev) => {
        const session = prev.sessions.find((s) => s.id === sessionId);
        if (!session) return prev;
        const skipped = new Set(session.skippedExerciseIds ?? []);
        // PR detection
        const detectedPrs: PRRecord[] = [];
        for (const exId of session.exerciseOrder) {
          if (skipped.has(exId)) continue;
          const exercise = getExerciseFromConstants(exId, prev.customExercises);
          if (!exercise) continue;
          const allSetsForEx = prev.sessions
            .filter((s) => s.id !== sessionId && s.endedAt)
            .flatMap((s) => s.sets.filter((x) => x.exerciseId === exId && !x.isWarmup));
          const previousMaxWeight = allSetsForEx.reduce((m, s) => Math.max(m, s.weight), 0);
          const currentMaxWeight = session.sets
            .filter((s) => s.exerciseId === exId && !s.isWarmup)
            .reduce((m, s) => Math.max(m, s.weight), 0);
          if (currentMaxWeight > previousMaxWeight && currentMaxWeight > 0) {
            detectedPrs.push({
              exerciseId: exId,
              exerciseName: exercise.name,
              type: "weight",
              value: currentMaxWeight,
              previousValue: previousMaxWeight,
              achievedAt: Date.now(),
            });
          }
        }
        const totalVolumeKg = session.sets
          .filter((s) => !s.isWarmup && !skipped.has(s.exerciseId))
          .reduce((sum, s) => sum + s.weight * s.reps, 0);
        const finishedSession: WorkoutSession = {
          ...session,
          endedAt: Date.now(),
          notes,
          totalVolumeKg,
          prsAchieved: detectedPrs,
        };
        resultSession = finishedSession;
        prs = detectedPrs;

        // Compute achievements
        const allPrs = [
          ...prev.sessions.flatMap((s) => s.prsAchieved),
          ...detectedPrs,
        ];
        const sessionsWithFinished = prev.sessions.map((s) =>
          s.id === sessionId ? finishedSession : s,
        );
        const trainedKeys = new Set(
          sessionsWithFinished.filter((s) => s.endedAt).map((s) => dateKey(s.endedAt ?? s.startedAt)),
        );
        let streak = 0;
        const cursor = new Date();
        cursor.setHours(0, 0, 0, 0);
        while (trainedKeys.has(dateKey(cursor.getTime()))) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }
        const stateForCheck = {
          sessions: sessionsWithFinished,
          bodyWeights: prev.bodyWeights,
          streak,
          prs: allPrs,
        };
        const alreadyUnlocked = new Set(prev.achievements.map((a) => a.id));
        const newUnlocks: AchievementUnlock[] = [];
        for (const ach of ACHIEVEMENTS) {
          if (alreadyUnlocked.has(ach.id)) continue;
          if (ach.check(stateForCheck)) {
            newUnlocks.push({ id: ach.id, unlockedAt: Date.now() });
            newAchievements.push(ach.id);
          }
        }

        return {
          ...prev,
          sessions: sessionsWithFinished,
          activeWorkoutId: null,
          achievements: [...prev.achievements, ...newUnlocks],
        };
      });
      return { session: resultSession as unknown as WorkoutSession, prs, newAchievements };
    },
    [update],
  );

  const cancelWorkout = useCallback((sessionId: string) => {
    update((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => s.id !== sessionId),
      activeWorkoutId: null,
    }));
  }, [update]);

  const setDefaultRest = useCallback((seconds: number) => {
    update((prev) => ({ ...prev, defaultRestSeconds: seconds }));
  }, [update]);

  // Body
  const logBodyWeight = useCallback((weightKg: number, date?: number) => {
    update((prev) => ({
      ...prev,
      bodyWeights: [
        ...prev.bodyWeights,
        { id: uid(), date: startOfDay(date ?? Date.now()), weightKg },
      ].sort((a, b) => a.date - b.date),
      profile: { ...prev.profile, weightKg },
    }));
  }, [update]);

  const deleteBodyWeight = useCallback((id: string) => {
    update((prev) => ({ ...prev, bodyWeights: prev.bodyWeights.filter((b) => b.id !== id) }));
  }, [update]);

  const logMeasurement = useCallback((entry: Omit<BodyMeasurementEntry, "id">) => {
    update((prev) => ({
      ...prev,
      measurements: [...prev.measurements, { id: uid(), ...entry }].sort(
        (a, b) => a.date - b.date,
      ),
    }));
  }, [update]);

  const deleteMeasurement = useCallback((id: string) => {
    update((prev) => ({ ...prev, measurements: prev.measurements.filter((m) => m.id !== id) }));
  }, [update]);

  const addProgressPhoto = useCallback(
    (uri: string, weightKg?: number, notes?: string) => {
      update((prev) => ({
        ...prev,
        photos: [...prev.photos, { id: uid(), date: Date.now(), uri, weightKg, notes }].sort(
          (a, b) => b.date - a.date,
        ),
      }));
    },
    [update],
  );

  const deleteProgressPhoto = useCallback((id: string) => {
    update((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.id !== id) }));
  }, [update]);

  // Nutrition
  const logFood = useCallback((entry: Omit<FoodEntry, "id">) => {
    update((prev) => ({ ...prev, foodEntries: [...prev.foodEntries, { id: uid(), ...entry }] }));
  }, [update]);

  const removeFoodEntry = useCallback((id: string) => {
    update((prev) => ({ ...prev, foodEntries: prev.foodEntries.filter((e) => e.id !== id) }));
  }, [update]);

  const createCustomFood = useCallback((f: Omit<FoodItem, "id" | "isCustom">): FoodItem => {
    const food: FoodItem = { ...f, id: uid(), isCustom: true };
    update((prev) => ({ ...prev, customFoods: [...prev.customFoods, food] }));
    return food;
  }, [update]);

  // Goals
  const addGoal = useCallback(
    (g: Omit<FitnessGoal, "id" | "createdAt" | "completed">) => {
      update((prev) => ({
        ...prev,
        goals: [...prev.goals, { ...g, id: uid(), createdAt: Date.now(), completed: false }],
      }));
    },
    [update],
  );

  const toggleGoal = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)),
    }));
  }, [update]);

  const deleteGoal = useCallback((id: string) => {
    update((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== id) }));
  }, [update]);

  // Schedule
  const scheduleRoutine = useCallback((entry: ScheduledRoutine) => {
    update((prev) => ({
      ...prev,
      schedule: [
        ...prev.schedule.filter((s) => s.dayOfWeek !== entry.dayOfWeek),
        entry,
      ],
    }));
  }, [update]);

  const unscheduleDay = useCallback((dayOfWeek: number) => {
    update((prev) => ({
      ...prev,
      schedule: prev.schedule.filter((s) => s.dayOfWeek !== dayOfWeek),
    }));
  }, [update]);

  // Per-date overrides (additive layer over weekly schedule).
  // Resolution: override (if present, even if rest) > weekly schedule[dow] > rest.
  const getPlanForDate = useCallback(
    (timestamp: number): ResolvedPlan => {
      const k = dateKey(timestamp);
      const override = state.scheduleOverrides.find((o) => o.dateKey === k);
      if (override) {
        if (override.routineId && override.routineDayId) {
          return {
            kind: "training",
            routineId: override.routineId,
            routineDayId: override.routineDayId,
            isOverride: true,
          };
        }
        return { kind: "rest", isOverride: true };
      }
      const dow = getDayOfWeek(timestamp);
      const sched = state.schedule.find((s) => s.dayOfWeek === dow);
      if (sched) {
        return {
          kind: "training",
          routineId: sched.routineId,
          routineDayId: sched.routineDayId,
          isOverride: false,
        };
      }
      return { kind: "rest", isOverride: false };
    },
    [state.schedule, state.scheduleOverrides],
  );

  const setOverrideForDate = useCallback(
    (
      timestamp: number,
      plan: { routineId: string; routineDayId: string } | null,
    ) => {
      const k = dateKey(timestamp);
      update((prev) => ({
        ...prev,
        scheduleOverrides: [
          ...prev.scheduleOverrides.filter((o) => o.dateKey !== k),
          {
            dateKey: k,
            routineId: plan?.routineId ?? null,
            routineDayId: plan?.routineDayId ?? null,
            createdAt: Date.now(),
          },
        ],
      }));
    },
    [update],
  );

  const clearOverrideForDate = useCallback(
    (timestamp: number) => {
      const k = dateKey(timestamp);
      update((prev) => ({
        ...prev,
        scheduleOverrides: prev.scheduleOverrides.filter((o) => o.dateKey !== k),
      }));
    },
    [update],
  );

  // Swap two dates' resolved plans by writing overrides on both.
  // Resolves each side against the *current* schedule + overrides snapshot inside
  // the updater so the two writes are consistent (no stale read between them).
  const swapDates = useCallback(
    (timestampA: number, timestampB: number) => {
      if (dateKey(timestampA) === dateKey(timestampB)) return;
      update((prev) => {
        const resolve = (ts: number): ResolvedPlan => {
          const k = dateKey(ts);
          const ov = prev.scheduleOverrides.find((o) => o.dateKey === k);
          if (ov) {
            if (ov.routineId && ov.routineDayId) {
              return {
                kind: "training",
                routineId: ov.routineId,
                routineDayId: ov.routineDayId,
                isOverride: true,
              };
            }
            return { kind: "rest", isOverride: true };
          }
          const dow = getDayOfWeek(ts);
          const sched = prev.schedule.find((s) => s.dayOfWeek === dow);
          if (sched) {
            return {
              kind: "training",
              routineId: sched.routineId,
              routineDayId: sched.routineDayId,
              isOverride: false,
            };
          }
          return { kind: "rest", isOverride: false };
        };

        const planA = resolve(timestampA);
        const planB = resolve(timestampB);
        const kA = dateKey(timestampA);
        const kB = dateKey(timestampB);

        const toOverride = (
          k: string,
          p: ResolvedPlan,
        ): ScheduleOverride => ({
          dateKey: k,
          routineId: p.kind === "training" ? p.routineId : null,
          routineDayId: p.kind === "training" ? p.routineDayId : null,
          createdAt: Date.now(),
        });

        const filtered = prev.scheduleOverrides.filter(
          (o) => o.dateKey !== kA && o.dateKey !== kB,
        );

        return {
          ...prev,
          scheduleOverrides: [
            ...filtered,
            toOverride(kA, planB),
            toOverride(kB, planA),
          ],
        };
      });
    },
    [update],
  );

  // Session plans: pre-defined sets/reps/weight per date.
  const getSessionPlan = useCallback(
    (
      dateKey: string,
      routineId?: string,
      routineDayId?: string,
    ): SessionPlan | undefined => {
      const found = state.sessionPlans.find((p) => p.dateKey === dateKey);
      if (!found) return undefined;
      // If caller pinned routine + day, only return when they match — avoids
      // returning a stale plan after the schedule got swapped to a different
      // routine for that date.
      if (routineId && found.routineId !== routineId) return undefined;
      if (routineDayId && found.routineDayId !== routineDayId) return undefined;
      return found;
    },
    [state.sessionPlans],
  );

  const upsertSessionPlan = useCallback(
    (plan: Omit<SessionPlan, "updatedAt">) => {
      update((prev) => ({
        ...prev,
        sessionPlans: [
          ...prev.sessionPlans.filter((p) => p.dateKey !== plan.dateKey),
          { ...plan, updatedAt: Date.now() },
        ],
      }));
    },
    [update],
  );

  const deleteSessionPlan = useCallback(
    (dateKey: string) => {
      update((prev) => ({
        ...prev,
        sessionPlans: prev.sessionPlans.filter((p) => p.dateKey !== dateKey),
      }));
    },
    [update],
  );

  const getNextTrainingDay = useCallback(
    (daysAhead = 14, startOffsetDays = 0) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let i = startOffsetDays; i < startOffsetDays + daysAhead; i++) {
        const cursor = new Date(today);
        cursor.setDate(cursor.getDate() + i);
        const ts = cursor.getTime();
        // Re-implement the resolution inline so we don't depend on
        // `getPlanForDate` (its closure may be stale here).
        const k = dateKey(ts);
        const ov = state.scheduleOverrides.find((o) => o.dateKey === k);
        let routineId: string | null = null;
        let routineDayId: string | null = null;
        if (ov) {
          routineId = ov.routineId;
          routineDayId = ov.routineDayId;
        } else {
          const dow = getDayOfWeek(ts);
          const sched = state.schedule.find((s) => s.dayOfWeek === dow);
          if (sched) {
            routineId = sched.routineId;
            routineDayId = sched.routineDayId;
          }
        }
        if (routineId && routineDayId) {
          return {
            timestamp: ts,
            dateKey: k,
            routineId,
            routineDayId,
            isToday: i === 0,
          };
        }
      }
      return null;
    },
    [state.schedule, state.scheduleOverrides],
  );

  // Notes (cf. notes-system.md)
  const addNote = useCallback(
    (input: Omit<SessionNote, "id" | "createdAt">): SessionNote => {
      const note: SessionNote = {
        ...input,
        id: uid(),
        createdAt: Date.now(),
      };
      // Denormalizar exerciseId si vino setId pero no exerciseId (cf. D-4).
      if (note.setId && !note.exerciseId) {
        for (const session of state.sessions) {
          const set = session.sets.find((s) => s.id === note.setId);
          if (set) {
            note.exerciseId = set.exerciseId;
            break;
          }
        }
      }
      update((prev) => ({ ...prev, notes: [...prev.notes, note] }));
      return note;
    },
    [state.sessions, update],
  );

  const updateNote = useCallback(
    (id: string, patch: Partial<SessionNote>) => {
      update((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      }));
    },
    [update],
  );

  const deleteNote = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        notes: prev.notes.filter((n) => n.id !== id),
      }));
    },
    [update],
  );

  const resolveNote = useCallback(
    (id: string) => {
      const now = Date.now();
      update((prev) => ({
        ...prev,
        notes: prev.notes.map((n) =>
          n.id === id ? { ...n, resolved: true, resolvedAt: now } : n,
        ),
      }));
    },
    [update],
  );

  const unresolveNote = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        notes: prev.notes.map((n) =>
          n.id === id ? { ...n, resolved: false, resolvedAt: undefined } : n,
        ),
      }));
    },
    [update],
  );

  const clearAllNotes = useCallback(() => {
    update((prev) => ({ ...prev, notes: [] }));
  }, [update]);

  const getNoteById = useCallback(
    (id: string) => state.notes.find((n) => n.id === id),
    [state.notes],
  );

  const getNotesForSession = useCallback(
    (sessionId: string) => state.notes.filter((n) => n.sessionId === sessionId),
    [state.notes],
  );

  const getNotesForSet = useCallback(
    (setId: string) => state.notes.filter((n) => n.setId === setId),
    [state.notes],
  );

  const getNotesForExercise = useCallback(
    (exerciseId: string) =>
      state.notes.filter((n) => n.exerciseId === exerciseId),
    [state.notes],
  );

  // Feature discovery (cf. feature-discovery.md)
  const setDiscoveryStatus = useCallback(
    (
      featureId: string,
      status: DiscoveryStatus,
      extra: Partial<FeatureDiscoveryState> = {},
    ) => {
      update((prev) => {
        const existing = prev.profile.featureDiscoveries ?? [];
        const idx = existing.findIndex((d) => d.featureId === featureId);
        const base: FeatureDiscoveryState =
          idx >= 0 ? existing[idx] : { featureId, status: "unseen" };
        const next: FeatureDiscoveryState = {
          ...base,
          status,
          decidedAt: Date.now(),
          ...extra,
        };
        const list = [...existing];
        if (idx >= 0) list[idx] = next;
        else list.push(next);
        return {
          ...prev,
          profile: { ...prev.profile, featureDiscoveries: list },
        };
      });
    },
    [update],
  );

  const snoozeDiscoveryFn = useCallback(
    (featureId: string, durationMs = 7 * 24 * 60 * 60 * 1000) => {
      setDiscoveryStatus(featureId, "snoozed", {
        snoozeUntil: Date.now() + durationMs,
      });
    },
    [setDiscoveryStatus],
  );

  const resetAllDiscoveriesFn = useCallback(() => {
    update((prev) => ({
      ...prev,
      profile: { ...prev.profile, featureDiscoveries: [] },
    }));
  }, [update]);

  // Profile
  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    update((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
  }, [update]);

  const resetAll = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setState(DEFAULT_STATE);
  }, []);

  const value = useMemo<IronLogContextValue>(
    () => ({
      ...state,
      isLoaded,
      allExercises,
      allFoods,
      allRoutines,
      createRoutine,
      updateRoutine,
      deleteRoutine,
      cloneRoutine,
      addRoutineDay,
      updateRoutineDay,
      deleteRoutineDay,
      addExerciseToDay,
      updateRoutineExercise,
      removeRoutineExercise,
      toggleSuperset,
      createCustomExercise,
      startWorkout,
      startEmptyWorkout,
      logSet,
      removeSet,
      finishWorkout,
      cancelWorkout,
      addExerciseToActiveWorkout,
      reorderSessionExercises,
      replaceSessionExercise,
      setSessionExerciseSkipped,
      removeSessionExercise,
      setDefaultRest,
      logBodyWeight,
      deleteBodyWeight,
      logMeasurement,
      deleteMeasurement,
      addProgressPhoto,
      deleteProgressPhoto,
      logFood,
      removeFoodEntry,
      createCustomFood,
      addGoal,
      toggleGoal,
      deleteGoal,
      scheduleRoutine,
      unscheduleDay,
      getPlanForDate,
      setOverrideForDate,
      clearOverrideForDate,
      swapDates,
      getSessionPlan,
      upsertSessionPlan,
      deleteSessionPlan,
      getNextTrainingDay,
      addNote,
      updateNote,
      deleteNote,
      resolveNote,
      unresolveNote,
      clearAllNotes,
      getNoteById,
      getNotesForSession,
      getNotesForSet,
      getNotesForExercise,
      setDiscoveryStatus,
      snoozeDiscovery: snoozeDiscoveryFn,
      resetAllDiscoveries: resetAllDiscoveriesFn,
      updateProfile,
      getExerciseById,
      getFoodById,
      getRoutineById,
      getActiveSession,
      getLastSetsForExercise,
      getMaxWeightForExercise,
      getStreak,
      resetAll,
    }),
    [
      state,
      isLoaded,
      allExercises,
      allFoods,
      allRoutines,
      createRoutine,
      updateRoutine,
      deleteRoutine,
      cloneRoutine,
      addRoutineDay,
      updateRoutineDay,
      deleteRoutineDay,
      addExerciseToDay,
      updateRoutineExercise,
      removeRoutineExercise,
      toggleSuperset,
      createCustomExercise,
      startWorkout,
      startEmptyWorkout,
      logSet,
      removeSet,
      finishWorkout,
      cancelWorkout,
      addExerciseToActiveWorkout,
      reorderSessionExercises,
      replaceSessionExercise,
      setSessionExerciseSkipped,
      removeSessionExercise,
      setDefaultRest,
      logBodyWeight,
      deleteBodyWeight,
      logMeasurement,
      deleteMeasurement,
      addProgressPhoto,
      deleteProgressPhoto,
      logFood,
      removeFoodEntry,
      createCustomFood,
      addGoal,
      toggleGoal,
      deleteGoal,
      scheduleRoutine,
      unscheduleDay,
      getPlanForDate,
      setOverrideForDate,
      clearOverrideForDate,
      swapDates,
      getSessionPlan,
      upsertSessionPlan,
      deleteSessionPlan,
      getNextTrainingDay,
      updateProfile,
      getExerciseById,
      getFoodById,
      getRoutineById,
      getActiveSession,
      getLastSetsForExercise,
      getMaxWeightForExercise,
      getStreak,
      resetAll,
      addNote,
      updateNote,
      deleteNote,
      resolveNote,
      unresolveNote,
      clearAllNotes,
      getNoteById,
      getNotesForSession,
      getNotesForSet,
      getNotesForExercise,
      setDiscoveryStatus,
      snoozeDiscoveryFn,
      resetAllDiscoveriesFn,
    ],
  );

  return <IronLogContext.Provider value={value}>{children}</IronLogContext.Provider>;
}

export function useIronLog(): IronLogContextValue {
  const ctx = useContext(IronLogContext);
  if (!ctx) throw new Error("useIronLog must be used inside IronLogProvider");
  return ctx;
}
