import type {
  BodyPart,
  NoteCategory,
  SessionNote,
  WorkoutSession,
} from "@/types";
import { DEFAULT_CHIPS } from "@/constants/noteChips";

// ---------------------------------------------------------------------------
// Severity bucketing (cf. D-3 + D-19)

export type SeverityBucket3 = "leve" | "molesta" | "fuerte";
export type EffortBucket3 = "fácil" | "medio" | "duro";
export type EnergyBucket3 = "baja" | "media" | "alta";

/** Bucketing canónico de severity 1–10 → 3 niveles. Usado por categorías
 *  que renderizan slider/buckets ("pain", "effort", "energy"). */
export function severityBucket3<L extends string>(
  n: number | undefined,
  labels: [L, L, L],
): L | undefined {
  if (n == null) return undefined;
  const clamped = Math.max(1, Math.min(10, Math.round(n)));
  if (clamped <= 3) return labels[0];
  if (clamped <= 6) return labels[1];
  return labels[2];
}

export function painBucket(n: number | undefined): SeverityBucket3 | undefined {
  return severityBucket3(n, ["leve", "molesta", "fuerte"]);
}

export function effortBucket(n: number | undefined): EffortBucket3 | undefined {
  return severityBucket3(n, ["fácil", "medio", "duro"]);
}

export function energyBucket(n: number | undefined): EnergyBucket3 | undefined {
  return severityBucket3(n, ["baja", "media", "alta"]);
}

/** Mood: 5 emojis mapeados a severity 1/3/5/7/10. */
export const MOOD_EMOJIS = ["😩", "😐", "🙂", "😄", "🔥"] as const;
export const MOOD_VALUES = [1, 3, 5, 7, 10] as const;

export function moodEmoji(n: number | undefined): string | undefined {
  if (n == null) return undefined;
  // Encontrar el índice más cercano.
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < MOOD_VALUES.length; i++) {
    const d = Math.abs(n - MOOD_VALUES[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return MOOD_EMOJIS[best];
}

/** Centro del bucket — qué severity guarda un chip seleccionado. */
export function bucketCenterValue(bucket: 1 | 2 | 3): number {
  if (bucket === 1) return 2; // 1–3 → 2
  if (bucket === 2) return 5; // 4–6 → 5
  return 8; // 7–10 → 8
}

/** Label legible al cargar la nota (para summary/exercise-detail/etc.). */
export function severityToLabel(
  category: NoteCategory,
  severity: number | undefined,
): string | undefined {
  if (severity == null) return undefined;
  switch (category) {
    case "pain":
      return painBucket(severity);
    case "effort":
      return effortBucket(severity);
    case "energy":
      return energyBucket(severity);
    case "mood":
      return moodEmoji(severity);
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Filtros y selectors

export function notesForSession(
  notes: SessionNote[],
  sessionId: string,
): SessionNote[] {
  return notes.filter((n) => n.sessionId === sessionId);
}

export function notesForSet(
  notes: SessionNote[],
  setId: string,
): SessionNote[] {
  return notes.filter((n) => n.setId === setId);
}

export function notesForExercise(
  notes: SessionNote[],
  exerciseId: string,
): SessionNote[] {
  return notes.filter((n) => n.exerciseId === exerciseId);
}

export function activePainNotes(notes: SessionNote[]): SessionNote[] {
  return notes.filter((n) => n.category === "pain" && !n.resolved);
}

export function notesByBodyPart(
  notes: SessionNote[],
  bodyPart: BodyPart,
): SessionNote[] {
  return notes.filter((n) => n.bodyPart === bodyPart);
}

/**
 * Tasa de uso del recap en últimas N sesiones (cf. D-17). Usado para 4.17
 * (smart reminder) y para evaluar engagement.
 */
export function recapCompletionRate(
  sessions: WorkoutSession[],
  notes: SessionNote[],
  windowSize = 10,
): number {
  const recent = sessions
    .filter((s) => s.endedAt != null)
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, windowSize);
  if (recent.length === 0) return 0;
  const withRecap = recent.filter((s) =>
    notes.some((n) => n.sessionId === s.id && n.source === "recap"),
  );
  return withRecap.length / recent.length;
}

/**
 * Si una sesión sigue siendo reabrible para recap (cf. D-16). Ventana 24h
 * desde `endedAt` y sin notas de recap previas.
 */
export function canStillRecap(
  session: WorkoutSession,
  notes: SessionNote[],
  now = Date.now(),
): boolean {
  if (session.endedAt == null) return false;
  if (now - session.endedAt > 24 * 60 * 60 * 1000) return false;
  return !notes.some(
    (n) => n.sessionId === session.id && n.source === "recap",
  );
}

// ---------------------------------------------------------------------------
// Chips evolutivos (D-15)

/**
 * Top chips para una categoría: defaults curados + texto libre que el usuario
 * repitió ≥ 3 veces en últimas 20 sesiones (cf. D-15). Cap a 6.
 */
export function frequentChips(
  notes: SessionNote[],
  sessions: WorkoutSession[],
  category: NoteCategory,
  options: { windowSize?: number; threshold?: number; cap?: number } = {},
): string[] {
  const windowSize = options.windowSize ?? 20;
  const threshold = options.threshold ?? 3;
  const cap = options.cap ?? 6;

  const recentSessions = sessions
    .filter((s) => s.endedAt != null)
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, windowSize)
    .map((s) => s.id);
  const recentSet = new Set(recentSessions);

  const counts = new Map<string, number>();
  for (const note of notes) {
    if (note.category !== category) continue;
    if (!recentSet.has(note.sessionId)) continue;
    const key = note.text.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const evolved = Array.from(counts.entries())
    .filter(([, count]) => count >= threshold)
    .sort(([, a], [, b]) => b - a)
    .map(([text]) => text);

  const defaults = DEFAULT_CHIPS[category];
  const defaultsSet = new Set(defaults.map((d) => d.toLowerCase()));
  const dedupedEvolved = evolved.filter((text) => !defaultsSet.has(text));

  return [...defaults, ...dedupedEvolved].slice(0, cap);
}

// ---------------------------------------------------------------------------
// Parsing de texto a categoría inferida (helper liviano para 4.15 voice)

const PAIN_KEYWORDS = ["dolor", "molesta", "molestia", "tirón", "incomod"];
const EFFORT_KEYWORDS = ["fácil", "facil", "duro", "difícil", "dificil", "RPE"];

/** Best-guess de categoría desde texto libre. Fallback a `other`. */
export function inferCategoryFromText(text: string): NoteCategory {
  const lower = text.toLowerCase();
  if (PAIN_KEYWORDS.some((k) => lower.includes(k))) return "pain";
  if (EFFORT_KEYWORDS.some((k) => lower.includes(k))) return "effort";
  return "other";
}
