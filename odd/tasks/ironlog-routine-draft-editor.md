# ironlog-routine-draft-editor

## Objective

Routine create and edit work on an in-memory draft. Nothing touches the database until the user
taps "Guardar rutina" / "Guardar cambios"; leaving with unsaved changes asks to discard.

## Problem / Why

Verified in code (2026-10-03):

- `app/routine/[id].tsx:59-69` creates "Nueva rutina" + "Día 1" in a mount effect before the user
  does anything. Leaving the screen leaves orphan routines in every routine list; an unmount or
  remount before the insert resolves can create duplicates (`cancelled` only guards `setState`).
- Every edit (name, days, sets/reps, remove exercise) and the exercise picker
  (`app/exercises.tsx:91`, `addExerciseToDay`) write immediately. There is no discard; back keeps
  everything.
- Each intermediate write is captured by sync triggers and pushed to Firestore (noise, partial
  states visible on other devices).
- Secondary: "Rutina no encontrada" flash while creating (no error handling if create fails);
  remove-exercise uses a `more-vertical` icon and has no undo; empty-name save silently closes.

## Scope

- In: draft model, transactional save (create + diff-based edit), draft-aware exercise picker,
  routine screen refactor (save / discard / unsaved-changes confirm), preset "use as template"
  opening a prefilled draft instead of cloning immediately.
- Out: deleting a whole routine stays immediate (with its existing confirm); active-workout
  editing; other screens that list routines.

## Design (decided)

- User decision: both create and edit use the draft with save and discard.
- `domains/routines/draft.ts`: pure draft model + reducer (rename, add/rename/delete/reorder day,
  add/remove/update exercise, superset toggle), `draftFromRoutine`, `emptyDraft`, `isDirty`,
  `validateDraft` (name 1–200 trimmed, ≥ 1 day). Client-generated ids for new rows.
- `saveRoutineDraft(draft, original | null)` mutator: one synchronous transaction. Create inserts
  everything; edit diffs against the original: insert new rows, update only changed rows (bump
  `updatedAt` only there, so sync pushes minimal changes), soft-delete removed rows; day/exercise
  position renumbering must respect UNIQUE constraints (park-then-renumber, see
  `reorderRoutineDays`).
- Exercise picker: a small in-memory draft store (module with subscribe; no new dependency). The
  routine screen registers its draft under a `draftKey` route param; the picker appends to that
  draft and goes back. Existing non-routine picker modes (session, etc.) unchanged.
- Unsaved-changes guard: `beforeRemove` navigation listener (covers header back, gesture, hardware
  back) shows `showAlert` "¿Descartar cambios?" when dirty; save bypasses it.
- "Empezar entrenamiento" requires a saved, clean draft (prompt to save first when dirty).

## Constraints

- Drizzle expo-sqlite transactions must use synchronous callbacks (`tests/atomicity.test.ts`).
- UI copy stays in Spanish (existing app language); code and comments in English.
- Must not break sync capture: saves go through normal SQL so triggers fire.

## TDD

- Mode: strict, on. Source: user global config (`Strict TDD Mode: enabled`).
- Runner: `pnpm --filter @workspace/ironlog test` (vitest). No React test infra: screen behavior
  is verified by typecheck + manual web run.

## Tasks

- [x] T1 Draft model + reducer + validation (`domains/routines/draft.ts`). Checks: unit tests.
- [x] T2 `saveRoutineDraft` create + diff edit in one transaction. Checks: tests for create,
      rename-only (only routine row updated), add/remove/reorder days and exercises, unique
      positions, soft deletes, rollback on failure, outbox entries only for changed rows.
- [x] T3 Draft store + draft-aware exercise picker. Checks: store unit tests; typecheck.
- [x] T4 Routine screen refactor: no auto-create, draft-backed editing, "Guardar rutina" /
      "Guardar cambios", unsaved-changes confirm, name validation feedback, remove-exercise icon,
      start-workout guard. Checks: typecheck + manual web run.
- [x] T5 Preset "use as template" opens a prefilled new draft instead of `cloneRoutine` writes.
      Checks: typecheck + manual web run.
- [ ] T6 Manual verification on web: create/discard/save, edit/discard/save, picker, no orphans.

## Acceptance criteria

- Opening "Nueva rutina" and going back writes nothing.
- Save creates the routine with all days/exercises at once; edit save writes only the diff.
- Leaving with unsaved changes asks to discard; confirming leaves the DB unchanged.

## Progress

- T1+T2 done. `domains/routines/draft.ts` (types, reducer: setName/Description/Goal, add/rename/
  remove/moveDay, add/remove/update/moveExercise, toggleSuperset; `emptyDraft`, `draftFromRoutine`,
  `isDirty` (untouched empty draft = clean), `validateDraft` with per-day / per-exercise error maps
  keyed by client id, Spanish messages). `saveRoutineDraft` in `mutators.ts`: validate, one sync tx,
  create or diff edit (only changed rows bump `updatedAt`, soft deletes, park-then-renumber incl.
  relocating soft-deleted rows that occupy reused slots). 52 tests (`tests/routines/draft.test.ts`,
  `saveDraft.test.ts`); rename-only → outbox has only the routine row; unchanged → empty outbox.
- TDD deviation (disclosed by the writer): T1 implementation was written before its tests; RED was
  then reproduced against a stub (24 failed / 8 passed) before restoring it. T2 followed RED→GREEN
  (18 failed / 2 passed vs stub). GREEN: 235/235, typecheck exit 0.
- Notes for T4: rebase `original` to the saved draft after save; `saveRoutineDraft` does not guard
  presets (screen must not offer save for presets); reducer needs caller-supplied `uid()` ids.

- T3–T5 done (unit-tested pure parts; screen wiring typechecked only). `draftStore.ts`
  (register/unregister/dispatchToDraft); picker `draftKey`+`dayId` mode (no DB write; old
  `routineId` mode left, now uncalled). `app/routine/[id].tsx`: no auto-create, `useReducer` draft,
  "Guardar rutina"/"Guardar cambios" (disabled when clean/saving), inline name/day errors,
  `router.replace` after create, rebase after edit, `beforeRemove` discard prompt with bypass after
  save/delete, presets read-only, dirty start-workout → save-first prompt, remove icon "x".
  Preset copy → `/routine/new?template=<id>` via `draftFromTemplate` ("<name> (copia)").
  Helpers `saveButtonLabel`, `canSaveDraft`, `shouldPromptOnLeave`. RED: 6 failed (2 files) before
  impl; GREEN 246/246, typecheck exit 0.
- Accepted deviations: start button hidden for unsaved new routine; name is an always-visible
  Input; no day-rename UI (day-name errors unreachable).
- Unverified: web browser back firing `beforeRemove`; existing routine "no encontrada" flash
  before live query loads (pre-existing).

## Next step

- T6 manual web verification by the user (checklist in chat).
