import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { DiscoveryStatus } from "../shared/discovery";

/**
 * `feature_discoveries` — progressive disclosure state per feature
 * (cf. feature-discovery.md, D-11/D-12).
 *
 * Singleton-shaped per `feature_id` (the catalog is hardcoded, this table
 * tracks status only). PK is the literal feature id string from
 * `FEATURE_DISCOVERY_DEFS`.
 *
 * Timestamps are nullable: `unseen` rows have all three null;
 * `shown_at` is set the first time the modal/banner is rendered;
 * `decided_at` when the user activates / dismisses; `snooze_until` when
 * snoozed for later re-prompt.
 *
 * `resetAllDiscoveries` deletes physically (config-shaped, §8).
 */
export const featureDiscoveries = sqliteTable("feature_discoveries", {
  /** Matches `FeatureDiscoveryDef.featureId`. */
  featureId: text("feature_id").primaryKey(),
  status: text("status").$type<DiscoveryStatus>().notNull(),
  shownAt: integer("shown_at", { mode: "timestamp_ms" }),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  snoozeUntil: integer("snooze_until", { mode: "timestamp_ms" }),
});

export type FeatureDiscovery = typeof featureDiscoveries.$inferSelect;
export type NewFeatureDiscovery = typeof featureDiscoveries.$inferInsert;
