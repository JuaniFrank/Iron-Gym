// Body · `addProgressPhoto` / `deleteProgressPhoto` (DDB-17 + DDB-21).
//
// What we care about:
//   - addProgressPhoto: copies the source URI to the stable location
//     (delegated to `services/photoStorage.copyPhotoToStable`) and
//     INSERTs a row.
//   - deleteProgressPhoto: SOFT-DELETEs the row, then best-effort calls
//     `deletePhotoFile`. The row write happens BEFORE the file delete,
//     and a thrown error from the file delete must NOT bubble.
//
// Filesystem mock: expo-file-system is mocked because it's a real
// platform binding. Per convention (cf. CLAUDE.md / the user's
// no-mock-DB rule) we still hit a REAL DB — only the FS layer is
// stubbed, since DB integrity is the value test mocks would erode.

import { describe, expect, it, beforeEach, vi } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { progressPhotos } from "@workspace/db/schema";

let copyCalls: { src: string; id: string }[] = [];
let deleteCalls: string[] = [];

vi.mock("@/services/photoStorage", () => ({
  copyPhotoToStable: async (src: string, id: string) => {
    copyCalls.push({ src, id });
    return `file:///stub/progress_photos/${id}.jpg`;
  },
  deletePhotoFile: async (uri: string) => {
    deleteCalls.push(uri);
  },
}));

import {
  addProgressPhoto,
  deleteProgressPhoto,
} from "@/domains/body/mutators";

import { createTestDb, type TestDb } from "../helpers/db";

describe("progress photo mutators", () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
    copyCalls = [];
    deleteCalls = [];
  });

  it("addProgressPhoto copies the file then inserts the row", async () => {
    await addProgressPhoto({
      uri: "file:///cache/123.jpg",
      weightKg: 75,
      notes: "post leg day",
    });

    expect(copyCalls).toHaveLength(1);
    expect(copyCalls[0].src).toBe("file:///cache/123.jpg");

    const rows = await db.select().from(progressPhotos).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].uri).toBe(`file:///stub/progress_photos/${copyCalls[0].id}.jpg`);
    expect(rows[0].weightKg).toBe(75);
    expect(rows[0].notes).toBe("post leg day");
    expect(rows[0].deletedAt).toBeNull();
  });

  it("deleteProgressPhoto soft-deletes the row + best-effort deletes the file", async () => {
    await addProgressPhoto({ uri: "file:///cache/abc.jpg" });
    const row = (await db.select().from(progressPhotos).all())[0];

    await deleteProgressPhoto(row.id);

    const rowAfter = await db
      .select()
      .from(progressPhotos)
      .where(eq(progressPhotos.id, row.id))
      .get();
    expect(rowAfter?.deletedAt).not.toBeNull();
    expect(deleteCalls).toEqual([row.uri]);

    const live = await db
      .select()
      .from(progressPhotos)
      .where(isNull(progressPhotos.deletedAt))
      .all();
    expect(live).toHaveLength(0);
  });
});
