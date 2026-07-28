import type { NoteCategory } from "@/types";

/**
 * Chips default por categoría — punto de partida para la captura rápida de
 * notas. Se combinan con chips evolutivos del usuario (cf. D-15) en el
 * helper `frequentChips()` de `utils/notes.ts`.
 *
 * Mantener bajo en cantidad (3–5 por categoría) para no abrumar el sheet.
 */
export const DEFAULT_CHIPS: Record<NoteCategory, string[]> = {
  pain: ["leve", "molesta", "fuerte"],
  effort: ["fácil", "duro", "RPE alto", "perdí tensión"],
  technique: [
    "form rota",
    "buena ejecución",
    "rom completo",
    "agarre cambiado",
  ],
  equipment: [
    "barra olímpica",
    "discos viejos",
    "rack chico",
    "sin spotter",
  ],
  energy: ["dormí mal", "ayuno", "post-cardio", "stress laboral", "viaje"],
  mood: ["motivado", "sin ganas", "concentrado", "distraído"],
  other: [],
};

/**
 * Labels en español argentino para mostrar la categoría en UI.
 */
export const CATEGORY_LABEL: Record<NoteCategory, string> = {
  pain: "Dolor / molestia",
  effort: "Esfuerzo",
  technique: "Técnica",
  equipment: "Equipamiento",
  energy: "Energía",
  mood: "Ánimo",
  other: "Otro",
};

/**
 * Ícono Feather por categoría — para el NoteCard y selectores.
 */
export const CATEGORY_ICON: Record<
  NoteCategory,
  | "alert-triangle"
  | "activity"
  | "tool"
  | "package"
  | "battery"
  | "smile"
  | "message-circle"
> = {
  pain: "alert-triangle",
  effort: "activity",
  technique: "tool",
  equipment: "package",
  energy: "battery",
  mood: "smile",
  other: "message-circle",
};
