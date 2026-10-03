# ironlog-db-sync

## Objective

Real bidirectional sync of a single user's IronLog data between the iPhone app and the web PWA,
using Firestore as the remote store and the existing local SQLite (expo-sqlite + Drizzle) as the
source of truth on each device.

## Problem / Why

The same Firebase user now runs IronLog on iOS and on the web PWA, but each device has an isolated
local SQLite database. `db_system.md` §17 recommended snapshot backup then Turso Embedded Replicas;
that plan is outdated: expo-sqlite 58 removed libSQL support, Turso Sync is beta and would replace
expo-sqlite on both platforms, ElectricSQL has no write path, PowerSync would replace the SQLite
driver (breaking the patched web WASM setup) and add Postgres + an upload API. Firestore keeps
expo-sqlite, Drizzle, the web patch and Firebase Auth/Hosting intact and fits the Spark free quota.

## Scope

- In: change capture, push, pull, conflict resolution, Firestore rules, sync triggers in the app.
- Out: multi-user collaboration, photo file binaries (`progress_photos` rows sync, image files do
  not — follow-up), realtime `onSnapshot` listeners (follow-up), account switching on one device.

## Design (decided)

- **Change capture via SQLite triggers**, not per-mutator outbox calls. A migration adds
  `_outbox(table_name, row_id, op, queued_at)` (one pending entry per row, upserted) and
  `_sync_state(key, value)`; AFTER INSERT/UPDATE/DELETE triggers on every syncable table enqueue
  the row unless `_sync_state.applying = 1` (set while applying pulled changes). This captures hard
  deletes (including FK cascades) as tombstones, so existing hard-delete mutators stay unchanged.
- **Syncable tables**: all domain tables except `_meta`, `key_value` (device-local active-workout
  state) and `feature_discoveries` (device-local UI). Preset rows (`is_preset = 1`) are excluded.
- **Remote layout**: `users/{uid}/{table}/{rowId}` documents
  `{ data, updatedAt (client ms), deleted: boolean, serverUpdatedAt: serverTimestamp() }`.
- **Conflicts**: last-write-wins by `updatedAt`; remote wins ties. Tombstones are LWW too.
- **Pull**: per-table query `serverUpdatedAt > cursor - overlap` (overlap absorbs commit-order
  skew; apply is idempotent). Apply in one sync transaction with `PRAGMA defer_foreign_keys = ON`,
  parents before children.
- **Ports & adapters**: sync engine depends on a `SyncRemote` port; Firestore is one adapter, tests
  use an in-memory fake. Firestore uses memory cache (local SQLite is the cache).
- **Orchestration**: `syncNow()` = pull then push; runs on sign-in, app foreground, debounced after
  local writes, and on an interval while signed in. First sync for a uid backfills all syncable
  rows into `_outbox`.

## Constraints

- Drizzle expo-sqlite transactions must use synchronous callbacks (see `tests/atomicity.test.ts`).
- Spark plan only: no Cloud Functions, no Blaze.
- Firestore security: `request.auth.uid == uid` on `users/{uid}/**`.
- Deploying rules / hosting is outward-facing: ask the user first.

## TDD

- Mode: strict, on. Source: user global config (`Strict TDD Mode: enabled`).
- Runner: `pnpm --filter @workspace/ironlog test` (vitest, `artifacts/ironlog/tests`, helper `tests/helpers/db`).

## Tasks

- [x] T1 Sync schema: `_outbox` + `_sync_state` tables and capture triggers (custom migration).
      Checks: tests prove insert/update/delete enqueue, presets and excluded tables don't,
      `applying = 1` suppresses capture, cascade deletes enqueue child tombstones.
- [x] T2 Push engine against `SyncRemote` port: drain `_outbox` in batches, build docs
      (row data / tombstone), clear entries only after remote ack, keep entries re-queued meanwhile.
      Checks: unit tests with fake remote, including failure leaves outbox intact.
- [x] T3 Pull engine: fetch per-table changes since cursor, LWW apply with `applying = 1`,
      tombstones delete locally, FK-safe ordering, cursor advance. Checks: unit tests incl. stale
      remote ignored, tombstone, out-of-order parent/child, idempotent re-apply.
- [x] T4 Firestore adapter for `SyncRemote` + `firestore.rules` + `firebase.json` firestore entry.
      Checks: adapter unit tests with mocked SDK; rules file structural test; typecheck.
- [x] T5 Orchestration: `syncNow`, triggers (sign-in, foreground, debounced writes, interval),
      first-sync backfill per uid, single-flight lock. Checks: unit tests; typecheck.
- [ ] T6 End-to-end: iOS simulator + web with the same account converge after edits and deletes.
      Requires user approval to deploy rules. Checks: manual two-device run.

## Acceptance criteria

- An edit, create or delete on one device appears on the other after a sync cycle.
- Offline edits are queued and pushed when connectivity returns; nothing is lost on push failure.
- No cross-user access is possible under the deployed rules.

## Progress

- T1 done. Migrations `0002_sync_state_tables` + `0003_sync_capture_triggers` (57 triggers on 19
  syncable tables; `is_preset` filter on exercises/food_items/routines; non-`id` PKs
  `scheduled_routines.day_of_week`, `schedule_overrides.date_key`, `session_plans.date_key` cast to
  TEXT as `row_id`). `tests/sync/capture.test.ts` (11 tests). RED: 9 failed / 2 passed before
  triggers. GREEN: `pnpm --filter @workspace/ironlog test` 105/105, typecheck exit 0.
- T1 fix (accepted): seed was captured (preset routine children + default `user_profile`), and the
  fresh seeded profile would win LWW over a real profile on a newly installed device. `runSeedIfNeeded`
  now runs with `applying='1'` and seeds `user_profile.updatedAt = 0`. 2 tests in `tests/seed.test.ts`
  (RED 1 failed, then GREEN).
- Note for T5: first-sync backfill must also exclude preset routine children
  (`routine_days`/`routine_exercises` of `is_preset` routines).
- Env: vitest needs arm64 `@rollup/rollup-darwin-arm64` + `@esbuild/darwin-arm64`, excluded by
  `pnpm-workspace.yaml` overrides; locally symlinked into `node_modules/.pnpm/node_modules` (untracked,
  lost on reinstall).

- T2 done. `services/sync/{tables,remote,push}.ts`, `tests/sync/{fakeRemote,tables.test,push.test}.ts`
  (14 tests). Registry test pins `SYNC_TABLES` to the triggers, real PKs and FK order. Push sends raw
  rows / tombstones, compare-and-delete on `queued_at`, never throws, skips + drops unknown-table
  entries; identifiers only via registry lookup. RED: both suites failed (modules missing). GREEN:
  119/119, typecheck exit 0.
- Known edge (accepted, low risk): compare-and-delete uses ms `queued_at`; a write in the same ms as
  the read during a push would be dropped from the outbox. Revisit with a version counter if seen.

- T3 done. `services/sync/pull.ts` + `tests/sync/pull.test.ts` (18 tests, incl. A→push→fake→pull→B
  round trip). Fetch all tables, then one sync transaction: `defer_foreign_keys`, `applying='1'`,
  LWW apply via `ON CONFLICT DO UPDATE` (never REPLACE), local-only columns, clear stale outbox
  entry when remote wins, monotonic cursors. Any failure rolls back rows + cursors and returns
  `{applied:0, error}`. Apply follows `SYNC_TABLES` (parent-first) order; deferred FKs cover
  cross-batch orphans (rolled back, retried next cycle). RED: 17 assertion failures against a stub.
  GREEN: 137/137, typecheck exit 0.

- T4 done. `services/firebase.ts` exports `firestore` (memory cache, guarded, falls back to
  `getFirestore` on re-init). `services/sync/firestoreRemote.ts` (writeBatch chunks ≤ 500, upfront
  validation, paginated `serverUpdatedAt` query, pending timestamps skipped). `firestore.rules`:
  default deny, owner-only, table allowlist, exact shape, `serverUpdatedAt == request.time`, delete
  denied, server-side LWW on update (stale batch rejected → outbox kept → next pull clears the
  entry since remote is newer). `firebase.json` firestore entry. 22 tests (13 adapter with mocked
  SDK, 9 structural rules). RED: 13 assertion failures vs stub + ENOENT for rules. GREEN: 160/160,
  typecheck exit 0.
- Gap: rules only structurally tested (no emulator); behavioral proof pending T6.

- T5 done. `services/sync/{backfill,engine,triggers}.ts`, `SyncProvider.tsx` (+ `useSyncStatus()`),
  mounted in `app/_layout.tsx` inside `AuthProvider`. Backfill excludes presets and preset-routine
  children, records `backfilled_uid`, different uid → `account_mismatch` (no upload). Engine:
  backfill → pull → push, single-flight + one follow-up, never throws. Triggers: start, foreground
  (AppState / visibilitychange), debounced 2s after `_outbox` changes via expo-sqlite
  `addDatabaseChangeListener` (works on web via worker `update_hook`; `enableChangeListener` already
  on), 60s interval. 21 tests. RED at assertion level for each suite. GREEN: 183/183, typecheck 0.
- T3 bug fixed during T5 (accepted): a locally deleted row with a pending tombstone was resurrected
  by the overlap re-fetch of its older remote doc. `pull.ts` now skips when local row is absent and a
  pending delete is newer. 2 tests added (RED 1 failed → GREEN).
- Gap: `SyncProvider` / layout wiring have no React tests (no infra); covered by typecheck + T6.

- T6 in progress. Firestore `(default)` DB created by the user in `southamerica-east1`, production
  mode. `firestore.rules` deployed by the user (compiled + released). iOS simulator run blocked:
  `Simulator.app` missing from `/Applications/Xcode.app` (`expo run:ios` → "Can't determine id of
  Simulator app"); needs Xcode components repair. Web↔web (two Chrome profiles, same account,
  `localhost:8081`): CREATE verified by the user (routine "sync test" appeared on the other
  instance) — also proves owner read/write rules allow the happy path. Pending: edit, delete,
  offline-then-reconnect, iOS.

## Next step

- T6: verify edit + delete web↔web, then iOS once Xcode Simulator is repaired.
