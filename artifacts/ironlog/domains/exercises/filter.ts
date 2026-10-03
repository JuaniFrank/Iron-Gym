import type { Exercise, ExerciseType, MuscleGroup } from "@/types";

export type ExerciseFilters = {
  muscles: MuscleGroup[];
  types: ExerciseType[];
  search: string;
};

/** Lowercase, trim and strip diacritics so "jalon" matches "Jalón". */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Returns a new list with `value` added, or removed when already present. */
export function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function hasActiveFilters(filters: ExerciseFilters): boolean {
  return (
    filters.muscles.length > 0 ||
    filters.types.length > 0 ||
    normalizeText(filters.search) !== ""
  );
}

export function filterExercises(exercises: Exercise[], filters: ExerciseFilters): Exercise[] {
  const tokens = normalizeText(filters.search).split(/\s+/).filter(Boolean);
  return exercises.filter((e) => {
    if (filters.muscles.length > 0 && !filters.muscles.includes(e.primaryMuscle)) return false;
    if (filters.types.length > 0 && !filters.types.includes(e.type)) return false;
    if (tokens.length === 0) return true;
    const name = normalizeText(e.name);
    return tokens.every((t) => name.includes(t));
  });
}
