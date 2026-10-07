// Notes · mood-only / pain-only notes without free text
// (ironlog-port-minor-issues T11). Real DB (createTestDb).

import { eq } from "drizzle-orm";
import { sessionNotes, workoutSessions } from "@workspace/db/schema";
import { beforeEach, describe, expect, it } from "vitest";

import { addNote, updateNote } from "@/domains/notes/mutators";

import { createTestDb, type TestDb } from "../helpers/db";

let db: TestDb;
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(async () => {
  ({ db, sqlite } = createTestDb());
  await db
    .insert(workoutSessions)
    .values({
      id: "s1",
      routineId: null,
      routineDayId: null,
      routineName: "R",
      dayName: "D",
      startedAt: new Date(),
      endedAt: null,
      exerciseOrder: [],
      skippedExerciseIds: [],
      totalVolumeKg: 0,
      updatedAt: new Date(),
    })
    .run();
  sqlite.exec("DELETE FROM _outbox");
});

async function stored(id: string) {
  return db.select().from(sessionNotes).where(eq(sessionNotes.id, id)).get();
}

describe("addNote without free text", () => {
  it("accepts an empty text (mood-only note)", async () => {
    const note = await addNote({
      sessionId: "s1",
      category: "mood",
      text: "",
      source: "recap",
    });
    expect(note.text).toBe("");
    expect((await stored(note.id))?.text).toBe("");
  });

  it("accepts a missing text and stores an empty string", async () => {
    const input = { sessionId: "s1", category: "mood", source: "recap" };
    const note = await addNote(input as never);
    expect(note.text).toBe("");
    expect((await stored(note.id))?.text).toBe("");
  });

  it("accepts a pain-only note (body part + severity, no text)", async () => {
    const note = await addNote({
      sessionId: "s1",
      category: "pain",
      bodyPart: "knee_left",
      severity: 6,
      text: "",
      source: "chip",
    });
    expect(await stored(note.id)).toMatchObject({
      category: "pain",
      bodyPart: "knee_left",
      severity: 6,
      text: "",
    });
  });

  it("still rejects an invalid category or missing session", async () => {
    await expect(
      addNote({ sessionId: "s1", category: "nope", text: "", source: "chip" } as never),
    ).rejects.toThrow();
    await expect(
      addNote({ sessionId: "", category: "mood", text: "", source: "chip" } as never),
    ).rejects.toThrow();
  });

  it("produces an _outbox row so the note syncs", async () => {
    const note = await addNote({
      sessionId: "s1",
      category: "mood",
      text: "",
      source: "recap",
    });
    const rows = sqlite
      .prepare("SELECT table_name, row_id FROM _outbox")
      .all() as { table_name: string; row_id: string }[];
    expect(rows).toEqual([{ table_name: "session_notes", row_id: note.id }]);
  });
});

describe("updateNote with a partial patch", () => {
  it("a patch without text leaves the stored text unchanged (default must not apply)", async () => {
    const note = await addNote({
      sessionId: "s1",
      category: "other",
      text: "keep me",
      source: "text",
    });
    await updateNote(note.id, { resolved: true });
    expect(await stored(note.id)).toMatchObject({ text: "keep me", resolved: true });
  });

  it("a patch can still clear the text explicitly", async () => {
    const note = await addNote({
      sessionId: "s1",
      category: "other",
      text: "bye",
      source: "text",
    });
    await updateNote(note.id, { text: "" });
    expect((await stored(note.id))?.text).toBe("");
  });

  it("a note edit enqueues the row for sync", async () => {
    const note = await addNote({
      sessionId: "s1",
      category: "mood",
      text: "",
      source: "recap",
    });
    sqlite.exec("DELETE FROM _outbox");
    await updateNote(note.id, { severity: 3 });
    const rows = sqlite
      .prepare("SELECT table_name, row_id FROM _outbox")
      .all() as { table_name: string; row_id: string }[];
    expect(rows).toEqual([{ table_name: "session_notes", row_id: note.id }]);
  });
});
