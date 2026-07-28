import { asc, desc, isNull } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  bodyMeasurements,
  bodyWeights,
  progressPhotos,
} from "@workspace/db/schema";
import { useMemo } from "react";

import { db } from "@/services/db";
import type {
  BodyMeasurementEntry,
  BodyWeightEntry,
  ProgressPhoto,
} from "@/types";

function rowToWeight(row: typeof bodyWeights.$inferSelect): BodyWeightEntry {
  return {
    id: row.id,
    date: row.date instanceof Date ? row.date.getTime() : row.date,
    weightKg: row.weightKg,
  };
}

function rowToMeasurement(
  row: typeof bodyMeasurements.$inferSelect,
): BodyMeasurementEntry {
  return {
    id: row.id,
    date: row.date instanceof Date ? row.date.getTime() : row.date,
    waist: row.waist ?? undefined,
    chest: row.chest ?? undefined,
    hips: row.hips ?? undefined,
    leftArm: row.leftArm ?? undefined,
    rightArm: row.rightArm ?? undefined,
    leftThigh: row.leftThigh ?? undefined,
    rightThigh: row.rightThigh ?? undefined,
    neck: row.neck ?? undefined,
    shoulders: row.shoulders ?? undefined,
  };
}

function rowToPhoto(row: typeof progressPhotos.$inferSelect): ProgressPhoto {
  return {
    id: row.id,
    date: row.date instanceof Date ? row.date.getTime() : row.date,
    uri: row.uri,
    weightKg: row.weightKg ?? undefined,
    notes: row.notes ?? undefined,
  };
}

/**
 * All non-deleted body weight entries, sorted ASC by `date` to match the
 * legacy mutator (it sorted on insert). Most consumers re-sort anyway.
 */
export function useBodyWeights(): BodyWeightEntry[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(bodyWeights)
      .where(isNull(bodyWeights.deletedAt))
      .orderBy(asc(bodyWeights.date)),
  );
  return useMemo(() => (data ?? []).map(rowToWeight), [data]);
}

/**
 * All non-deleted measurements, sorted ASC by date. The body screen sorts
 * them DESC at consumption (latest first), keep the contract symmetric with
 * `useBodyWeights`.
 */
export function useMeasurements(): BodyMeasurementEntry[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(bodyMeasurements)
      .where(isNull(bodyMeasurements.deletedAt))
      .orderBy(asc(bodyMeasurements.date)),
  );
  return useMemo(() => (data ?? []).map(rowToMeasurement), [data]);
}

/**
 * Progress photos, sorted DESC by date (latest first — same as the legacy
 * mutator's post-insert sort).
 */
export function useProgressPhotos(): ProgressPhoto[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(progressPhotos)
      .where(isNull(progressPhotos.deletedAt))
      .orderBy(desc(progressPhotos.date)),
  );
  return useMemo(() => (data ?? []).map(rowToPhoto), [data]);
}
