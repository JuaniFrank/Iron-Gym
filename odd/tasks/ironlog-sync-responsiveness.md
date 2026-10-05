# ironlog-sync-responsiveness

## Objective

Sync must never freeze the UI. On the iPhone PWA, taps stop working for more than a minute while
scrolling still works (scroll is native; taps need the JS main thread).

## Problem / Why

- On web, every drizzle query is a synchronous worker round trip that busy-waits the main thread
  (`expo-sqlite` `invokeWorkerSync`). The sync engine runs entirely on that path.
- `pullChanges` applies every fetched change of every table in ONE synchronous transaction with
  ~3 round trips per row (read local `updated_at`, upsert, clear outbox entry). A first pull of a
  full account on an iPhone (slow OPFS) blocks the main thread for over a minute.
- All-or-nothing apply: if anything fails, cursors don't advance and the next cycle re-downloads
  and re-applies everything, freezing again.
- `pushPending` reads each outbox row with its own synchronous query.
- Before `74ae9c0` the 1M-iteration (~20 ms) sync timeout made these long calls fail fast; with
  the 30 s wall-clock deadline they now complete, but block the UI.

## Scope

- In: batched pull apply with yields between batches and durable per-batch cursor progress;
  batched reads in pull and push; a `yieldToUi` seam for tests.
- Out: moving drizzle to an async driver; Web Worker-side sync; realtime listeners.

## Design (decided)

- Pull: after fetching, apply per table in `SYNC_TABLES` order, changes sorted by
  `serverUpdatedAt`, in batches (default 25). Each batch is its own short synchronous transaction
  (`defer_foreign_keys`, `applying='1'` → `'0'`) that also advances that table's cursor to the
  max `serverUpdatedAt` of the batch. Between batches `await yieldToUi()` (default
  `setTimeout(0)`; injectable).
- A failing batch rolls back only itself; already-committed batches and their cursors stay.
  Stop applying at the first failure and return `{ applied, error }` (later tables retry next
  cycle). Parent-first table order keeps FK parents in earlier batches.
- Per batch, read local `updated_at` for all its row ids in one `WHERE CAST(pk AS TEXT) IN (...)`
  query and clear stale outbox entries with one statement; keep LWW semantics, the pending
  local tombstone rule, and `ON CONFLICT DO UPDATE` (never REPLACE) unchanged.
- Push: read the rows of a batch with one query per table instead of one per entry; yield
  between rounds.

## Constraints

- Drizzle transactions keep synchronous callbacks (`tests/atomicity.test.ts`).
- Existing pull/push/engine tests must keep passing (semantics unchanged except partial progress).

## TDD

- Mode: strict, on. Source: user global config. Runner: `pnpm --filter @workspace/ironlog test`.

## Tasks

- [x] T1 Batched pull apply with yields and per-batch cursor progress. Checks: tests for batch
      boundaries, yield calls between batches, failure in batch N keeps batches < N and their
      cursors, LWW/tombstone/outbox rules unchanged, round-trip test still green.
- [x] T2 Batched reads in pull and push (fewer round trips) + yields between push rounds.
      Checks: tests counting queries per batch via a spy, existing push tests green.
- [ ] T3 Deploy + verify on the iPhone PWA: taps stay responsive during first sync.

## Acceptance criteria

- No synchronous block longer than one batch during sync.
- A partially failed pull resumes from the last committed batch.

## Progress

- T1+T2 done. `pull.ts`: per-table batches of 25, one sync tx each (defer FKs, applying flag,
  cursor to batch max), `yieldToUi` between batches, first failing batch rolls back alone and
  returns `{applied, error}`; per batch one SELECT local `updated_at`, one SELECT pending deletes,
  one DELETE of stale outbox entries (IN lists chunked ≤ 500). `push.ts`: one read per table per
  round, yields between full rounds. Orphan test rewritten (parents commit first; orphan child
  batch fails alone and retries next cycle). RED: 7 assertion failures (e.g. 25 SELECTs vs 1).
  GREEN: 278/278, typecheck clean.

## Next step

- T3: user deploys and verifies on the iPhone PWA.
