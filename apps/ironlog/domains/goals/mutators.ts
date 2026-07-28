import { eq } from "drizzle-orm";
import { fitnessGoals } from "@workspace/db/schema";
import { z } from "zod";

import { db } from "@/services/db";
import type { FitnessGoal } from "@/types";
import { uid } from "@/utils/id";

const GoalInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  targetDate: z.number().int(),
  exerciseId: z.string().min(1).optional(),
  targetWeight: z.number().positive().optional(),
});

/**
 * Insert a new goal. The legacy mutator stamped `createdAt` and forced
 * `completed = false`; same here. The DB column has a default of `false`
 * but we set it explicitly to make the contract obvious.
 */
export async function addGoal(
  input: Omit<FitnessGoal, "id" | "createdAt" | "completed">,
): Promise<void> {
  const validated = GoalInputSchema.parse(input);
  const now = new Date();
  await db.insert(fitnessGoals).values({
    id: uid(),
    title: validated.title,
    description: validated.description ?? null,
    targetDate: new Date(validated.targetDate),
    exerciseId: validated.exerciseId ?? null,
    targetWeight: validated.targetWeight ?? null,
    completed: false,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Toggle the `completed` flag. Two-step (read + write) instead of a
 * `completed = NOT completed` SQL update because Drizzle's update API
 * doesn't expose raw expressions cleanly across drivers — the read is
 * cheap (PK lookup).
 */
export async function toggleGoal(id: string): Promise<void> {
  const row = await db
    .select({ completed: fitnessGoals.completed })
    .from(fitnessGoals)
    .where(eq(fitnessGoals.id, id))
    .get();
  if (!row) return;
  await db
    .update(fitnessGoals)
    .set({ completed: !row.completed, updatedAt: new Date() })
    .where(eq(fitnessGoals.id, id));
}

/**
 * Soft delete (`deletedAt = now`). Goals are user-history-relevant, so we
 * preserve the row.
 */
export async function deleteGoal(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(fitnessGoals)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(fitnessGoals.id, id));
}
