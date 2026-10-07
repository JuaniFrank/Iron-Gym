import { eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { keyValue, userProfile } from "@workspace/db/schema";
import { useMemo } from "react";

import { DEFAULT_PROFILE } from "@/constants/seed";
import { db } from "@/services/db";
import type { UserProfile } from "@/types";

/**
 * Default rest seconds — stored in `key_value` under the literal
 * `default_rest_seconds`. The mutator (Step 5) upserts the row; until then
 * the legacy IronLogContext is the writer, but reads are routed through
 * SQLite. Falls back to 90 (legacy default) when the row hasn't been written
 * yet (first boot, before migrations cycle in the value).
 */
const DEFAULT_REST_SECONDS = 90;

/**
 * Singleton profile row (`id = 'singleton'`). The seed inserts it on first
 * boot (`onConflictDoNothing`) so the row always exists once boot succeeds.
 *
 * Returns the legacy `UserProfile` shape: the SQL row plus a synthetic
 * `featureDiscoveries` array (the live discoveries query lives in
 * `@/domains/discovery/queries.ts` — kept separate to avoid joining at this
 * layer; consumers that need both call both hooks).
 */
export function useUserProfile(): UserProfile {
  const { data } = useLiveQuery(
    db.select().from(userProfile).where(eq(userProfile.id, "singleton")),
  );
  const row = data?.[0];

  return useMemo<UserProfile>(() => {
    if (!row) return { ...DEFAULT_PROFILE };
    return {
      name: row.name,
      age: row.age,
      weightKg: row.weightKg,
      heightCm: row.heightCm,
      sex: row.sex,
      activityLevel: row.activityLevel,
      goal: row.goal,
      units: row.units,
      theme: row.theme,
      caloriesGoal: row.caloriesGoal ?? undefined,
      proteinGoalG: row.proteinGoalG ?? undefined,
      carbsGoalG: row.carbsGoalG ?? undefined,
      fatGoalG: row.fatGoalG ?? undefined,
      volumeTargets: row.volumeTargets ?? undefined,
    };
  }, [row]);
}

/** What to do when the rest timer ends (synced with the profile). */
export interface RestNotificationConfig {
  enabled: boolean;
  type: "sound_only" | "rich";
  sound: "default" | "silent";
}

const DEFAULT_REST_NOTIFICATION_CONFIG: RestNotificationConfig = {
  enabled: true,
  type: "rich",
  sound: "default",
};

/**
 * Pure mapping behind `useRestNotificationConfig`. `undefined` rows mean the
 * query has not resolved yet and stay `undefined` (loading); defaults apply
 * only to a resolved result with no profile row.
 */
export function resolveRestNotificationConfig(
  rows: (typeof userProfile.$inferSelect)[] | undefined,
): RestNotificationConfig | undefined {
  if (!rows) return undefined;
  const row = rows[0];
  if (!row) return { ...DEFAULT_REST_NOTIFICATION_CONFIG };
  return {
    enabled: row.restNotificationEnabled,
    type: row.restNotificationType,
    sound: row.restNotificationSound,
  };
}

/**
 * Rest-notification preferences. Returns `undefined` while loading so callers
 * never seed UI or arm notifications from defaults standing in for stored
 * values; defaults only when loaded and the profile row is missing.
 */
export function useRestNotificationConfig(): RestNotificationConfig | undefined {
  const { data, updatedAt } = useLiveQuery(
    db.select().from(userProfile).where(eq(userProfile.id, "singleton")),
  );
  return useMemo(
    () => (updatedAt ? resolveRestNotificationConfig(data) : undefined),
    [data, updatedAt],
  );
}

/**
 * Default rest seconds for new routine exercises. Stored in `key_value`
 * under the key `default_rest_seconds`. Returns 90 (legacy default) when the
 * row is missing — same fallback as `DEFAULT_STATE.defaultRestSeconds` in
 * the legacy context.
 */
export function useDefaultRestSeconds(): number {
  const { data } = useLiveQuery(
    db.select().from(keyValue).where(eq(keyValue.key, "default_rest_seconds")),
  );
  const row = data?.[0];
  if (!row) return DEFAULT_REST_SECONDS;
  // `value` is mode: "json"; for a primitive int Drizzle gives back the
  // primitive. Be defensive against legacy strings just in case.
  if (typeof row.value === "number") return row.value;
  if (typeof row.value === "string") {
    const n = Number.parseInt(row.value, 10);
    return Number.isFinite(n) ? n : DEFAULT_REST_SECONDS;
  }
  return DEFAULT_REST_SECONDS;
}

/**
 * True once both the profile row and the default-rest row have been read at
 * least once. Screens that seed form state from `useUserProfile()` /
 * `useDefaultRestSeconds()` (which return defaults while loading) must wait
 * for this, or they freeze the defaults instead of the stored values.
 */
export function useProfileSettingsLoaded(): boolean {
  const profileQ = useLiveQuery(
    db.select().from(userProfile).where(eq(userProfile.id, "singleton")),
  );
  const restQ = useLiveQuery(
    db.select().from(keyValue).where(eq(keyValue.key, "default_rest_seconds")),
  );
  return !!profileQ.updatedAt && !!restQ.updatedAt;
}
