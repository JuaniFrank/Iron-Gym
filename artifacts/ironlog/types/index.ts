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
  /** Estado de descubrimiento progresivo de features (cf. D-11). */
  featureDiscoveries?: FeatureDiscoveryState[];
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

/**
 * Pre-defined values for one set, before the user actually performs it.
 * Any field can be omitted: the user may want to plan only reps but leave
 * the weight to feel out, etc.
 */
export interface PlannedSet {
  weight?: number;
  reps?: number;
  rpe?: number;
  isWarmup: boolean;
}

export interface PlannedExercise {
  exerciseId: string;
  sets: PlannedSet[];
  notes?: string;
}

/**
 * A pre-defined plan for a specific calendar date and routine day. When a
 * workout starts and a matching plan exists, its values pre-fill the
 * `SetRow` inputs in the active screen.
 *
 * Keyed by `dateKey + routineId + routineDayId` — a single date can have
 * at most one plan (matching its resolved schedule). DB shape:
 * `session_plans(date_key TEXT, routine_id TEXT, routine_day_id TEXT,
 *  exercises JSONB, updated_at, PRIMARY KEY(date_key))`.
 */
export interface SessionPlan {
  dateKey: string;
  routineId: string;
  routineDayId: string;
  exercises: PlannedExercise[];
  updatedAt: number;
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

// ---------------------------------------------------------------------------
// Sistema de notas estructuradas (cf. notes-system.md)

export type NoteCategory =
  | "pain"
  | "effort"
  | "technique"
  | "equipment"
  | "energy"
  | "mood"
  | "other";

/** Enum cerrado de zonas corporales (cf. D-13). 17 zonas mínimas en v1.
 *  Texto libre va en `text`; expansiones futuras son additive. */
export type BodyPart =
  | "shoulder_left"
  | "shoulder_right"
  | "elbow_left"
  | "elbow_right"
  | "wrist_left"
  | "wrist_right"
  | "neck"
  | "upper_back"
  | "lower_back"
  | "chest"
  | "abs"
  | "hip_left"
  | "hip_right"
  | "knee_left"
  | "knee_right"
  | "ankle_left"
  | "ankle_right";

export type NoteSource = "chip" | "text" | "voice" | "recap" | "preflight";

/**
 * Una nota estructurada asociada a una sesión (y opcionalmente a un set o
 * ejercicio). Cf. `notes-system.md` §5 para el contrato completo.
 */
export interface SessionNote {
  id: string;
  sessionId: string;
  setId?: string;
  exerciseId?: string;
  createdAt: number;
  category: NoteCategory;
  bodyPart?: BodyPart;
  /** 1–10. Stored crudo. UI lo traduce por categoría (cf. D-19). */
  severity?: number;
  resolved?: boolean;
  resolvedAt?: number;
  text: string;
  source: NoteSource;
  /** Solo cuando source === "voice". Path en FileSystem.documentDirectory. */
  audioUri?: string;
}

// ---------------------------------------------------------------------------
// Feature discovery (cf. feature-discovery.md, D-11/D-12)

export type DiscoveryTrigger =
  | { kind: "sessions_completed"; count: number }
  | { kind: "notes_count"; count: number }
  | { kind: "pain_notes_count"; count: number }
  | { kind: "exercise_count"; count: number }
  | { kind: "days_since_install"; days: number };

export type DiscoverySurface = "modal" | "banner";

export type DiscoveryStatus =
  | "unseen"
  | "shown"
  | "activated"
  | "dismissed"
  | "snoozed";

export interface FeatureDiscoveryState {
  featureId: string;
  status: DiscoveryStatus;
  shownAt?: number;
  decidedAt?: number;
  snoozeUntil?: number;
}

/** Definición estática de un feature en el catálogo. Hardcoded en código. */
export interface FeatureDiscoveryDef {
  featureId: string;
  title: string;
  tagline: string;
  description: string;
  trigger: DiscoveryTrigger;
  surface: DiscoverySurface;
  /** v1: undefined siempre. v2: "pro" cuando aplique. */
  requiresEntitlement?: string;
  activationRoute?: string;
  settingsKey: string;
}
