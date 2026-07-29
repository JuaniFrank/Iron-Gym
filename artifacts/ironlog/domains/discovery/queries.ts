import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { featureDiscoveries } from "@workspace/db/schema";
import { useMemo } from "react";

import { db } from "@/services/db";
import type { FeatureDiscoveryState } from "@/types";

function rowToDiscovery(
  row: typeof featureDiscoveries.$inferSelect,
): FeatureDiscoveryState {
  return {
    featureId: row.featureId,
    status: row.status,
    shownAt:
      row.shownAt instanceof Date ? row.shownAt.getTime() : row.shownAt ?? undefined,
    decidedAt:
      row.decidedAt instanceof Date
        ? row.decidedAt.getTime()
        : row.decidedAt ?? undefined,
    snoozeUntil:
      row.snoozeUntil instanceof Date
        ? row.snoozeUntil.getTime()
        : row.snoozeUntil ?? undefined,
  };
}

/**
 * All feature discovery states. The legacy `UserProfile.featureDiscoveries`
 * was an array embedded in the profile blob — the DB lives in its own table
 * (DDB schema §2 `feature_discoveries`). Consumers that previously did
 * `profile.featureDiscoveries?.find(...)` should now call this hook and
 * filter / map locally.
 */
export function useFeatureDiscoveries(): FeatureDiscoveryState[] {
  const { data } = useLiveQuery(db.select().from(featureDiscoveries));
  return useMemo(() => (data ?? []).map(rowToDiscovery), [data]);
}
