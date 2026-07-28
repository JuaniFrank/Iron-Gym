// Routines · `reorderRoutineDays` (DDB-10).
//
// What we care about:
//   1. Swapping two days does NOT violate UNIQUE(routine_id, position).
//      The mutator parks the moving row at position=-1 first to dodge
//      the constraint during the renumber.
//   2. Reordering 3+ items rotates them correctly.
//   3. fromIndex === toIndex is a no-op.

import { describe, expect, it, beforeEach } from "vitest";
import { asc, eq } from "drizzle-orm";
import { routineDays, routines } from "@workspace/db/schema";

import { reorderRoutineDays } from "@/domains/routines/mutators";
import { uid } from "@/utils/id";

import { createTestDb, type TestDb } from "../helpers/db";

async function seedRoutineWithDays(
  db: TestDb,
  routineId: string,
  dayCount: number,
): Promise<string[]> {
  const now = new Date();
  await db.insert(routines).values({
    id: routineId,
    name: "R",
    isPreset: false,
    createdAt: now,
    updatedAt: now,
  });
  const dayIds: string[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    const id = uid();
    dayIds.push(id);
    await db.insert(routineDays).values({
      id,
      routineId,
      name: `Day ${i}`,
      position: i,
      updatedAt: now,
    });
  }
  return dayIds;
}

async function readDayOrder(db: TestDb, routineId: string): Promise<string[]> {
  const rows = await db
    .select({ id: routineDays.id })
    .from(routineDays)
    .where(eq(routineDays.routineId, routineId))
    .orderBy(asc(routineDays.position))
    .all();
  return rows.map((r) => r.id);
}

describe("reorderRoutineDays", () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it("swaps two days without violating UNIQUE(routine_id, position)", async () => {
    const routineId = uid();
    const [a, b] = await seedRoutineWithDays(db, routineId, 2);
    await reorderRoutineDays(routineId, 0, 1);
    const order = await readDayOrder(db, routineId);
    expect(order).toEqual([b, a]);
  });

  it("rotates 3 items correctly (move first to last)", async () => {
    const routineId = uid();
    const [a, b, c] = await seedRoutineWithDays(db, routineId, 3);
    await reorderRoutineDays(routineId, 0, 2);
    const order = await readDayOrder(db, routineId);
    expect(order).toEqual([b, c, a]);
  });

  it("rotates 3 items correctly (move last to first)", async () => {
    const routineId = uid();
    const [a, b, c] = await seedRoutineWithDays(db, routineId, 3);
    await reorderRoutineDays(routineId, 2, 0);
    const order = await readDayOrder(db, routineId);
    expect(order).toEqual([c, a, b]);
  });

  it("is a no-op when fromIndex === toIndex", async () => {
    const routineId = uid();
    const ids = await seedRoutineWithDays(db, routineId, 3);
    await reorderRoutineDays(routineId, 1, 1);
    const order = await readDayOrder(db, routineId);
    expect(order).toEqual(ids);
  });

  it("ignores out-of-range indices silently", async () => {
    const routineId = uid();
    const ids = await seedRoutineWithDays(db, routineId, 2);
    await reorderRoutineDays(routineId, 0, 99);
    const order = await readDayOrder(db, routineId);
    expect(order).toEqual(ids);
  });
});
