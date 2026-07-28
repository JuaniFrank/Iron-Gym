import { eq } from "drizzle-orm";
import { featureDiscoveries } from "@workspace/db/schema";
import { z } from "zod";

import { db } from "@/services/db";
import type { DiscoveryStatus, FeatureDiscoveryState } from "@/types";

const STATUSES: readonly DiscoveryStatus[] = [
  "unseen",
  "shown",
  "activated",
  "dismissed",
  "snoozed",
];

const StatusSchema = z.enum(
  STATUSES as [DiscoveryStatus, ...DiscoveryStatus[]],
);

/**
 * Upsert a discovery state. Status transitions are open (unseen → shown,
 * shown → activated, etc.); the table simply stores the latest snapshot.
 *
 * `extra` may carry `shownAt`, `decidedAt`, or `snoozeUntil`. `decidedAt`
 * defaults to `now` when not provided — the legacy mutator stamped it on
 * every transition.
 */
export async function setDiscoveryStatus(
  featureId: string,
  status: DiscoveryStatus,
  extra: Partial<FeatureDiscoveryState> = {},
): Promise<void> {
  z.string().min(1).parse(featureId);
  const validatedStatus = StatusSchema.parse(status);
  const now = Date.now();
  const decidedAt = new Date(extra.decidedAt ?? now);
  const shownAt = extra.shownAt != null ? new Date(extra.shownAt) : null;
  const snoozeUntil =
    extra.snoozeUntil != null ? new Date(extra.snoozeUntil) : null;

  await db
    .insert(featureDiscoveries)
    .values({
      featureId,
      status: validatedStatus,
      shownAt,
      decidedAt,
      snoozeUntil,
    })
    .onConflictDoUpdate({
      target: featureDiscoveries.featureId,
      set: {
        status: validatedStatus,
        // Only stomp shownAt when caller explicitly provided one — preserve
        // the original `shownAt` otherwise.
        ...(shownAt != null ? { shownAt } : {}),
        decidedAt,
        snoozeUntil,
      },
    });
}

/**
 * Snooze a feature for a duration (defaults to 7 days). Equivalent to
 * `setDiscoveryStatus(id, "snoozed", { snoozeUntil: now + duration })`.
 */
export async function snoozeDiscovery(
  featureId: string,
  durationMs = 7 * 24 * 60 * 60 * 1000,
): Promise<void> {
  await setDiscoveryStatus(featureId, "snoozed", {
    snoozeUntil: Date.now() + durationMs,
  });
}

/**
 * Wipe all discovery states. Physical delete — the table is a configuration
 * cache, not history (cf. db-integration.md §8).
 */
export async function resetAllDiscoveries(): Promise<void> {
  await db.delete(featureDiscoveries);
}
