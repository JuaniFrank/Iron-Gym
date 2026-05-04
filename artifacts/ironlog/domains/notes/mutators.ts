import { eq, isNull } from "drizzle-orm";
import { completedSets, sessionNotes } from "@workspace/db/schema";
import { z } from "zod";

import { db } from "@/services/db";
import type {
  BodyPart,
  NoteCategory,
  NoteSource,
  SessionNote,
} from "@/types";
import { uid } from "@/utils/id";

const CATEGORIES: readonly NoteCategory[] = [
  "pain",
  "effort",
  "technique",
  "equipment",
  "energy",
  "mood",
  "other",
];

const BODY_PARTS: readonly BodyPart[] = [
  "shoulder_left",
  "shoulder_right",
  "elbow_left",
  "elbow_right",
  "wrist_left",
  "wrist_right",
  "neck",
  "upper_back",
  "lower_back",
  "chest",
  "abs",
  "hip_left",
  "hip_right",
  "knee_left",
  "knee_right",
  "ankle_left",
  "ankle_right",
];

const SOURCES: readonly NoteSource[] = [
  "chip",
  "text",
  "voice",
  "recap",
  "preflight",
];

const NoteInputSchema = z.object({
  sessionId: z.string().min(1),
  setId: z.string().min(1).optional(),
  exerciseId: z.string().min(1).optional(),
  category: z.enum(CATEGORIES as [NoteCategory, ...NoteCategory[]]),
  bodyPart: z
    .enum(BODY_PARTS as [BodyPart, ...BodyPart[]])
    .optional(),
  severity: z.number().int().min(1).max(10).optional(),
  resolved: z.boolean().optional(),
  resolvedAt: z.number().int().optional(),
  text: z.string().min(1),
  source: z.enum(SOURCES as [NoteSource, ...NoteSource[]]),
  audioUri: z.string().min(1).optional(),
});

const NotePatchSchema = NoteInputSchema.partial();

/**
 * Insert a note. Denormalizes `exerciseId` from the linked set when
 * caller passes only `setId` (cf. notes-system.md D-4).
 */
export async function addNote(
  input: Omit<SessionNote, "id" | "createdAt">,
): Promise<SessionNote> {
  const validated = NoteInputSchema.parse(input);
  let exerciseId = validated.exerciseId;
  if (!exerciseId && validated.setId) {
    const setRow = await db
      .select({ exerciseId: completedSets.exerciseId })
      .from(completedSets)
      .where(eq(completedSets.id, validated.setId))
      .get();
    if (setRow) exerciseId = setRow.exerciseId;
  }
  const id = uid();
  const now = new Date();
  await db.insert(sessionNotes).values({
    id,
    sessionId: validated.sessionId,
    setId: validated.setId ?? null,
    exerciseId: exerciseId ?? null,
    createdAt: now,
    category: validated.category,
    bodyPart: validated.bodyPart ?? null,
    severity: validated.severity ?? null,
    resolved: validated.resolved ?? false,
    resolvedAt:
      validated.resolvedAt != null ? new Date(validated.resolvedAt) : null,
    text: validated.text,
    source: validated.source,
    audioUri: validated.audioUri ?? null,
    updatedAt: now,
  });
  return {
    id,
    sessionId: validated.sessionId,
    setId: validated.setId,
    exerciseId,
    createdAt: now.getTime(),
    category: validated.category,
    bodyPart: validated.bodyPart,
    severity: validated.severity,
    resolved: validated.resolved ?? false,
    resolvedAt: validated.resolvedAt,
    text: validated.text,
    source: validated.source,
    audioUri: validated.audioUri,
  };
}

export async function updateNote(
  id: string,
  patch: Partial<SessionNote>,
): Promise<void> {
  const validated = NotePatchSchema.parse(patch);
  if (Object.keys(validated).length === 0) return;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (validated.sessionId !== undefined) updates.sessionId = validated.sessionId;
  if (validated.setId !== undefined) updates.setId = validated.setId ?? null;
  if (validated.exerciseId !== undefined)
    updates.exerciseId = validated.exerciseId ?? null;
  if (validated.category !== undefined) updates.category = validated.category;
  if (validated.bodyPart !== undefined)
    updates.bodyPart = validated.bodyPart ?? null;
  if (validated.severity !== undefined)
    updates.severity = validated.severity ?? null;
  if (validated.resolved !== undefined) updates.resolved = validated.resolved;
  if (validated.resolvedAt !== undefined)
    updates.resolvedAt =
      validated.resolvedAt != null ? new Date(validated.resolvedAt) : null;
  if (validated.text !== undefined) updates.text = validated.text;
  if (validated.source !== undefined) updates.source = validated.source;
  if (validated.audioUri !== undefined)
    updates.audioUri = validated.audioUri ?? null;
  await db.update(sessionNotes).set(updates).where(eq(sessionNotes.id, id));
}

export async function deleteNote(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(sessionNotes)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(sessionNotes.id, id));
}

export async function resolveNote(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(sessionNotes)
    .set({ resolved: true, resolvedAt: now, updatedAt: now })
    .where(eq(sessionNotes.id, id));
}

export async function unresolveNote(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(sessionNotes)
    .set({ resolved: false, resolvedAt: null, updatedAt: now })
    .where(eq(sessionNotes.id, id));
}

/**
 * Soft-delete every non-deleted note. Used by the "Clear notes" action in
 * settings — preserved as soft delete so future audits / sync can detect
 * the bulk clear.
 */
export async function clearAllNotes(): Promise<void> {
  const now = new Date();
  await db
    .update(sessionNotes)
    .set({ deletedAt: now, updatedAt: now })
    .where(isNull(sessionNotes.deletedAt));
}
