// Achievements · check fns + `loadAchievementState` + `computeStreak`
// (DDB-20).
//
// What we care about:
//   - Each ACHIEVEMENT.check() returns the right boolean against a
//     custom AppStateForAchievements snapshot. Pure JS — no DB.
//   - `loadAchievementState` builds the snapshot correctly from the
//     DB: counts only finished + non-deleted sessions, only
//     non-deleted PRs / body weights, and runs computeStreak.
//   - `computeStreak` returns the consecutive-day streak ending today.

import { describe, expect, it, beforeEach } from "vitest";
import {
  bodyWeights,
  prRecords,
  workoutSessions,
} from "@workspace/db/schema";

import { ACHIEVEMENTS } from "@/constants/achievements";
import {
  computeStreak,
  loadAchievementState,
} from "@/domains/achievements/queries";
import type { AppStateForAchievements } from "@/types";
import { uid } from "@/utils/id";

import { createTestDb, type TestDb } from "../helpers/db";

function emptyState(): AppStateForAchievements {
  return { sessions: [], bodyWeights: [], streak: 0, prs: [] };
}

function findAchievement(id: string) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) throw new Error(`unknown achievement: ${id}`);
  return a;
}

describe("ACHIEVEMENTS.check (pure)", () => {
  it("first-workout fires at sessions.length >= 1", () => {
    const a = findAchievement("first-workout");
    expect(a.check(emptyState())).toBe(false);
    expect(
      a.check({
        ...emptyState(),
        sessions: [{} as never],
      }),
    ).toBe(true);
  });

  it("ten-workouts fires at sessions.length >= 10", () => {
    const a = findAchievement("ten-workouts");
    expect(
      a.check({
        ...emptyState(),
        sessions: Array.from({ length: 9 }, () => ({}) as never),
      }),
    ).toBe(false);
    expect(
      a.check({
        ...emptyState(),
        sessions: Array.from({ length: 10 }, () => ({}) as never),
      }),
    ).toBe(true);
  });

  it("streak-7 fires at streak >= 7", () => {
    const a = findAchievement("streak-7");
    expect(a.check({ ...emptyState(), streak: 6 })).toBe(false);
    expect(a.check({ ...emptyState(), streak: 7 })).toBe(true);
  });

  it("first-pr fires at prs.length >= 1", () => {
    const a = findAchievement("first-pr");
    expect(a.check(emptyState())).toBe(false);
    expect(
      a.check({
        ...emptyState(),
        prs: [
          {
            exerciseId: "x",
            exerciseName: "x",
            type: "weight",
            value: 100,
            achievedAt: 0,
          },
        ],
      }),
    ).toBe(true);
  });

  it("bench-100 needs a chest-1 weight PR >= 100", () => {
    const a = findAchievement("bench-100");
    expect(
      a.check({
        ...emptyState(),
        prs: [
          {
            exerciseId: "chest-2", // wrong id
            exerciseName: "Other",
            type: "weight",
            value: 200,
            achievedAt: 0,
          },
        ],
      }),
    ).toBe(false);
    expect(
      a.check({
        ...emptyState(),
        prs: [
          {
            exerciseId: "chest-1",
            exerciseName: "Bench",
            type: "weight",
            value: 100,
            achievedAt: 0,
          },
        ],
      }),
    ).toBe(true);
  });

  it("weight-tracker fires at bodyWeights.length >= 10", () => {
    const a = findAchievement("weight-tracker");
    expect(
      a.check({
        ...emptyState(),
        bodyWeights: Array.from({ length: 9 }, (_, i) => ({
          id: `${i}`,
          date: 0,
          weightKg: 70,
        })),
      }),
    ).toBe(false);
    expect(
      a.check({
        ...emptyState(),
        bodyWeights: Array.from({ length: 10 }, (_, i) => ({
          id: `${i}`,
          date: 0,
          weightKg: 70,
        })),
      }),
    ).toBe(true);
  });
});

describe("computeStreak", () => {
  let db: TestDb;
  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it("returns 0 when no sessions exist", async () => {
    expect(await computeStreak(db)).toBe(0);
  });

  it("counts consecutive training days ending today", async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    for (const ts of [today, yesterday, twoDaysAgo]) {
      await db.insert(workoutSessions).values({
        id: uid(),
        routineId: null,
        routineDayId: null,
        routineName: "x",
        dayName: "x",
        startedAt: ts,
        endedAt: ts,
        exerciseOrder: [],
        skippedExerciseIds: [],
        totalVolumeKg: 0,
        notes: null,
        updatedAt: ts,
      });
    }

    expect(await computeStreak(db)).toBe(3);
  });

  it("breaks the streak on a missing day", async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    for (const ts of [today, threeDaysAgo]) {
      await db.insert(workoutSessions).values({
        id: uid(),
        routineId: null,
        routineDayId: null,
        routineName: "x",
        dayName: "x",
        startedAt: ts,
        endedAt: ts,
        exerciseOrder: [],
        skippedExerciseIds: [],
        totalVolumeKg: 0,
        notes: null,
        updatedAt: ts,
      });
    }
    // Today is the only contiguous day.
    expect(await computeStreak(db)).toBe(1);
  });
});

describe("loadAchievementState", () => {
  let db: TestDb;
  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it("filters out unfinished + soft-deleted sessions, and soft-deleted PRs / body weights", async () => {
    const now = new Date();

    // Finished + live session.
    await db.insert(workoutSessions).values({
      id: "s-live",
      routineId: null,
      routineDayId: null,
      routineName: "x",
      dayName: "x",
      startedAt: now,
      endedAt: now,
      exerciseOrder: [],
      skippedExerciseIds: [],
      totalVolumeKg: 0,
      notes: null,
      updatedAt: now,
    });
    // Finished but soft-deleted.
    await db.insert(workoutSessions).values({
      id: "s-deleted",
      routineId: null,
      routineDayId: null,
      routineName: "x",
      dayName: "x",
      startedAt: now,
      endedAt: now,
      exerciseOrder: [],
      skippedExerciseIds: [],
      totalVolumeKg: 0,
      notes: null,
      updatedAt: now,
      deletedAt: now,
    });
    // Unfinished.
    await db.insert(workoutSessions).values({
      id: "s-active",
      routineId: null,
      routineDayId: null,
      routineName: "x",
      dayName: "x",
      startedAt: now,
      endedAt: null,
      exerciseOrder: [],
      skippedExerciseIds: [],
      totalVolumeKg: 0,
      notes: null,
      updatedAt: now,
    });

    // Body weights — one live, one deleted.
    await db.insert(bodyWeights).values({
      id: uid(),
      date: now,
      weightKg: 70,
      updatedAt: now,
    });
    await db.insert(bodyWeights).values({
      id: uid(),
      date: now,
      weightKg: 71,
      updatedAt: now,
      deletedAt: now,
    });

    const state = await loadAchievementState(db);
    expect(state.sessions.map((s) => s.id)).toEqual(["s-live"]);
    expect(state.bodyWeights).toHaveLength(1);
    expect(state.prs).toEqual([]);
    expect(typeof state.streak).toBe("number");
  });
});
