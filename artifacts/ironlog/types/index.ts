export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quadriceps"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "abs"
  | "forearms";

export type ExerciseType = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight";

export interface Exercise {
  id: string;
  name: string;
  description: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  type: ExerciseType;
  isCustom?: boolean;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  warmupSets: number;
  supersetWith?: string;
  restSeconds: number;
  notes?: string;
}

export interface RoutineDay {
  id: string;
  name: string;
  exercises: RoutineExercise[];
}

export interface Routine {
  id: string;
  name: string;
  description?: string;
  days: RoutineDay[];
  isPreset?: boolean;
  goal?: "strength" | "hypertrophy" | "cutting" | "beginner";
  createdAt: number;
}

export interface CompletedSet {
  id: string;
  exerciseId: string;
  weight: number;
  reps: number;
  rpe?: number;
  isWarmup: boolean;
  setIndex: number;
  completedAt: number;
}

export interface WorkoutSession {
  id: string;
  routineId?: string;
  routineDayId?: string;
  routineName: string;
  dayName: string;
  startedAt: number;
  endedAt?: number;
  sets: CompletedSet[];
  exerciseOrder: string[];
  /** Subset of exerciseOrder marked as "saltado" in this session.
   *  The exercise stays in the order (so it can be un-skipped) but its sets
   *  don't count for volume / completion. */
  skippedExerciseIds?: string[];
  totalVolumeKg: number;
  prsAchieved: PRRecord[];
  notes?: string;
}

export interface PRRecord {
  exerciseId: string;
  exerciseName: string;
  type: "weight" | "volume" | "reps";
  value: number;
  previousValue?: number;
  achievedAt: number;
}

export interface BodyWeightEntry {
  id: string;
  date: number;
  weightKg: number;
}

export interface BodyMeasurementEntry {
  id: string;
  date: number;
  waist?: number;
  chest?: number;
  hips?: number;
  leftArm?: number;
  rightArm?: number;
  leftThigh?: number;
  rightThigh?: number;
  neck?: number;
  shoulders?: number;
}

export interface ProgressPhoto {
  id: string;
  date: number;
  uri: string;
  weightKg?: number;
  notes?: string;
}

export type MealType = "breakfast" | "lunch" | "snack" | "dinner" | "other";

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  defaultServingG?: number;
  isCustom?: boolean;
}

export interface FoodEntry {
  id: string;
  date: number;
  mealType: MealType;
  foodItemId: string;
  grams: number;
}

export interface VolumeTarget {
  /** Minimum effective volume — sets/week below this don't drive growth. */
  mev: number;
  /** Maximum adaptive volume — typical productive range upper bound. */
  mav: number;
  /** Maximum recoverable volume — exceeding it tends to break recovery. */
  mrv: number;
}

export interface UserProfile {
  name: string;
  age: number;
  weightKg: number;
  heightCm: number;
  sex: "male" | "female";
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "veryActive";
  goal: "lose" | "maintain" | "gain" | "muscle";
  units: "metric" | "imperial";
  theme: "system" | "light" | "dark";
  caloriesGoal?: number;
  proteinGoalG?: number;
  carbsGoalG?: number;
  fatGoalG?: number;
  /** Per-muscle weekly volume targets (sets/week). When undefined, defaults
   *  from `constants/volumeTargets.ts` are used. */
  volumeTargets?: Partial<Record<MuscleGroup, VolumeTarget>>;
}

export interface FitnessGoal {
  id: string;
  title: string;
  description?: string;
  targetDate: number;
  exerciseId?: string;
  targetWeight?: number;
  completed: boolean;
  createdAt: number;
}

export interface ScheduledRoutine {
  dayOfWeek: number;
  routineId: string;
  routineDayId: string;
}

/**
 * Per-date plan override — wins over the weekly `ScheduledRoutine` for that
 * single calendar date. `routineId == null` is an explicit rest override
 * (e.g. user converted a planned training day into rest for one date).
 *
 * Keyed by `dateKey` (YYYY-MM-DD) so it maps cleanly to a future DB table:
 * `schedule_overrides(date_key TEXT PK, routine_id, routine_day_id, created_at)`.
 */
export interface ScheduleOverride {
  dateKey: string;
  routineId: string | null;
  routineDayId: string | null;
  createdAt: number;
}

export type ResolvedPlan =
  | {
      kind: "training";
      routineId: string;
      routineDayId: string;
      isOverride: boolean;
    }
  | { kind: "rest"; isOverride: boolean };

export interface AchievementUnlock {
  id: string;
  unlockedAt: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  check: (state: AppStateForAchievements) => boolean;
}

export interface AppStateForAchievements {
  sessions: WorkoutSession[];
  bodyWeights: BodyWeightEntry[];
  streak: number;
  prs: PRRecord[];
}
