// MUST be imported before `uuid`. React Native has no global `crypto`, so
// `uuid` (which uses `crypto.getRandomValues`) crashes at runtime without
// this polyfill. See: https://www.npmjs.com/package/uuid#getrandomvalues-not-supported
import "react-native-get-random-values";

import { v7 as uuidv7 } from "uuid";

/**
 * Generate a UUID v7 (timestamp-prefixed). Used as the primary id for every
 * row we insert client-side (DDB-4). Two properties matter for IronLog:
 *
 * 1. **Index locality** — v7 is monotonically increasing per-process which
 *    keeps SQLite B-tree inserts cheap and recent rows clustered together
 *    on the same pages.
 * 2. **Cursor pagination** — for any future sync/server interaction the
 *    sortable id doubles as a deterministic cursor without needing a
 *    `created_at` filter.
 *
 * NEVER replace this with `Math.random` style ids. The legacy `uid()` did
 * exactly that and we paid for it (collisions on rapid inserts, index
 * fragmentation).
 */
export function uid(): string {
  return uuidv7();
}
