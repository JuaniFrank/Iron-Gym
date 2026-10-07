# ironlog-port-minor-issues

## Objective

Bring every feature from `origin/fix/minor-issues` (11 commits, May 6–20 2026, never merged) onto
current `main` without regressions.

## Problem / Why

- The user's previous build came from `fix/minor-issues`; current builds come from `main`, so the
  user lost: pinned rest timer, collapse of finished exercises, timestamp-based rest timer that
  survives background, planned values prefilling the active workout, set-input drafts, day swap
  sheet, per-exercise rest stepper, rest notification settings, small UX fixes.
- Root cause of "workout starts empty despite plan": main's `SetRow` seeds inputs with a `useState`
  lazy initializer while `useSessionPlan` (async live query) resolves after the first render.
- `main` diverged heavily (async drizzle driver, sync engine with capture triggers, draft routine
  editor, cross-platform dialogs, "never seed from partially loaded data"). Port by re-applying,
  not by merging.

## Scope

- In: all behavior from commits 7c4e9c8, 3e1c08c, 4268c73, 9bba052, 415b863, 01376d9, d57bc4d,
  897e509, 21a9137.
- Out (superseded / harmful): 50a87fb `{plan,isLoaded}` shape (main 4a1e358 supersedes it),
  d9c2cab prettier-only, `(tabs)/index.tsx` formatting hunks, exercises search bar (main be6a1d6
  fixed it), branch migration artifacts (journal/sql/snapshots), branch removal of the plan-editor
  RPE column, `expo-notifications` dependency + `app.json` plugin (push stays disabled; plugin adds
  `aps-environment` which breaks free Apple ID sideload).

## Constraints / Decisions (2026-10-06, orchestrator defaults, conservative "no new bugs")

- D1: devices that ran branch builds already have `session_set_drafts` and the 3 `user_profile`
  columns. New migrations MUST be idempotent: `CREATE TABLE/INDEX IF NOT EXISTS`; column adds must
  tolerate "duplicate column name" (tolerant migrator path, tested).
- D2: rest-notification prefs live in synced `user_profile` (sync across devices; LWW via
  `updatedAt` bump).
- D3: keep plan-editor RPE column; port only the "Repetir última" opacity hint.
- D4: no `expo-notifications` dep/plugin; port the inert stub + settings section as on the branch.
- D5: skip formatting-only changes.
- Migrations generated with `pnpm --filter @workspace/db db:generate:sqlite` as NEW 0004/0005
  (journal `when` strictly increasing). Never copy branch migration files.
- `session_set_drafts` is local-only: not in `SYNC_TABLES`, no capture triggers.
- Mutations use `.run()` (async sqlite-proxy convention). Alerts use `showAlert` from `@/utils/alert`.
- Never seed screen state from partially loaded data (gate on loaded plan/drafts).
- No component tests available (node vitest, no RN testing lib): extract pure logic into
  `domains/**` and test that; UI wiring verified via typecheck + manual QA.
- Worktree: `/Users/jfrank/Documents/Projects/Iron-Gym-worktrees/port-minor-issues`, branch
  `feat/port-minor-issues` from main@4a1e358. Main checkout has unrelated uncommitted sync work —
  do not touch it.

## TDD

- Mode: strict (source: session config "Strict TDD Mode: enabled").
- Runner: `pnpm test` (vitest) and `pnpm typecheck` in `artifacts/ironlog`.
- Baseline (worktree): 371 tests passed, typecheck clean.

## Tasks

- [x] T1 Migration guard rails + sync classification: export `LOCAL_ONLY_TABLES`; test every
      sqlite table is in exactly one of SYNC/LOCAL_ONLY; journal `when` strictly increasing; journal
      tags ↔ .sql ↔ migrations.js imports ↔ snapshots.
- [x] T2 `session_set_drafts` schema + idempotent migration 0004 + mutators (upsert / clear slot /
      clear session, `.run()`) + `buildDraftKey`/`useDraftsBySession` (loading-aware); `logSet`,
      `finishWorkout`, cancel cascade and `resetAll` clean drafts; local-only classification.
- [x] T3 `user_profile` rest-notification columns + tolerant migration 0005 +
      `updateRestNotificationConfig` + loading-aware `useRestNotificationConfig`; sync tests
      (outbox enqueue, pull without columns keeps local, pull with columns LWW).
- [x] T4 `SetRow` port (initialRpe, compact sizing <400pt, PR trophy via `TermHint term="PR"`,
      debounced `onDraftChange` with flush on unmount) + pure `resolveSetInputs`
      (completed > draft > planned > previous). Fixes empty-fields bug.
- [x] T5 `active.tsx`: drafts wiring, "Añadir set" extra rows, "Finalizar serie" collapse/expand
      accordion, pure `computeExerciseRows`; render rows only when plan + drafts loaded.
- [x] T6 `RestTimer` timestamp-based (endsAt, AppState resync), pause/resume, ±15s, pin toggle,
      scale pulse; pure `domains/workout/restTimer.ts`; +15 after reaching 0 re-arms.
- [x] T7 `services/notifications.ts` inert stub; rest wiring + sticky pinned overlay in
      `active.tsx`; Settings "Notificación al terminar" section; docs (`how-to-test.txt`,
      `push-notifications-system.md`).
- [x] F1 (added: found in parent review of T5) No "Sin sesión activa" flash while loading:
      `useActiveSession`/`useActiveWorkoutId` return `undefined` while loading, `null` only when loaded
      and none; active.tsx shows a loading view for `undefined`; pure `activeSessionState.ts`.
- [x] F2 (added: found in parent review of T5) Rows added with "Añadir set" survive a restart:
      `computeExerciseRows` takes `draftWarmupCount`/`draftWorkCount`; `nextExtraWork` keeps
      "Añadir set" from double counting.
- [x] T8 `DaySwapSheet` rewrite (drag & drop, action menu, reschedule picker, statuses) re-applying
      main's tweaks (Header paddingTop 16, `Card variant="darkCard"`); pure
      `domains/schedule/daySwap.ts`; characterization tests for `swapDates`/overrides.
- [x] T9 Plan editor: "Repetir última" opacity hint only.
- [x] T10 Routines: default rest from settings for new exercises (draft + legacy path), per-exercise
      "Desc." stepper, in-place day rename via `renameDay`.
- [x] T11 Notes: mood-only notes (`text` default ""), MoodSelector emoji lineHeight, NoteSheet
      ScrollView.
- [x] T12 Tooling: metro `watchFolders`, `dev:ios:clear` script, `update-ipa.sh` (AltServer start,
      `--full` prebuild + pod install).
- [x] R1 (review: independent regression review, should-fix) Keyed live queries: `utils/keyedLive.ts` (pure
      `applyKeyedResult`/`selectKeyed`/`startKeyedLiveQuery`) + `hooks/useKeyedLiveQuery.ts`; used by
      `useDraftsBySession`, `useSessionPlan`, `useRoutineById`, `useActiveSession`; removed superseded
      `nextKeyedLoad`/`isLoadedForKey`/`useLoadedForKey`; set-row React key stable per slot (`rowKey`).
- [x] R2 (review) `REST_NOTIFICATIONS_AVAILABLE = false` gates the settings rest-notification section.
- [x] R3 (review) `planRestStart`: 0 s rest starts no timer (and replaces a previous one like any new set).
- [x] R4 (review) `withSessionEnding`: `sessionEndedRef` raised before awaiting finish/cancel, lowered on failure.
- [x] R5 (review) `parseCompletion`: SetRow `cancelDraft()` only after the reps validation passes.
- [x] R6 (review) `applyPendingDayRename`: open day-name editor is committed on Save / day switch / add day.
- [x] R7 (review) `runOnce` in-flight guard on `handlePick` of exercises.tsx.
- [x] R8 (review) metro `resolver.blockList` merges `.codegraph/` and `.atl/` (`metro.blocklist.js`).
- [x] T13 Final verification: typecheck + full tests, fresh DB and upgraded DB (main schema and
      branch-schema device) boot, sync round trip with new columns, manual QA checklist.
      Automated part observed; device/PWA manual QA still PENDING (user).

## Acceptance criteria

- All listed behaviors present on `feat/port-minor-issues`; typecheck + full test suite green.
- Booting on (a) fresh DB, (b) current-main DB, (c) DB that ran branch migrations succeeds.
- No new synced table without classification; drafts never reach `_outbox`.

## Progress

- 2026-10-06: worktree created, baseline green, port plan mapped. Next: T1.
- 2026-10-06 T1 done: `LOCAL_ONLY_TABLES` exported; classification test (RED: `_meta` unclassified) +
  `tests/lib/migrationsJournal.test.ts` (6 tests). Targeted: 10/10 green.
- 2026-10-06 T2 done: schema + migration `0004_session_set_drafts` (IF NOT EXISTS), mutators
  (single INSERT..ON CONFLICT + empty-row delete), `logSet`/`finishWorkout`/`cancelWorkout`/`resetAll`
  cleanup, `buildDraftKey`/`draftRowsToMap`/`useDraftsBySession` (undefined while loading), local-only.
  RED: 20/21 drafts tests failing (no table/exports) + branch-device upgrade "table already exists".
  Finding: expo-sqlite does NOT enable `foreign_keys` by default (SQLite default OFF, not compiled
  with SQLITE_DEFAULT_FOREIGN_KEYS) -> `cancelWorkout` deletes drafts explicitly (cascade is only a
  backstop). Same applies to pre-existing cascades (e.g. completed_sets on cancel) - not changed.
- 2026-10-06 T3 done: columns + migration `0005_rest_notification_columns`; tolerant
  `migrateAsync` (statement-scoped duplicate-column-name on `ALTER TABLE .. ADD`), mutator
  `updateRestNotificationConfig`, `resolveRestNotificationConfig`/`useRestNotificationConfig`
  (undefined while loading). Capture triggers carry only row ids and push/pull read columns
  dynamically via `pragma_table_info`, so no trigger change needed (tested end to end).
  RED: 17 failing before implementation; tolerance tests fail with "duplicate column name".
- 2026-10-06 T1-T3 verification (worktree): `pnpm test` 425 passed (44 files), `pnpm typecheck` clean,
  `pnpm run typecheck:libs` clean. Baseline was 371. Next: T4.
- 2026-10-06 T4 done: pure `domains/workout/setInputs.ts` (`resolveSetInputs`: completed > draft > planned >
  previous per field, completed row shows only logged values, warmups no RPE; `parseDraftPatch`);
  SetRow takes `initialInputs` (seeded once; completed rows follow DB values), compact sizing <400pt, PR
  trophy via `TermHint term="PR"` (+ `children` trigger), 300ms debounced `onDraftChange` after user typing,
  flush on unmount, pending draft cancelled on complete. RED: setInputs.test.ts failed to load (module
  missing); GREEN 13/13.
- 2026-10-06 T5 done: `domains/workout/sessionRows.ts` (`computeExerciseRows`, `isActiveWorkoutDataLoaded`);
  active.tsx: drafts wiring (fire-and-forget + catch, skipped after finish/discard), "Anadir set" extra rows,
  "Finalizar serie" collapse/expand accordion, list renders only when plan + drafts + routine + history are
  loaded. Added `useSessionsWithStatus` and gated `useActiveSession` on all 3 queries having resolved
  (previous-values/sets were also partially loaded at mount). RED: sessionRows.test.ts missing module (13)
  + 5 failing `isActiveWorkoutDataLoaded` (not a function); GREEN 18/18.
- 2026-10-06 T6 done: RestTimer timestamp-based and controlled (`endsAt`, `pausedAt`, `onChange`) so pin
  remount keeps pause/adjust; pure `domains/workout/restTimer.ts`; +15 after 0 extends from now and re-arms
  completion; AppState resync; native-driver-only pulse (`useNativeDriver` off on web); pin button.
  RED: restTimer.test.ts missing module; GREEN 18/18.
- 2026-10-06 T7 done: `services/notifications.ts` inert stub (no expo-notifications dep/plugin), rest
  wiring + sticky pinned overlay in active.tsx, settings "Notificacion al terminar" section (gated on rest
  config loaded), docs `how-to-test.txt` + `push-notifications-system.md`. RED: notifications.test.ts
  missing module; GREEN 5/5.
- 2026-10-06 T4-T7 verification (worktree): `pnpm test` 479 passed (48 files), `pnpm typecheck` clean.
  Next: T8.
- 2026-10-06 F1 done: `domains/workout/activeSessionState.ts` (`resolveActiveSessionPhase`, keyed live-query load
  tracking `nextKeyedLoad`/`isLoadedForKey`, `activeScreenView`). `useActiveSession(): WorkoutSession | null |
  undefined` and `useActiveWorkoutId(): string | null | undefined` (undefined = loading, still falsy so other
  callers are unchanged). Finding: drizzle `useLiveQuery` keeps the previous deps' `data`/`updatedAt` after a
  deps change, so "loaded" is tracked per active id (otherwise the id arriving after the first empty
  result flashed the empty state). active.tsx: loading view (Screen + Header, like routine/[id]) and
  startWorkout-from-params waits for `activeWorkoutId === null` (previously a pending read could start a second
  workout) and keeps the loading view while that start is pending (spinner-less, `startFailed` falls back to the
  empty state). RED: activeSessionState.test.ts missing module; GREEN 15/15.
- 2026-10-06 F2 done: draft `setIndex` is 1-based (= row `index`), so drafts need `max(setIndex)` rows. Pure
  `draftSlotCounts(drafts, exerciseId)` + `computeExerciseRows({draftWarmupCount, draftWorkCount})`; "Añadir set"
  stores `nextExtraWork(rowsArgs)` (floor, one row above what is shown) so it never double counts after restart
  nor on top of a draft typed into an added row. RED: 12 failing (drafts ignored, missing exports); GREEN 32/32.
- 2026-10-06 T9 done: "Repetir última" Chip `opacity: 0.5` when no history (plan.tsx only; RPE column and 4a1e358 untouched).
- 2026-10-06 T10 done: `domains/routines/restSeconds.ts` (`parseRestSeconds`, `formatRestSeconds`);
  `addExercise` draft action takes optional `restSeconds`; `readDefaultRestSeconds(executor)` in routines
  mutators reads `key_value.default_rest_seconds` straight from the DB (used by legacy `addExerciseToDay` inside
  its tx and by exercises.tsx draft picker, so an unloaded live hook can never yield 90); 4th "Desc." SmallStepper
  (step 15, 0-600, `formatRestSeconds`); in-place day rename via `resolveDayRename` -> `renameDay` (applied to
  the draft, saved with the routine; blank/unchanged discarded; closes on day change; disabled for presets).
  RED: 5 behavior failures + restSeconds/resolveDayRename missing; GREEN routines 107/107.
- 2026-10-06 T11 done: `NoteInputSchema.text` default ""; MoodSelector lineHeight; NoteSheet ScrollView.
  zod is ^3.25 (v3): `.partial()` does not apply `.default("")`, update leaves text unchanged (tested). RED: 6/8
  failing (ZodError on empty/missing text); GREEN 8/8.
- 2026-10-06 T12 done: metro `watchFolders` = de-duplicated union of Expo's default (workspace packages +
  root node_modules, NOT the root itself) and the workspace root; `dev:ios:clear`; `update-ipa.sh` from branch
  (+30 lines, `bash -n` ok).
- 2026-10-06 F1-F2, T9-T12 verification (worktree): `pnpm test` 539 passed (52 files), `pnpm typecheck` clean.
  Next: T8, T13.
- 2026-10-06 T8 done: pure `domains/schedule/daySwap.ts` (statuses, draggable/droppable, `isValidDropTarget`,
  `pickerTargetState`, drop/reschedule/skip/reset/make-today -> `DayMutation`, `availableActions`, worklet
  `dropIndexFor`); `applyDayMutation` dispatcher in schedule mutators; `useScheduleWithStatus` /
  `useScheduleOverridesWithStatus` (`loaded` flags; old hooks are thin wrappers). `DaySwapSheet` = branch UI
  (DnD, action menu, reschedule picker) + main tweaks (Header paddingTop 16, freestyle `darkCard` with
  `whiteText`), gated on all sources loaded (routines, sessions, overrides, schedule, active workout id),
  one write at a time, failures via `showAlert`, mounted guard, `GestureHandlerRootView` inside the Modal.
  index.tsx unchanged (3e1c08c only reformatted it; props `visible`/`onClose` unchanged). Characterization of
  `swapDates`/`setOverrideForDate`/`clearOverrideForDate` found no mutator bug (atomic rollback, outbox upsert/delete
  captured). RED: daySwap.test.ts failed to load (module missing); swapDates.test.ts 6 `applyDayMutation is not
  a function`. GREEN: 67/67 schedule tests. Worklet babel plugin compiles the sheet (8 worklets) and daySwap.ts (1).
- 2026-10-06 T8 verification (worktree): `pnpm test` 606 passed (54 files), `pnpm typecheck` clean. Next: T13.
- 2026-10-06 R1-R8 (independent regression review fix-ups): added tasks R1-R8 above.
  R1 RED: `tests/utils/keyedLive.test.ts` missing module; GREEN 15/15 (stale key ignored, late stale result after
  adoption ignored, same-key reload keeps data, key change -> not loaded, older same-key read dropped, no listener
  call after cleanup). Found while testing: a change event after cleanup still started a load (RED, fixed with a
  cancelled guard in `run`). `useKeyedLiveQuery` re-implements drizzle's hook (addDatabaseChangeListener per
  table; `useRoutineById` exercises query also listens to routine_days since it joins it). Row key RED: `rowKey`
  not a function.
  R2 RED: constant undefined + settings gate missing; GREEN 7/7. R3 RED: `planRestStart` missing; GREEN.
  R4 RED: `sessionEnd` module missing; GREEN 4/4 (UI: finish/discard now also showAlert on failure). R5 RED:
  `parseCompletion` missing; GREEN. R6 RED: 4 failing (`applyPendingDayRename` missing); GREEN routines 51/51.
  R7 RED: `runOnce` module missing; GREEN 4/4. R8 RED: `metro.blocklist.js` missing; GREEN 6/6.
  Verification (worktree): `pnpm test` 645 passed (58 files), `pnpm typecheck` clean, `node -e "require('./metro.config.js')"`
  ok (blockList = Expo's 2 patterns + .codegraph + .atl), `expo export -p web` and `-p ios` succeed.
- 2026-10-06 T13 (parent, worktree): `pnpm test` 645 passed (58 files); `pnpm typecheck` 0 errors;
  `expo export -p web` OK (same bundle set as main: 2 workers + 2 wasm is pre-existing);
  `expo export -p ios` OK (Hermes). Migration upgrade paths (fresh / main-schema / branch-device DB)
  covered by tests/lib/branchDeviceUpgrade.test.ts; sync of new user_profile columns covered by
  tests/profile/restNotificationConfig.test.ts. Independent adversarial review: no blockers; its
  should-fix/nits fixed as R1–R8. Nothing committed. Next: user device QA (how-to-test.txt), then
  commit as work units + PR on user request.
