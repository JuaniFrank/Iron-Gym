# Feature: IronLog mobile-web layout fixes (iOS Safari PWA)

## Objective
Make the web PWA look and behave like the native app on iPhone (standalone PWA and Safari).

## Problem / Why
User screenshots (iPhone, PWA, 2026-10-01):
1. Focusing any input zooms the page and it stays zoomed/misaligned (needs manual zoom-out).
2. Workout set rows (`components/workout/SetRow.tsx`): KG input stretches across the row; REPS/RPE inputs and the check button overflow off-screen to the right (horizontal overflow).
3. White strip at the bottom of every screen (below app root, home-indicator area).
4. Login (`app/(auth)/login.tsx`): grey/white shading at the top under the status bar and lighter side gutters near the top; LinearGradients designed for native safe areas.
5. Active workout header: "EN SESIÓN" label looks faded/blurred at the top (likely a top fade overlay).

## Likely causes (to confirm)
- iOS Safari auto-zooms inputs with font-size < 16px. Viewport: `public/index.html` has `width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover` (no maximum-scale).
- RN-web `TextInput` renders `<input>` with intrinsic min width (~20ch); `flex: 1` without `minWidth: 0` / `width: 0` does not shrink.
- `apple-mobile-web-app-status-bar-style: black-translucent` + body background default white + `height: 100%` (not covering safe area bottom in standalone).

## Scope
Items 1–5, web only; native rendering must not change (use `Platform.OS === "web"` / `.web.tsx` / CSS in index.html).

## Constraints
- TDD strict where testable (pure helpers / index.html meta assertions in tests/pwa); visual checks via headless Chrome iPhone emulation screenshots.
- Artifacts English; existing UI strings Spanish.

## Tasks
- [x] T1 Input focus zoom: viewport + input font-size policy on web.
- [x] T2 SetRow (and other rows with flex TextInputs) overflow on web.
- [x] T3 Full-height + background: no white strip; html/body background matches app; safe areas.
- [x] T4 Login top shading / gutters on web; active workout header fade.
- [x] T5 Screenshot verification in iPhone emulation (login, routines, active workout, routine editor).

## Acceptance criteria
- No horizontal overflow on 390px-wide viewport on the checked screens; set row shows KG, REPS, RPE, check.
- No zoom-on-focus (meta + >=16px inputs on web).
- No white strip at bottom; login has no stray shading.
- Native unchanged; `pnpm test` + `pnpm typecheck` green.

## Evidence
- RED/GREEN: tests/pwa/index-html.test.ts (4 tests failed, then passed).
- Screenshots (390x844 dpr3 iPhone emulation): /private/tmp/claude-501/-Users-jfrank-Documents-Projects-Iron-Gym/bfe538d5-3727-4f40-8bb9-c57097ef9d43/scratchpad/shots/{before,after}-home.png (login), {before,after}-2-routines.png, after-3-editor-new.png, {before,after}-5-afterpick.png (set row; before shows KG stretched + REPS/RPE/check off-screen), after-4-active-empty.png.
- Not provable in emulation: iOS focus zoom, standalone safe areas / home-indicator strip, active header "fade" (not reproducible; no overlay in code).

## Next step
User to verify on iPhone PWA after deploy (not deployed).
