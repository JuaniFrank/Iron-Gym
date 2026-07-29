// Closed-set union for `feature_discoveries.status` (cf. D-11/D-12 +
// feature-discovery.md).

export type DiscoveryStatus =
  | "unseen"
  | "shown"
  | "activated"
  | "dismissed"
  | "snoozed";
