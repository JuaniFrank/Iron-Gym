import { eq } from "drizzle-orm";
import { keyValue, userProfile } from "@workspace/db/schema";
import { z } from "zod";

import { db } from "@/services/db";
import type { UserProfile } from "@/types";

/**
 * Mutators for the singleton `user_profile` row + the `default_rest_seconds`
 * key in `key_value`.
 *
 * The seed pipeline guarantees one row in `user_profile` with `id = "singleton"`,
 * so `updateProfile` is always an UPDATE (never an upsert). We don't validate
 * the entire shape on every patch — only the fields the caller is touching.
 */

const VolumeTargetSchema = z.object({
  mev: z.number(),
  mav: z.number(),
  mrv: z.number(),
});

const ProfilePatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    age: z.number().int().min(0).max(120).optional(),
    weightKg: z.number().positive().optional(),
    heightCm: z.number().positive().optional(),
    sex: z.enum(["male", "female"]).optional(),
    activityLevel: z
      .enum(["sedentary", "light", "moderate", "active", "veryActive"])
      .optional(),
    goal: z.enum(["lose", "maintain", "gain", "muscle"]).optional(),
    units: z.enum(["metric", "imperial"]).optional(),
    theme: z.enum(["system", "light", "dark"]).optional(),
    caloriesGoal: z.number().int().nullable().optional(),
    proteinGoalG: z.number().int().nullable().optional(),
    carbsGoalG: z.number().int().nullable().optional(),
    fatGoalG: z.number().int().nullable().optional(),
    volumeTargets: z.record(z.string(), VolumeTargetSchema).nullable().optional(),
  })
  .strict()
  .partial();

const RestNotificationConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    type: z.enum(["sound_only", "rich"]).optional(),
    sound: z.enum(["default", "silent"]).optional(),
  })
  .strict()
  .partial();

/**
 * Update the singleton profile row. `featureDiscoveries` is REJECTED here —
 * that slice lives in its own table now. Callers who used to pass it must
 * route through `domains/discovery/mutators.ts` instead.
 */
export async function updateProfile(
  patch: Partial<UserProfile>,
): Promise<void> {
  // Strip the legacy `featureDiscoveries` field if a caller still sends it.
  // Schema migration moved it out (cf. discovery/mutators.ts).
  const { featureDiscoveries: _ignored, ...rest } = patch as Partial<
    UserProfile
  > & { featureDiscoveries?: unknown };
  void _ignored;
  const validated = ProfilePatchSchema.parse(rest);
  if (Object.keys(validated).length === 0) return;
  await db
    .update(userProfile)
    .set({ ...validated, updatedAt: new Date() })
    .where(eq(userProfile.id, "singleton"));
}

/**
 * Patch del config de notificación del descanso. Solo escribe los campos
 * que vienen en `patch` — el resto quedan como estaban.
 */
export async function updateRestNotificationConfig(patch: {
  enabled?: boolean;
  type?: "sound_only" | "rich";
  sound?: "default" | "silent";
}): Promise<void> {
  const validated = RestNotificationConfigSchema.parse(patch);
  if (Object.keys(validated).length === 0) return;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (validated.enabled !== undefined)
    updates.restNotificationEnabled = validated.enabled;
  if (validated.type !== undefined)
    updates.restNotificationType = validated.type;
  if (validated.sound !== undefined)
    updates.restNotificationSound = validated.sound;
  await db
    .update(userProfile)
    .set(updates)
    .where(eq(userProfile.id, "singleton"));
}
