# ironlog-sync-indicator

## Objective

A visible sync status pill plus a debug panel so the user can see what sync is doing on each
device (green ok, yellow syncing with current phase/table/progress, red error) while testing.

## Problem / Why

Sync runs silently. Debugging the iPhone freezes and the unexplained routine-rename issue needs
on-device visibility of phases (backfill, pull fetch/apply, push), per-table counts, durations and
the full error cause chain.

## Scope

- In: progress reporting from backfill/pull/push, engine status with current activity, last run
  summary and a bounded event log; pill + detail panel UI with "Sincronizar ahora".
- Out: a settings toggle to hide it (follow-up); remote logging.

## Design (decided)

- `pullChanges` / `pushPending` accept an optional `onProgress(event)`; events are plain data:
  pull fetch per table (`{ phase: 'pull-fetch', table, fetched }`), pull apply per batch
  (`{ phase: 'pull-apply', table, done, total }`), push per round (`{ phase: 'push', table?,
  done, total }`). No behaviour change when omitted.
- Engine status adds `activity?: { phase, table?, done?, total? }` (only while syncing),
  `lastRun?: { startedAt, durationMs, pulled, pushed, error? }`, and `log: SyncLogEntry[]` capped
  at 30 (newest first): run start, backfill result, per-table pull/push summaries, run end/error.
  Status listeners are notified on progress, throttled so a batch storm doesn't re-render per row.
- Pure formatting helpers (pill color/label, relative time, error chain text) in
  `services/sync/statusView.ts` with tests; reuse the cause-chain logic from `services/dbBoot.ts`
  (`describeBootError`) instead of duplicating it.
- UI: `components/SyncIndicator.tsx` floating pill (top-right, safe-area aware, above tabs and
  stacks, mounted once from `SyncProvider`/layout, hidden when sync is inactive or signed out).
  Tap opens a modal/sheet with state, activity, last run, error chain, log, and
  "Sincronizar ahora" (calls `engine.syncNow()`). Spanish UI copy; table names shown raw.
- `account_mismatch` → red with an explanation.

## Constraints

- No extra main-thread DB work for the indicator.
- Existing sync tests stay green.

## TDD

- Mode: strict, on. Source: user global config. Runner: `pnpm --filter @workspace/ironlog test`.
  UI verified by typecheck + manual run (no React test infra).

## Tasks

- [x] T1 Progress events in backfill/pull/push + engine activity, lastRun, capped log, throttled
      notifications. Checks: unit tests.
- [x] T2 `statusView.ts` helpers. Checks: unit tests.
- [x] T3 `SyncIndicator` pill + detail panel + "Sincronizar ahora", mounted globally. Checks:
      typecheck + manual web run.
- [ ] T4 Deploy and use it on the iPhone to debug sync.

## Progress

- T1–T3 done (UI typecheck-only). `services/sync/progress.ts` events (pull-fetch, pull-apply with
  applied count, push per round); engine `activity`, `lastRun`, Spanish `log` capped at 30,
  notifications throttled to 250 ms; `useSyncEngine()`; `statusView.ts` (pillView, formatRelative,
  formatDuration, errorText, describeActivity); `describeErrorChain` shared with `dbBoot.ts`;
  `components/SyncIndicator.tsx` pill (theme ok/warning/danger, box-none) + bottom sheet with log
  and "Sincronizar ahora", mounted in `app/_layout.tsx`. `getStatus()` returns the last published
  status. RED: 25 assertion failures vs stubs. GREEN: 305/305, typecheck exit 0.

## Next step

- T4: deploy and use it on the iPhone.
