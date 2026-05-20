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

/**
 * Rest notification config — devuelve los 3 settings o defaults (true,
 * "rich", "default") si la row no existe (primer boot antes del seed).
 */
export interface RestNotificationConfig {
  enabled: boolean;
  type: "sound_only" | "rich";
  sound: "default" | "silent";
}

export function useRestNotificationConfig(): RestNotificationConfig {
  const { data } = useLiveQuery(
    db.select().from(userProfile).where(eq(userProfile.id, "singleton")),
  );
  const row = data?.[0];
  return useMemo<RestNotificationConfig>(() => {
    // Defaults sanos cuando: (a) la row todavía no se seteó (primer boot
    // antes del seed), o (b) las columnas no existen (migration 0003 no
    // corrió por algún edge case). En esos casos preferimos UX degradada
    // (push activado por default) antes que crashear la pantalla.
    if (!row) {
      return { enabled: true, type: "rich", sound: "default" };
    }
    return {
      enabled: row.restNotificationEnabled ?? true,
      type: (row.restNotificationType ?? "rich") as "sound_only" | "rich",
      sound: (row.restNotificationSound ?? "default") as "default" | "silent",
    };
  }, [row]);
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
