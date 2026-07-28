import { eq } from "drizzle-orm";
import {
  bodyMeasurements,
  bodyWeights,
  progressPhotos,
  userProfile,
} from "@workspace/db/schema";
import { z } from "zod";

import { copyPhotoToStable, deletePhotoFile } from "@/services/photoStorage";
import { db } from "@/services/db";
import type { BodyMeasurementEntry } from "@/types";
import { uid } from "@/utils/id";
import { startOfDay } from "@/utils/date";

// ---------------------------------------------------------------------------
// Body weights
// ---------------------------------------------------------------------------

/**
 * Log a body-weight entry. Date is normalized to start-of-day (the legacy
 * mutator did the same — one canonical entry per calendar date is the
 * conceptual model, even though SQL doesn't enforce it).
 *
 * Side-effect: also updates the singleton `user_profile.weightKg` so the
 * header / TDEE calculations reflect the latest weight without a separate
 * mutator call (mirrors legacy behavior).
 */
export async function logBodyWeight(
  weightKg: number,
  date?: number,
): Promise<void> {
  const weight = z.number().positive().parse(weightKg);
  const now = new Date();
  const targetDate = new Date(startOfDay(date ?? now.getTime()));
  await db.transaction(async (tx) => {
    await tx.insert(bodyWeights).values({
      id: uid(),
      date: targetDate,
      weightKg: weight,
      updatedAt: now,
    });
    await tx
      .update(userProfile)
      .set({ weightKg: weight, updatedAt: now })
      .where(eq(userProfile.id, "singleton"));
  });
}

export async function deleteBodyWeight(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(bodyWeights)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(bodyWeights.id, id));
}

// ---------------------------------------------------------------------------
// Body measurements
// ---------------------------------------------------------------------------

const MeasurementInputSchema = z.object({
  date: z.number().int(),
  waist: z.number().positive().optional(),
  chest: z.number().positive().optional(),
  hips: z.number().positive().optional(),
  leftArm: z.number().positive().optional(),
  rightArm: z.number().positive().optional(),
  leftThigh: z.number().positive().optional(),
  rightThigh: z.number().positive().optional(),
  neck: z.number().positive().optional(),
  shoulders: z.number().positive().optional(),
});

export async function logMeasurement(
  entry: Omit<BodyMeasurementEntry, "id">,
): Promise<void> {
  const validated = MeasurementInputSchema.parse(entry);
  const now = new Date();
  await db.insert(bodyMeasurements).values({
    id: uid(),
    date: new Date(validated.date),
    waist: validated.waist ?? null,
    chest: validated.chest ?? null,
    hips: validated.hips ?? null,
    leftArm: validated.leftArm ?? null,
    rightArm: validated.rightArm ?? null,
    leftThigh: validated.leftThigh ?? null,
    rightThigh: validated.rightThigh ?? null,
    neck: validated.neck ?? null,
    shoulders: validated.shoulders ?? null,
    updatedAt: now,
  });
}

export async function deleteMeasurement(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(bodyMeasurements)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(bodyMeasurements.id, id));
}

// ---------------------------------------------------------------------------
// Progress photos (DDB-17 + DDB-21)
// ---------------------------------------------------------------------------

const PhotoInputSchema = z.object({
  uri: z.string().min(1),
  weightKg: z.number().positive().optional(),
  notes: z.string().optional(),
});

/**
 * Add a progress photo: copy the source URI to the stable
 * `documentDirectory + progress_photos/{id}.{ext}` path (DDB-17), then
 * persist the row pointing to that stable URI.
 *
 * If the FS copy fails the row is NOT inserted — the photo wouldn't
 * survive the next launch. The legacy mutator just stored the cache URI
 * which broke after iOS recycled the cache; we trade an upfront error
 * for that resilience.
 */
export async function addProgressPhoto(input: {
  uri: string;
  weightKg?: number;
  notes?: string;
}): Promise<void> {
  const validated = PhotoInputSchema.parse(input);
  const id = uid();
  const stableUri = await copyPhotoToStable(validated.uri, id);
  const now = new Date();
  await db.insert(progressPhotos).values({
    id,
    date: now,
    uri: stableUri,
    weightKg: validated.weightKg ?? null,
    notes: validated.notes ?? null,
    updatedAt: now,
  });
}

/**
 * Soft delete the row, then best-effort delete the file (DDB-21). The DB
 * write happens first; an FS hiccup must NOT block the row update.
 */
export async function deleteProgressPhoto(id: string): Promise<void> {
  const row = await db
    .select({ uri: progressPhotos.uri })
    .from(progressPhotos)
    .where(eq(progressPhotos.id, id))
    .get();
  const now = new Date();
  await db
    .update(progressPhotos)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(progressPhotos.id, id));
  if (row?.uri) {
    // Fire-and-forget — best-effort cleanup, errors swallowed inside.
    void deletePhotoFile(row.uri);
  }
}
