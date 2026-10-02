# Feature: IronLog web/PWA compatibility fixes

## Objective
Make core flows (routines, presets, workouts, confirmations) work on the web PWA (https://irongym-auth.web.app) with the same behavior as native.

## Problem / Why
User reports: cannot create routines, seeded routines missing, several other errors. Investigation (headless Chrome repro + static scan, 2026-10-01) found the root causes below.

## Findings (evidence)
- W1 BLOCKER: expo-sqlite@16.0.10 `web/WorkerChannel.ts:43` writes the result length with `Uint8Array.set(new Uint32Array([length]))` -> only `length % 256` stored; `invokeWorkerSync` (`:140`) reads Uint32 -> every sync result > 255 bytes is truncated JSON. drizzle expo-sqlite is fully sync, so `useLiveQuery`/`.all()`/`.get()` return empty/broken data (errors swallowed). Seed did run (4 routines, 165 exercises in DB). Confirmed: node repro 1234 -> 210. Verified fix in scratch build: `new DataView(buffer).setUint32(0, length, true)`. Still present upstream main.
- W2 MAJOR: react-native-web `Alert.alert` is a no-op -> finish/discard workout, delete routine/day/plan/photo, settings resets, validations silently do nothing (active.tsx, routine/[id].tsx, plan.tsx, body.tsx, settings.tsx, exercises.tsx, food-new.tsx, goals.tsx).
- W3 MAJOR: OPFS AccessHandlePool lock -> second tab/window (or PWA + tab) never boots; `_layout.tsx` renders null forever (`DB accessed before initDb() completed` / `NoModificationAllowedError createSyncAccessHandle`).
- C1 MAJOR (all platforms): `db.transaction(async tx => ...)` with drizzle expo-sqlite (sync session) commits when the callback returns its Promise; statements after the first await run outside the transaction, no rollback. createRoutine, deleteRoutine, seed, others.
- W4 MAJOR: progress photos use expo-file-system File/Directory (stub on web). Pending product decision (web storage vs hide on web).
- M1: "Omitir por ahora" bounces back to login when Firebase configured (RouteGuard). Product decision, not in scope.
- M2: sync result buffer fixed 1 MB; latent freeze on huge results. Not in scope.
- M3: stale worker bundles accumulate in dist/ (export doesn't clean).

## Scope
W1, W2, W3, C1, M3.

## Constraints
- TDD strict. Runner: `pnpm test` (vitest) in artifacts/ironlog. arm64 workaround: `NODE_PATH=<scratchpad>/np/node_modules`.
- Artifacts in English; existing UI strings are Spanish — keep consistency.

## Tasks
- [x] T1 Patch expo-sqlite WorkerChannel length header via pnpm patchedDependencies (patches/expo-sqlite@16.0.10.patch) (+ regression test round-tripping >256-byte result).
- [x] T2 `utils/confirm.ts` (web: window.confirm/alert; native: Alert.alert) + replace all Alert.alert call sites; unit tests.
- [x] T3 Web boot: classify OPFS lock error, retry with backoff, then show "open in another tab" screen with retry instead of blank.
- [x] T4 Make transactions synchronous (createRoutine, deleteRoutine, seed, any other async transaction callbacks); atomicity tests with better-sqlite3.
- [x] T5 Clean dist/ before `expo export` in build:web.
- [x] T6 Rebuild, browser re-verification (routines list, presets, create routine, finish workout confirm, second tab).

## Acceptance criteria
- Web: presets visible, create routine opens editor, confirms work, second tab shows message not blank.
- No partial writes when a transaction step throws.
- `pnpm test` + `pnpm typecheck` green.

## Progress
- Investigation done; W1 verified independently.
- T1-T5 implemented (writer run 2026-10-01). T6 pending.

## Evidence
- T1: `tests/web/worker-channel.test.ts` RED 5/6 failed (truncated JSON) -> GREEN 6/6 after patch. Patch is `patches/expo-sqlite@16.0.10.patch`, registered in `pnpm-workspace.yaml` `patchedDependencies` (pnpm patch is interactive, so the patch file was authored by diffing `web/WorkerChannel.ts`); both installs (react 19.1.17 / 19.2.14 peers) contain `setUint32`. Only `web/WorkerChannel.ts` needed it (build/ has no copy; Metro bundles web/*.ts for the worker).
- T2: `utils/dialog.ts` (pure mapping) + `utils/alert.ts` (`showAlert`); 9 unit tests; all 8 files / 19 `Alert.alert` call sites converted.
- T3: `services/dbBoot.ts` (classify + retry) with 10 tests; `components/BootErrorScreen.tsx`; `app/_layout.tsx` retries on web and renders lock/error screen with Reintentar. Not exercised in a real second tab yet.
- T4: all 25 `db.transaction(async ...)` callbacks (routines, workout, schedule, body, admin mutators + lib/db seed) made synchronous (.run/.all/.get). `tests/atomicity.test.ts` RED 4/4 -> GREEN 4/4. Test helper now mirrors the expo session lifecycle (commit on callback return, no await).
- T5: `build:web` removes dist/ first; stale marker file gone after build.
- Verification: `pnpm test` 14 files / 86 tests pass; `pnpm typecheck` clean; `pnpm build:web` OK, bundle has no `.set(new Uint32Array([` and has `setUint32(0,...,true)` in entry + both workers.

## Verification fixes (T3 follow-up)
- Defect: after a locked first boot, retry failed with `Invalid VFS state` (expo-sqlite `web/worker.ts` `maybeInitAsync` set `_sqlite3` before `AccessHandlePoolVFS.create`, which threw) -> worker unusable until full reload.
- Fix 1: `patches/expo-sqlite@16.0.10.patch` now also patches `web/worker.ts`: build `sqlite3`/`vfs`/`vfsMemory` in locals and assign module state only after all steps succeed. Both installs updated via `pnpm install --offline`; present in fresh `build:web` worker bundles (`p=n,I=s,b=e`). No unit test: importing the worker needs WASM/OPFS (impractical in node); covered by browser repro.
- Fix 2: `classifyBootError` treats "Invalid VFS state" as locked (RED 1 failing -> GREEN); web Reintentar = `window.location.reload()`; `BootLoadingScreen` ("Iniciando IronLog...") replaces the blank null render during boot/backoff.
- Evidence: `pnpm test` 14 files / 87 tests pass, typecheck clean, build OK. Headless Chrome (scratchpad `mn.mjs` = multi.mjs on own port/profile, auth guard patched in dist copy): tab 2 shows "IronLog ya está abierta..."; after closing tab 1, clicking Reintentar boots (4 predefinidas, DB OK 4). Chrome/server killed.

## Next step
T6: rebuild/deploy, browser re-verification (routines list, presets, create routine, finish workout confirm, second tab). Upstream: report expo-sqlite WorkerChannel length bug.

## T6 result (headless Chrome, local build, auth guard patched in a scratch copy)
- a) presets visible ("4 predefinidas"); b) Crear rutina opens editor and persists; c) delete routine confirm + finish workout confirm work (finishWorkout/logSet/startWorkout transactions exercised); d) second tab shows "ya está abierta" screen, Reintentar boots after closing tab 1.
- Not verified: live deploy (needs redeploy by user), signed-in flows, iOS Safari OPFS.
- Follow-ups: W4 photos on web (product decision pending); `/routine/new` creates a routine on every mount (pre-existing, all platforms); M1 skip-login bounce; report both expo-sqlite bugs upstream.
