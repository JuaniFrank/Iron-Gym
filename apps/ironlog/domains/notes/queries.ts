import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { sessionNotes } from "@workspace/db/schema";
import { useMemo } from "react";

import { db } from "@/services/db";
import type { SessionNote } from "@/types";

function rowToNote(row: typeof sessionNotes.$inferSelect): SessionNote {
  return {
    id: row.id,
    sessionId: row.sessionId,
    setId: row.setId ?? undefined,
    exerciseId: row.exerciseId ?? undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
    category: row.category,
    bodyPart: row.bodyPart ?? undefined,
    severity: row.severity ?? undefined,
    resolved: row.resolved,
    resolvedAt:
      row.resolvedAt instanceof Date
        ? row.resolvedAt.getTime()
        : row.resolvedAt ?? undefined,
    text: row.text,
    source: row.source,
    audioUri: row.audioUri ?? undefined,
  };
}

/**
 * All non-deleted notes, ordered by `createdAt ASC` to preserve the legacy
 * insertion order seen across the UI (recap iterates by index, lists are
 * commonly re-sorted at consumption time).
 */
export function useAllNotes(): SessionNote[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(sessionNotes)
      .where(isNull(sessionNotes.deletedAt))
      .orderBy(asc(sessionNotes.createdAt)),
  );
  return useMemo(() => (data ?? []).map(rowToNote), [data]);
}

export function useNoteById(id: string | null | undefined): SessionNote | null {
  const query = useMemo(
    () =>
      db
        .select()
        .from(sessionNotes)
        .where(
          and(eq(sessionNotes.id, id ?? ""), isNull(sessionNotes.deletedAt)),
        )
        .limit(1),
    [id],
  );
  const { data } = useLiveQuery(query, [id]);
  if (!id) return null;
  const row = data?.[0];
  return row ? rowToNote(row) : null;
}

export function useNotesForSession(
  sessionId: string | null | undefined,
): SessionNote[] {
  const query = useMemo(
    () =>
      db
        .select()
        .from(sessionNotes)
        .where(
          and(
            eq(sessionNotes.sessionId, sessionId ?? ""),
            isNull(sessionNotes.deletedAt),
          ),
        )
        .orderBy(asc(sessionNotes.createdAt)),
    [sessionId],
  );
  const { data } = useLiveQuery(query, [sessionId]);
  return useMemo(() => {
    if (!sessionId) return [];
    return (data ?? []).map(rowToNote);
  }, [data, sessionId]);
}

export function useNotesForSet(
  setId: string | null | undefined,
): SessionNote[] {
  const query = useMemo(
    () =>
      db
        .select()
        .from(sessionNotes)
        .where(
          and(
            eq(sessionNotes.setId, setId ?? ""),
            isNull(sessionNotes.deletedAt),
          ),
        )
        .orderBy(asc(sessionNotes.createdAt)),
    [setId],
  );
  const { data } = useLiveQuery(query, [setId]);
  return useMemo(() => {
    if (!setId) return [];
    return (data ?? []).map(rowToNote);
  }, [data, setId]);
}

export function useNotesForExercise(
  exerciseId: string | null | undefined,
): SessionNote[] {
  const query = useMemo(
    () =>
      db
        .select()
        .from(sessionNotes)
        .where(
          and(
            eq(sessionNotes.exerciseId, exerciseId ?? ""),
            isNull(sessionNotes.deletedAt),
          ),
        )
        .orderBy(desc(sessionNotes.createdAt)),
    [exerciseId],
  );
  const { data } = useLiveQuery(query, [exerciseId]);
  return useMemo(() => {
    if (!exerciseId) return [];
    return (data ?? []).map(rowToNote);
  }, [data, exerciseId]);
}
