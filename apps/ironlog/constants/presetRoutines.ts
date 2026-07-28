import type { Routine, RoutineExercise } from "@/types";

const re = (
  exerciseId: string,
  targetSets: number,
  targetReps: number,
  warmupSets = 0,
  restSeconds = 120,
): RoutineExercise => ({
  id: `${exerciseId}-${Math.random().toString(36).slice(2, 8)}`,
  exerciseId,
  targetSets,
  targetReps,
  warmupSets,
  restSeconds,
});

export const PRESET_ROUTINES: Routine[] = [
  {
    id: "preset-strength-5x5",
    name: "Fuerza 5x5",
    description: "Programa clásico de fuerza. 3 días alternando entre Día A y Día B.",
    isPreset: true,
    goal: "strength",
    createdAt: 0,
    days: [
      {
        id: "day-A",
        name: "Día A",
        exercises: [
          re("q-1", 5, 5, 2, 180),
          re("chest-1", 5, 5, 2, 180),
          re("back-3", 5, 5, 2, 180),
        ],
      },
      {
        id: "day-B",
        name: "Día B",
        exercises: [
          re("q-1", 5, 5, 2, 180),
          re("sh-1", 5, 5, 2, 180),
          re("back-7", 1, 5, 2, 240),
        ],
      },
    ],
  },
  {
    id: "preset-ppl-hypertrophy",
    name: "Hipertrofia PPL",
    description: "Push / Pull / Legs. 6 días para máxima hipertrofia.",
    isPreset: true,
    goal: "hypertrophy",
    createdAt: 0,
    days: [
      {
        id: "ppl-push",
        name: "Push (Empuje)",
        exercises: [
          re("chest-1", 4, 8, 2, 120),
          re("chest-5", 3, 10, 1, 90),
          re("sh-1", 4, 8, 1, 120),
          re("sh-5", 3, 12, 0, 60),
          re("tri-2", 3, 12, 0, 60),
          re("tri-7", 3, 12, 0, 60),
        ],
      },
      {
        id: "ppl-pull",
        name: "Pull (Tracción)",
        exercises: [
          re("back-1", 4, 8, 1, 120),
          re("back-3", 4, 8, 1, 120),
          re("back-6", 3, 12, 0, 90),
          re("sh-10", 3, 15, 0, 60),
          re("bi-1", 3, 10, 0, 60),
          re("bi-3", 3, 12, 0, 60),
        ],
      },
      {
        id: "ppl-legs",
        name: "Legs (Piernas)",
        exercises: [
          re("q-1", 4, 8, 2, 180),
          re("h-1", 4, 8, 1, 120),
          re("q-3", 3, 12, 0, 90),
          re("h-2", 3, 12, 0, 60),
          re("ca-1", 4, 15, 0, 60),
          re("ab-2", 3, 60, 0, 45),
        ],
      },
    ],
  },
  {
    id: "preset-cutting",
    name: "Definición",
    description: "4 días con foco en mantener músculo durante el déficit calórico. Más volumen, descansos cortos.",
    isPreset: true,
    goal: "cutting",
    createdAt: 0,
    days: [
      {
        id: "cut-upper",
        name: "Tren Superior A",
        exercises: [
          re("chest-1", 3, 10, 1, 75),
          re("back-2", 3, 12, 0, 75),
          re("sh-2", 3, 12, 0, 60),
          re("bi-2", 3, 12, 0, 45),
          re("tri-2", 3, 12, 0, 45),
          re("ab-5", 3, 15, 0, 45),
        ],
      },
      {
        id: "cut-lower",
        name: "Tren Inferior A",
        exercises: [
          re("q-1", 3, 10, 2, 90),
          re("h-1", 3, 10, 1, 90),
          re("q-6", 3, 12, 0, 60),
          re("g-1", 3, 12, 0, 75),
          re("ca-1", 4, 15, 0, 45),
          re("ab-2", 3, 45, 0, 45),
        ],
      },
      {
        id: "cut-upper-b",
        name: "Tren Superior B",
        exercises: [
          re("chest-2", 3, 10, 1, 75),
          re("back-1", 3, 8, 0, 75),
          re("sh-5", 4, 15, 0, 45),
          re("bi-3", 3, 12, 0, 45),
          re("tri-7", 3, 12, 0, 45),
          re("ab-3", 3, 12, 0, 45),
        ],
      },
      {
        id: "cut-lower-b",
        name: "Tren Inferior B",
        exercises: [
          re("g-1", 4, 10, 1, 90),
          re("q-7", 3, 10, 1, 75),
          re("h-2", 3, 12, 0, 60),
          re("h-3", 3, 12, 0, 60),
          re("ca-2", 4, 15, 0, 45),
          re("ab-6", 3, 20, 0, 45),
        ],
      },
    ],
  },
  {
    id: "preset-fullbody-beginner",
    name: "Cuerpo completo (principiante)",
    description: "3 días por semana. Ideal para empezar a entrenar.",
    isPreset: true,
    goal: "beginner",
    createdAt: 0,
    days: [
      {
        id: "fb-1",
        name: "Sesión 1",
        exercises: [
          re("q-8", 3, 10, 1, 120),
          re("chest-12", 3, 10, 1, 90),
          re("back-2", 3, 10, 1, 90),
          re("ab-2", 3, 30, 0, 60),
        ],
      },
      {
        id: "fb-2",
        name: "Sesión 2",
        exercises: [
          re("q-3", 3, 12, 1, 90),
          re("chest-11", 3, 10, 0, 90),
          re("back-6", 3, 10, 1, 90),
          re("sh-5", 3, 12, 0, 60),
        ],
      },
      {
        id: "fb-3",
        name: "Sesión 3",
        exercises: [
          re("h-1", 3, 10, 1, 120),
          re("sh-2", 3, 10, 1, 90),
          re("back-4", 3, 12, 0, 60),
          re("bi-2", 2, 12, 0, 60),
          re("tri-2", 2, 12, 0, 60),
        ],
      },
    ],
  },
];
