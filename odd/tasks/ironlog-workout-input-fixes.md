# ironlog-workout-input-fixes

## Objective

Fix the user-reported workout/planning input bugs and the related bugs found during the
2026-10-21 investigation, without regressions.

## Problem / Why

- Decimals are lost: `parseFloat("22,5") === 22`. es-AR keyboards type a comma. Affects
  `domains/workout/setInputs.ts:82-84,101-103`, `app/workout/plan.tsx:867` (NumericCell) and
  `profile.tsx`, `body.tsx`, `food-new.tsx`, `food-add.tsx`, `goals.tsx`. Only `BulkColumnSheet`
  normalizes commas.
- User symptom (2026-10-21): "a set logged with 22.5 kg, or a plan with 22.5 kg, later shows 22
  in the summary and in the exercise/plan screen". Comma parsing is the prime suspect; a
  display-side rounding/formatting path must also be ruled out.
- Plan NumericCell: `useEffect([value])` rewrites the text (eats a trailing "."), the element tree
  changes depending on `onLongPress` (warm-up rows remount on toggle), `key={i}` rows.
- RPE > 10: no input validation; `LogSetSchema` (`rpe max 10`) throws; `active.tsx:806-817` calls
  `logSet` without await/catch and starts the rest timer unconditionally → silent data loss.
  Draft schema (`mutators.ts:893`) accepts any RPE.
- Collapsed exercise cards live in local `useState` (`active.tsx:247`) → lost on re-entry.

## Scope

- In: T1–T8 below.
- Out: PWA rest notifications (needs Web Push backend + Blaze plan; separate feature).

## Constraints

- No component tests (vitest node env, `tests/**/*.test.ts`): extract pure logic into
  `domains/**` or `utils/**` and test it; UI wiring verified by typecheck + manual QA notes.
- Mutations use `.run()` (async sqlite-proxy). Alerts use `showAlert` from `@/utils/alert`.
- Never seed screen state from partially loaded data.
- `session_set_drafts`-style local state stays local-only (not in `SYNC_TABLES`).
- No new migrations unless strictly required (prefer existing key-value/local storage).
- Worktree: `/Users/jfrank/Documents/Projects/Iron-Gym-worktrees/workout-input-fixes`, branch
  `fix/workout-input-fixes` from main@be5b259. Main checkout has unrelated uncommitted sync work.

## TDD

- Mode: strict (source: session config "Strict TDD Mode: enabled").
- Runner: `pnpm test` (vitest) and `pnpm typecheck` in `artifacts/ironlog`.
- Baseline: `pnpm test` 58 files / 645 tests passing; `pnpm typecheck` clean. Note: the workspace
  `pnpm-workspace.yaml` overrides strip the darwin native binaries of rollup/esbuild, so vitest
  cannot start on this Mac out of the box; I extracted `@rollup/rollup-darwin-arm64@4.59.0` and
  `@esbuild/darwin-arm64@0.27.3` into the worktree's (untracked) `node_modules/.pnpm` as a local
  workaround. No tracked file changed for this.

## Tasks

- [x] T1 `parseDecimal` helper (comma→dot, trim, NaN→null) + use it in `setInputs.ts`
      (draft + completion) and `plan.tsx` NumericCell; `inputMode="decimal"` for web.
- [x] T2 Find and fix the "22.5 shows as 22" display/persistence path (summary, active exercise,
      plan screen); regression test with 22.5 end to end through the domain layer.
- [x] T3 RPE validation: clamp/validate RPE to 0–10 and weight ≥ 0 in input parsing; draft
      schema `rpe` range `0..10`; plan RPE cells clamped.
- [x] T4 Set completion: await `logSet`, start rest only after a successful save, show an alert
      on failure; await/catch `removeSet`.
- [x] T5 Plan NumericCell: keep draft text, sync from `value` only when parsed text differs;
      stable element tree; stable row keys; clear RPE when toggling a set to warm-up.
- [x] T6 Persist collapsed exercise cards per session (pure parse/serialize helper + storage).
- [x] T7 Comma-safe parsing in profile, body, food-new, food-add, goals.
- [x] T8 Accessibility labels on SetRow inputs, check button and note button.
- [x] T9 Review corrections: keyed live query for collapsed cards (error/absent row -> empty set), in-flight guard on set completion, draft kept on failed save, profile form gated on loaded data, non-negative clamps for comma-parsed fields.
- [x] T10 Remove RPE from planning (user feedback 2026-10-21: RPE is recorded after the set).
- [x] T11 Warm-up row layout hardening (`minWidth: 0` on NumericCell Pressable/TextInput and the cells row; both row kinds identical, kg + reps).

## Acceptance criteria

- 22,5 and 22.5 are stored and displayed as 22.5 everywhere listed.
- RPE > 10 can't be submitted; a failed save never starts the rest timer and shows an error.
- Collapsed cards survive leaving and re-entering the workout.
- `pnpm test` and `pnpm typecheck` green.

## Progress / Evidence

- T1: RED `pnpm test tests/utils/parseNumber.test.ts tests/workout/setInputs.test.ts` (missing module; 22,5 -> 22). GREEN after adding `utils/parseNumber.ts` (`parseDecimal`, `parseWholeNumber`) and using it in `domains/workout/setInputs.ts` + plan NumericCell. `pnpm test`: 654 passed; `pnpm typecheck` clean. `inputMode` not added: RN web already maps `keyboardType="decimal-pad"` to `inputmode=decimal`.
- T2: traced weight 22.5 through plan storage (`session_plans.exercises` JSON, Zod `weight: z.number().min(0)`), `completed_sets.weight`/`session_set_drafts.weight` (`real`), `LogSetSchema`, volume snapshot, summary (`toFixed(1)`/template strings), active/plan displays, PR records, sync (`services/sync/*` never coerces numbers). No integer column/`Math.round`/`parseInt` touches a weight (only `total_volume_kg` is an integer snapshot, by design). ROOT CAUSE: input parsing only (`parseFloat("22,5") === 22` in `setInputs.ts` draft+completion and plan `NumericCell`); the truncated value was what got stored, so every later screen showed 22. Fixed by T1. Regression `tests/workout/decimalWeights.test.ts` (log/draft/plan, both separators): 6 pass; with the comma normalization removed 3 fail (verified, then restored). `pnpm test`: 660 passed.
- T3: RED (6 failures: clampNumber missing, draft schema accepted rpe 11 / weight -1, parse not clamping). GREEN: `parseRpe`/`parseWeight` in `domains/workout/setInputs.ts` (RPE 0..10 clamp, weight >= 0, NaN -> null/undefined), `clampNumber` in `utils/parseNumber.ts`, draft schema `weight min 0`, `rpe 0..10` in `mutators.ts`; plan cells clamp via `parsePlanCell` (`domains/schedule/planCell.ts`).
- T5: RED `tests/routines/planCell.test.ts` (module missing) -> GREEN 12 tests. `NumericCell` in `app/workout/plan.tsx` now keeps draft text, resyncs from `value` only when `isCellTextStale`, always renders Pressable>TextInput (no remount on warm-up toggle), `toggleWarmup` uses `clearRpeOnWarmup`. DEVIATION: stable row keys not added (`PlannedSet` has no id and adding one needs a schema/Zod change); index keys are safe now because cells resync when their value changes. `pnpm test`: 679 passed; `pnpm typecheck` clean.
- T4: RED `tests/workout/completeSet.test.ts` (module missing) -> GREEN 3 tests (rest only after save, never on failure, not for warm-ups). `saveSetThenRest` in `domains/workout/completeSet.ts`; `active.tsx` onComplete awaits via it and alerts "No se pudo guardar el set" on failure (draft stays); `removeSetOrAlert` catches `removeSet` rejections. `pnpm typecheck` clean.
- T6: RED `tests/workout/collapsedCards.test.ts` (module missing) -> GREEN 12 tests. Storage: existing `key_value` table (already in `LOCAL_ONLY_TABLES`, no capture triggers; verified no `_outbox` rows), key `workout_collapsed:<sessionId>` = JSON id array. `domains/workout/collapsedCards.ts` (pure), `setExerciseCollapsed` mutator (row removed when empty, and in finish/cancel), `useCollapsedExercises` hook (undefined while loading); `active.tsx` derives collapsed state from it and shows the loading view until it arrives (no seeding from partial data). `pnpm test`: 691 passed; `pnpm typecheck` clean.
- T7: wiring-only (logic covered by `tests/utils/parseNumber.test.ts`), verified by typecheck. `parseDecimal`/`parseWholeNumber` now used in `profile.tsx`, `body.tsx` (weight modal; measurement `num` now maps garbage to undefined instead of NaN), `food-new.tsx`, `food-add.tsx`, `goals.tsx`. Extra bug found+fixed in `profile.tsx`: height/weight were re-rendered from the parsed number, so a trailing "."/"," was eaten and decimals could not be typed at all; they now keep their own text state. `settings.tsx` goals are integer-only and untouched.
- T8: `accessibilityLabel`s (Spanish, e.g. "Peso (kg) del set 2", "Completar set 2", "Nota del set 2") on SetRow weight/reps/RPE inputs, check and note buttons; typecheck clean.
- FINAL: `pnpm test`: 63 files / 691 tests passed; `pnpm typecheck`: clean.
- T9: RED (resolveCollapsed missing, in-flight guard absent, parseNonNegative* missing) -> GREEN. (1) `useCollapsedExercises` uses `useKeyedLiveQuery(query,[keyValue],sessionId??"")`; pure `resolveCollapsed` (loading -> undefined, error/absent row -> {}). (2) `saveSetThenRest` takes `inFlight` Set + `key`; concurrent taps on a slot -> 1 save, 1 rest (`active.tsx` `savingSetsRef`). (3) `SetRow.onComplete` may return `Promise<boolean>`; on `false` the row re-flushes its latest draft. (4) `profile.tsx` split into gate (`useProfileSettingsLoaded`) + `ProfileForm` seeded after load. (5) `parseNonNegativeDecimal/Whole` used in profile, body, food-new, food-add, goals. `pnpm test`: 63 files / 699 passed; `pnpm typecheck` clean.
- T10: RED (`resolveSetInputs` prefilled planned RPE; `buildInitialSets` copied last RPE) -> GREEN. Removed in `app/workout/plan.tsx`: RPE column header, RPE cell / warm-up placeholder, bulk RPE, rpe copy in add-set / repeat-last, RPE wording in delete-plan alert; `BulkField`/`PlanCellKind` = weight|reps; `clearRpeOnWarmup` removed (+ tests). `resolveSetInputs` takes RPE only from the draft; `plannedRpe` prop removed from `SetRow`/`active.tsx`; `planInit.buildInitialSets` no longer sets rpe. Kept: optional `rpe` in the plan Zod schema (legacy plans, no migration), "Última sesion" `@rpe` line and the past-sessions RPE-average hint. Tests updated in `setInputs`, `planInit`, `planCell`.
- T11: typecheck-only (layout, no component tests). NumericCell Pressable + TextInput and the cells container got `minWidth: 0` (RN-web raw `<input>` has an intrinsic width so `flex: 1` could not shrink it); warm-up and work rows now render the same two cells.
- After T10/T11: `pnpm test`: 63 files / 699 passed; `pnpm typecheck`: clean.

## Next step

- Manual QA on device (iPhone PWA, es-AR keyboard), then review and commit.
