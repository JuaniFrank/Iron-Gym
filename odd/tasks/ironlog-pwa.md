# Feature: IronLog web build as installable PWA

## Objective
Ship IronLog (`artifacts/ironlog`, Expo SDK 54 + expo-router) as a web app that is installable as a PWA (home screen, standalone display, offline app shell).

## Problem / Why
The user cannot easily distribute the iOS build (no Apple account, sideloading via Scarlet is fragile). A PWA gives an installable app on iOS/Android through the browser.

## Current evidence
- `pnpm exec expo export -p web` already succeeds (single-page output in `dist/`, ~4.2 MB entry + 2 expo-sqlite WASM workers).
- expo-sqlite on web needs SharedArrayBuffer -> every response must carry `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`.
- Firebase auth falls back to `getAuth` (IndexedDB persistence) on web; no change needed.
- `scripts/build.js` + `server/serve.js` are the Replit Expo Go flow (native bundles); do not break them.

## Scope
- Web app manifest, PWA icons, apple-touch meta, theme color.
- Service worker: offline app shell + hashed static asset caching; preserves COOP/COEP headers.
- Build script producing `dist/` with PWA assets, and a local static server for `dist/` with COOP/COEP + SPA fallback.

## Out of scope
- Push notifications, background sync, cross-device data sync (separate future SDD change: local-first + outbox + Neon via api-server).

## Decisions
- Hosting: Firebase Hosting (free Spark plan; same Firebase project as auth; serves `/__/auth/` on own domain, needed for redirect sign-in under COOP same-origin). Vercel rejected: needs manual `/__/auth` proxy.

## Constraints
- TDD: strict mode enabled (session config). Runner: `pnpm test` (vitest, `tests/**/*.test.ts`).
- Artifacts in English.

## Tasks
- [x] T1 Manifest + icons + HTML template (manifest link, theme-color, apple-touch-icon, apple-mobile-web-app meta) with tests validating manifest fields and icon sizes.
- [x] T2 Service worker (`public/sw.js`) + registration; tests for caching strategy helpers where testable.
- [x] T3 `build:web` + `serve:web` scripts (static server with COOP/COEP, SPA fallback, correct MIME for .wasm/.webmanifest).
- [x] T4 Verify: export, serve, load in browser, confirm manifest/SW detected and app boots with SQLite. (User confirmed it works on web, 2026-09-30.)
- [x] T5 Firebase Hosting config: `firebase.json` (public dist, COOP/COEP on all routes, SPA rewrite, cache headers) + `deploy:web` script. Project id via `firebase use --add` by the user (`.env` is not readable by the agent).
- [x] T6 Web Google sign-in via `signInWithRedirect` (`hooks/useGoogleAuth.web.ts`): COOP same-origin breaks popups. Native hook unchanged.
- [x] T7 Web authDomain = hosting host when served from `*.web.app` / `*.firebaseapp.com`, so redirect auth is same-origin.

## Acceptance criteria
- `pnpm build:web` produces `dist/` containing manifest, icons, sw.js.
- `pnpm serve:web` serves the app with cross-origin isolation; app boots, SQLite works.
- Manifest valid (name, short_name, start_url, display standalone, 192 + 512 icons); SW registers.
- `pnpm test` and `pnpm typecheck` stay green (or pre-existing failures documented).

## Progress
- Exploration done; export feasibility confirmed.
- T1-T3 done (TDD): `public/{manifest.webmanifest,index.html,sw.js,icons/*}`, `server/serve-web.js`, scripts `build:web` / `serve:web`, tests `tests/pwa/{manifest,serve-web}.test.ts`.
- HTML template: Expo uses `public/index.html` as the template (webTemplate.js `getTemplateIndexHtmlAsync`); it keeps `%LANG_ISO_CODE%`/`%WEB_TITLE%` placeholders, the reset style and `#root`. Expo appends the entry script and favicon link.
- Icons are a center crop (900px) of `assets/images/icon.png` (removes white rounded corners); maskable one is padded to 512 with #15171A. theme/background color #15171A (icon background).

## Verification evidence
- RED: `pnpm test tests/pwa` -> both files failed (missing manifest.webmanifest / server/serve-web.js). GREEN: 11/11 pass.
- `pnpm test`: 8 files, 44 tests passed. `pnpm typecheck`: clean.
- `pnpm build:web`: dist has manifest, icons/, sw.js, index.html with manifest link, apple meta, SW registration.
- `pnpm serve:web` (PORT=8765) curl -I: `/`, `/sw.js`, manifest, `/workout/123`, .wasm all 200 with COOP same-origin + COEP require-corp; wasm `application/wasm`; manifest `application/manifest+json`; index/sw.js `no-cache`; `/_expo/static/` immutable.
- Environment note: on this arm64 machine vitest needs `@rollup/rollup-darwin-arm64` and `@esbuild/darwin-arm64`, which the workspace does not install (platform-pinned). Ran with `NODE_PATH` pointing to those packages downloaded outside the repo (scratchpad); no repo/lockfile change.
- Service worker not unit tested (browser behaviour; covered by T4).

## Verification fixes
- serve-web: invalid request target (`GET http://[`) crashed the process; URL parse now guarded, returns 400 with COOP/COEP. RED: new test timed out (server died); GREEN after fix.
- sw.js: cacheFirst caches only status 200; all `cache.put` calls are non-fatal (`safePut`); `/index.html` slot updated only for text/html responses.
- index.html: SW registers only when a `/_expo/static/js/web/` script exists (production export); otherwise existing registrations are unregistered (dev server). RED: manifest test asserting the gate failed; GREEN after fix.
- Re-verified: `pnpm test` 8 files / 45 tests pass; `pnpm typecheck` clean; `pnpm build:web` ok; live probe `printf 'GET http://[ HTTP/1.1...' | nc` -> 400 with COOP/COEP, follow-up curl `/` -> 200.

## T5-T7 (Firebase Hosting + web redirect auth)
- T5: `artifacts/ironlog/firebase.json` (public dist, SPA rewrite, COOP/COEP on `**`, no-cache on index.html/sw.js/manifest, immutable on `/_expo/static/**`), `deploy:web` script, `.firebase/` gitignored, no `.firebaserc` (user runs `firebase use --add`). Firebase serves reserved `/__/*` URLs before rewrites (known behavior; not re-verified against docs this session).
- T6: `hooks/useGoogleAuth.web.ts` (signInWithRedirect + getRedirectResult on mount); native hook unchanged. Hook not unit tested (needs react + AuthContext/firebase mocking in node env).
- T7: `services/authDomain.ts` `resolveAuthDomain`, used in `services/firebase.ts`.
- RED: `tests/pwa/{firebase-hosting,auth-domain}.test.ts` failed (missing firebase.json / module). GREEN: `pnpm test` 10 files / 55 tests; `pnpm typecheck` clean; `pnpm build:web` ok, dist intact.
- No `photoURL` usage in the app, so COEP require-corp does not block profile photos today.

## Next step
User: `firebase login`, `firebase use --add`, enable Google provider in Auth, confirm `<project>.web.app` is in Authorized domains (default), then `pnpm deploy:web` and test sign-in on the deployed URL (redirect auth is only same-origin on *.web.app / *.firebaseapp.com).
