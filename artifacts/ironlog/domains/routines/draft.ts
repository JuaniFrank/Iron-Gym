import type { Routine } from "@/types";
import { uid } from "@/utils/id";

/**
 * In-memory routine draft (ironlog-routine-draft-editor T1).
 *
 * Pure model: no DB access. The routine screen edits a draft through
 * `draftReducer` and only `saveRoutineDraft` (mutators.ts) touches SQLite.
 * Array order IS the position: `days[i]` / `exercises[i]` persist at
 * position `i`.
 */

export type RoutineGoal = NonNullable<Routine["goal"]>;

export interface ExerciseDraft {
  /** Client-generated id; becomes the `routine_exercises.id` on save. */
  id: string;
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  warmupSets: number;
  restSeconds: number;
  notes: string | null;
  /** Id of the partner `ExerciseDraft` (same day), or null. */
  supersetWith: string | null;
}

export interface DayDraft {
  id: string;
  name: string;
  exercises: ExerciseDraft[];
}

export interface RoutineDraft {
  id: string;
  name: string;
  description?: string;
  goal?: RoutineGoal;
  days: DayDraft[];
}

export type ExercisePatch = Partial<Omit<ExerciseDraft, "id">>;

export type DraftAction =
  | { type: "setName"; name: string }
  | { type: "setDescription"; description: string | undefined }
  | { type: "setGoal"; goal: RoutineGoal | undefined }
  | { type: "addDay"; id: string; name?: string }
  | { type: "renameDay"; dayId: string; name: string }
  | { type: "removeDay"; dayId: string }
  | { type: "moveDay"; fromIndex: number; toIndex: number }
  | { type: "addExercise"; dayId: string; id: string; exerciseId: string }
  | { type: "removeExercise"; dayId: string; id: string }
  | { type: "updateExercise"; dayId: string; id: string; patch: ExercisePatch }
  | { type: "moveExercise"; dayId: string; fromIndex: number; toIndex: number }
  | { type: "toggleSuperset"; dayId: string; id: string; withId: string | null };

export const DEFAULT_TARGET_SETS = 3;
export const DEFAULT_TARGET_REPS = 10;
export const DEFAULT_WARMUP_SETS = 0;
export const DEFAULT_REST_SECONDS = 90;

export function emptyDraft(): RoutineDraft {
  return {
    id: uid(),
    name: "",
    days: [{ id: uid(), name: "Día 1", exercises: [] }],
  };
}

/** Build a draft from the tree shape the routine queries return. */
export function draftFromRoutine(routine: Routine): RoutineDraft {
  return {
    id: routine.id,
    name: routine.name,
    description: routine.description,
    goal: routine.goal,
    days: routine.days.map((day) => ({
      id: day.id,
      name: day.name,
      exercises: day.exercises.map((ex) => ({
        id: ex.id,
        exerciseId: ex.exerciseId,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        warmupSets: ex.warmupSets,
        restSeconds: ex.restSeconds,
        notes: ex.notes ?? null,
        supersetWith: ex.supersetWith ?? null,
      })),
    })),
  };
}

/**
 * New draft prefilled from an existing routine (preset "use as template").
 * Every id is fresh, `supersetWith` is remapped, the name gets the same
 * " (copia)" suffix `cloneRoutine` uses. Pair with `original = null`.
 */
export function draftFromTemplate(routine: Routine): RoutineDraft {
  const source = draftFromRoutine(routine);
  const idMap = new Map<string, string>();
  for (const day of source.days) {
    for (const ex of day.exercises) idMap.set(ex.id, uid());
  }
  return {
    id: uid(),
    name: `${source.name} (copia)`,
    description: source.description,
    goal: source.goal,
    days: source.days.map((day) => ({
      id: uid(),
      name: day.name,
      exercises: day.exercises.map((ex) => ({
        ...ex,
        id: idMap.get(ex.id)!,
        supersetWith: ex.supersetWith ? (idMap.get(ex.supersetWith) ?? null) : null,
      })),
    })),
  };
}

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to) return items.slice();
  if (from < 0 || from >= items.length) return items.slice();
  if (to < 0 || to >= items.length) return items.slice();
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function mapDay(
  draft: RoutineDraft,
  dayId: string,
  fn: (day: DayDraft) => DayDraft,
): RoutineDraft {
  return {
    ...draft,
    days: draft.days.map((d) => (d.id === dayId ? fn(d) : d)),
  };
}

export function draftReducer(
  draft: RoutineDraft,
  action: DraftAction,
): RoutineDraft {
  switch (action.type) {
    case "setName":
      return { ...draft, name: action.name };
    case "setDescription":
      return { ...draft, description: action.description };
    case "setGoal":
      return { ...draft, goal: action.goal };
    case "addDay":
      return {
        ...draft,
        days: [
          ...draft.days,
          {
            id: action.id,
            name: action.name ?? `Día ${draft.days.length + 1}`,
            exercises: [],
          },
        ],
      };
    case "renameDay":
      return mapDay(draft, action.dayId, (d) => ({ ...d, name: action.name }));
    case "removeDay":
      // A routine always keeps at least one day (same rule the UI enforces).
      if (draft.days.length <= 1) return draft;
      return { ...draft, days: draft.days.filter((d) => d.id !== action.dayId) };
    case "moveDay":
      return { ...draft, days: moveItem(draft.days, action.fromIndex, action.toIndex) };
    case "addExercise":
      return mapDay(draft, action.dayId, (d) => ({
        ...d,
        exercises: [
          ...d.exercises,
          {
            id: action.id,
            exerciseId: action.exerciseId,
            targetSets: DEFAULT_TARGET_SETS,
            targetReps: DEFAULT_TARGET_REPS,
            warmupSets: DEFAULT_WARMUP_SETS,
            restSeconds: DEFAULT_REST_SECONDS,
            notes: null,
            supersetWith: null,
          },
        ],
      }));
    case "removeExercise":
      // Mirrors `removeRoutineExercise`: drop the row and clear any
      // superset reference that pointed at it.
      return mapDay(draft, action.dayId, (d) => ({
        ...d,
        exercises: d.exercises
          .filter((e) => e.id !== action.id)
          .map((e) => (e.supersetWith === action.id ? { ...e, supersetWith: null } : e)),
      }));
    case "updateExercise":
      return mapDay(draft, action.dayId, (d) => ({
        ...d,
        exercises: d.exercises.map((e) =>
          e.id === action.id ? { ...e, ...action.patch } : e,
        ),
      }));
    case "moveExercise":
      return mapDay(draft, action.dayId, (d) => ({
        ...d,
        exercises: moveItem(d.exercises, action.fromIndex, action.toIndex),
      }));
    case "toggleSuperset":
      // Mirrors `toggleSuperset`: linking is symmetric, `withId = null`
      // clears this exercise's link and its previous partner's link.
      return mapDay(draft, action.dayId, (d) => {
        if (action.withId == null) {
          const current = d.exercises.find((e) => e.id === action.id);
          const partnerId = current?.supersetWith ?? null;
          return {
            ...d,
            exercises: d.exercises.map((e) =>
              e.id === action.id || (partnerId !== null && e.id === partnerId)
                ? { ...e, supersetWith: null }
                : e,
            ),
          };
        }
        const withId = action.withId;
        return {
          ...d,
          exercises: d.exercises.map((e) => {
            if (e.id === action.id) return { ...e, supersetWith: withId };
            if (e.id === withId) return { ...e, supersetWith: action.id };
            return e;
          }),
        };
      });
    default:
      return draft;
  }
}

// ---------------------------------------------------------------------------
// Dirty tracking
// ---------------------------------------------------------------------------

/** Canonical form: optional fields collapsed so `undefined` equals `null`. */
function canonical(draft: RoutineDraft): string {
  return JSON.stringify([
    draft.id,
    draft.name,
    draft.description ?? null,
    draft.goal ?? null,
    draft.days.map((d) => [
      d.id,
      d.name,
      d.exercises.map((e) => [
        e.id,
        e.exerciseId,
        e.targetSets,
        e.targetReps,
        e.warmupSets,
        e.restSeconds,
        e.notes ?? null,
        e.supersetWith ?? null,
      ]),
    ]),
  ]);
}

/**
 * Structural comparison against the last saved state. `original = null`
 * (new routine) is dirty as soon as the user typed a name or added any
 * exercise, or renamed/added days beyond the initial empty draft.
 */
export function isDirty(draft: RoutineDraft, original: RoutineDraft | null): boolean {
  if (original === null) {
    return (
      draft.name.trim() !== "" ||
      !!draft.description?.trim() ||
      draft.goal !== undefined ||
      draft.days.length !== 1 ||
      draft.days[0].name !== "Día 1" ||
      draft.days[0].exercises.length > 0
    );
  }
  return canonical(draft) !== canonical(original);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface DraftErrors {
  name?: string;
  description?: string;
  days?: string;
  /** dayId -> message */
  dayNames?: Record<string, string>;
  /** exercise row id -> message */
  exercises?: Record<string, string>;
}

export type DraftValidation = { ok: true } | { ok: false; errors: DraftErrors };

function intInRange(v: number, min: number, max: number): boolean {
  return Number.isInteger(v) && v >= min && v <= max;
}

export function validateDraft(draft: RoutineDraft): DraftValidation {
  const errors: DraftErrors = {};
  const name = draft.name.trim();
  if (name.length < 1) errors.name = "Escribe un nombre para la rutina";
  else if (name.length > 200) errors.name = "El nombre es demasiado largo";
  if (draft.description !== undefined && draft.description.length > 2000) {
    errors.description = "La descripción es demasiado larga";
  }

  if (draft.days.length < 1) errors.days = "La rutina necesita al menos un día";

  for (const day of draft.days) {
    const dayName = day.name.trim();
    if (dayName.length < 1 || dayName.length > 200) {
      (errors.dayNames ??= {})[day.id] = "Nombre de día no válido";
    }
    for (const ex of day.exercises) {
      const valid =
        ex.exerciseId.length > 0 &&
        intInRange(ex.targetSets, 1, 20) &&
        intInRange(ex.targetReps, 1, 100) &&
        intInRange(ex.warmupSets, 0, 10) &&
        intInRange(ex.restSeconds, 0, 900);
      if (!valid) (errors.exercises ??= {})[ex.id] = "Valores de ejercicio no válidos";
    }
  }

  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };
}

// ---------------------------------------------------------------------------
// Screen helpers (pure so they can be unit tested without React)
// ---------------------------------------------------------------------------

export function saveButtonLabel(original: RoutineDraft | null): string {
  return original === null ? "Guardar rutina" : "Guardar cambios";
}

export function canSaveDraft(
  draft: RoutineDraft,
  original: RoutineDraft | null,
  saving: boolean,
): boolean {
  return !saving && isDirty(draft, original);
}

/** Leaving discards the draft, so ask unless it is clean or was just saved. */
export function shouldPromptOnLeave(
  draft: RoutineDraft,
  original: RoutineDraft | null,
  justSaved: boolean,
): boolean {
  return !justSaved && isDirty(draft, original);
}
