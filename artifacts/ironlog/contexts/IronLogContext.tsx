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
  Exercise,
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
  UserProfile,
  WorkoutSession,
} from "@/types";
import { dateKey, getDayOfWeek, startOfDay } from "@/utils/date";
import { uid } from "@/utils/id";

const STORAGE_KEY = "ironlog:v1";

interface PersistedState {
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
  achievements: AchievementUnlock[];
  profile: UserProfile;
  activeWorkoutId: string | null;
  defaultRestSeconds: number;
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
  achievements: [],
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
  // Profile
  updateProfile: (patch: Partial<UserProfile>) => void;
  // Helpers
  getExerciseById: (id: string) => Exercise | undefined;
  getFoodById: (id: string) => FoodItem | undefined;
  getRoutineById: (id: string) => Routine | undefined;
  getActiveSession: () => WorkoutSession | null;
  getLastSetsForExercise: (exerciseId: string, beforeSessionId?: string) => CompletedSet[];
  getMaxWeightForExercise: (exerciseId: string) => number;
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
          setState({ ...DEFAULT_STATE, ...parsed, profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) } });
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
    (exerciseId: string): number => {
      let max = 0;
      for (const session of state.sessions) {
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

  const finishWorkout = useCallback(
    (sessionId: string, notes?: string) => {
      let resultSession: WorkoutSession | null = null;
      let prs: PRRecord[] = [];
      const newAchievements: string[] = [];
      update((prev) => {
        const session = prev.sessions.find((s) => s.id === sessionId);
        if (!session) return prev;
        // PR detection
        const detectedPrs: PRRecord[] = [];
        for (const exId of session.exerciseOrder) {
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
          .filter((s) => !s.isWarmup)
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
      updateProfile,
      getExerciseById,
      getFoodById,
      getRoutineById,
      getActiveSession,
      getLastSetsForExercise,
      getMaxWeightForExercise,
      getStreak,
      resetAll,
    ],
  );

  return <IronLogContext.Provider value={value}>{children}</IronLogContext.Provider>;
}

export function useIronLog(): IronLogContextValue {
  const ctx = useContext(IronLogContext);
  if (!ctx) throw new Error("useIronLog must be used inside IronLogProvider");
  return ctx;
}
