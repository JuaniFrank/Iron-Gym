// Sync orchestration: backfill (once per account) -> pull -> push.
//
// Single-flight: concurrent `syncNow()` calls share one in-flight chain. A call
// that arrives while a run is in progress marks exactly one follow-up run (the
// run may have read the outbox / cursors before the caller's local write), no
// matter how many callers piled up. `syncNow` never rejects.

import type { DB } from "@workspace/db";

import { backfillIfNeeded } from "./backfill";
import { pullChanges } from "./pull";
import { pushPending } from "./push";
import type { SyncProgressEvent } from "./progress";
import type { SyncRemote } from "./remote";
import { errorText, formatDuration } from "./statusView";

export type SyncState = "idle" | "syncing" | "error" | "account_mismatch";

export type SyncActivity = {
  phase: "backfill" | "pull-fetch" | "pull-apply" | "push";
  table?: string;
  done?: number;
  total?: number;
};

export type SyncLogEntry = { at: number; level: "info" | "error"; message: string };

export type SyncLastRun = {
  startedAt: number;
  durationMs: number;
  pulled: number;
  pushed: number;
  error?: unknown;
};

export type SyncStatus = {
  state: SyncState;
  /** Epoch ms of the last run that pulled and pushed without error. */
  lastSyncedAt?: number;
  lastError?: unknown;
  /** What the running sync is doing right now (only while `state` is syncing). */
  activity?: SyncActivity;
  /** Summary of the most recent finished run. */
  lastRun?: SyncLastRun;
  /** Recent events, newest first, capped. */
  log: SyncLogEntry[];
};

export type SyncResult = {
  status: "skipped" | "synced" | "error" | "account_mismatch";
  pulled: number;
  pushed: number;
  error?: unknown;
};

export interface SyncEngine {
  syncNow(): Promise<SyncResult>;
  getStatus(): SyncStatus;
  subscribe(listener: (status: SyncStatus) => void): () => void;
}

export type SyncEngineDeps = {
  db: DB;
  remote: SyncRemote;
  getUid: () => string | null;
  now?: () => number;
  /** Min ms between listener notifications caused by progress ticks alone. */
  notifyIntervalMs?: number;
};

const LOG_CAP = 30;
const DEFAULT_NOTIFY_INTERVAL_MS = 250;

export function createSyncEngine({
  db,
  remote,
  getUid,
  now = Date.now,
  notifyIntervalMs = DEFAULT_NOTIFY_INTERVAL_MS,
}: SyncEngineDeps): SyncEngine {
  // `current` is always up to date; `published` is what `getStatus` returns and
  // listeners saw, so progress ticks between notifications never tear a render.
  let current: SyncStatus = { state: "idle", log: [] };
  let published = current;
  let lastNotifyAt = Number.NEGATIVE_INFINITY;
  const listeners = new Set<(s: SyncStatus) => void>();
  let inFlight: Promise<SyncResult> | null = null;
  let followUp = false;

  function publish() {
    published = current;
    lastNotifyAt = now();
    for (const l of [...listeners]) {
      try {
        l(published);
      } catch {
        // A faulty subscriber must not break sync.
      }
    }
  }

  /** State changes always notify. */
  function setStatus(next: SyncStatus) {
    current = next;
    publish();
  }

  /** Progress ticks notify at most once per `notifyIntervalMs`. */
  function setActivity(activity: SyncActivity) {
    current = { ...current, activity };
    if (now() - lastNotifyAt >= notifyIntervalMs) publish();
  }

  function log(level: SyncLogEntry["level"], message: string) {
    current = {
      ...current,
      log: [{ at: now(), level, message }, ...current.log].slice(0, LOG_CAP),
    };
  }

  async function runOnce(): Promise<SyncResult> {
    const startedAt = now();
    let uid: string | null;
    try {
      uid = getUid();
    } catch (error) {
      return fail(startedAt, error, 0, 0);
    }
    if (!uid) return { status: "skipped", pulled: 0, pushed: 0 };

    try {
      log("info", "Sync iniciado");
      setStatus({ ...current, state: "syncing", activity: { phase: "backfill" } });

      const backfill = backfillIfNeeded(db, uid);
      if (backfill.status === "account_mismatch") {
        log("error", "Cuenta distinta: este dispositivo ya se sincronizó con otra cuenta");
        finishRun(startedAt, 0, 0);
        setStatus({ ...current, state: "account_mismatch", activity: undefined });
        return { status: "account_mismatch", pulled: 0, pushed: 0 };
      }
      log(
        "info",
        backfill.status === "backfilled"
          ? `Backfill: ${backfill.enqueued} encolados`
          : "Backfill: ya hecho",
      );

      // Per-table counters, summarised in the log once pull finishes.
      const pulledTables = new Map<string, { fetched: number; applied: number }>();
      const pushedTables: Record<string, number> = {};
      const onProgress = (e: SyncProgressEvent) => {
        if (e.phase === "pull-fetch") {
          pulledTables.set(e.table, { fetched: e.fetched, applied: 0 });
          setActivity({ phase: "pull-fetch", table: e.table });
        } else if (e.phase === "pull-apply") {
          const t = pulledTables.get(e.table) ?? { fetched: e.total, applied: 0 };
          pulledTables.set(e.table, { ...t, applied: e.applied });
          setActivity({ phase: "pull-apply", table: e.table, done: e.done, total: e.total });
        } else {
          Object.assign(pushedTables, e.tables);
          setActivity({ phase: "push", done: e.done, total: e.total });
        }
      };

      // Push is attempted even if pull failed: local edits should not wait
      // on a transient read failure.
      const pull = await pullChanges(db, remote, uid, { onProgress });
      let changed = false;
      for (const [table, t] of pulledTables) {
        if (t.fetched === 0) continue;
        changed = true;
        log("info", `Pull ${table}: ${t.fetched} recibidos, ${t.applied} aplicados`);
      }
      if (!changed && pull.error === undefined) log("info", "Pull: sin cambios");
      if (pull.error !== undefined) log("error", `Error en pull: ${errorText(pull.error)}`);

      const push = await pushPending(db, remote, uid, { onProgress });
      const perTable = Object.entries(pushedTables)
        .map(([table, n]) => `${table} ${n}`)
        .join(", ");
      log("info", `Push: ${push.pushed} cambios${perTable ? ` (${perTable})` : ""}`);
      if (push.error !== undefined) log("error", `Error en push: ${errorText(push.error)}`);

      const error = pull.error ?? push.error;
      if (error !== undefined) return fail(startedAt, error, pull.applied, push.pushed, true);
      finishRun(startedAt, pull.applied, push.pushed);
      setStatus({ ...current, state: "idle", lastSyncedAt: now(), activity: undefined });
      return { status: "synced", pulled: pull.applied, pushed: push.pushed };
    } catch (error) {
      return fail(startedAt, error, 0, 0);
    }
  }

  /** Log the run end and record `lastRun` (does not notify). */
  function finishRun(startedAt: number, pulled: number, pushed: number, error?: unknown) {
    const durationMs = now() - startedAt;
    log("info", `Sync terminado en ${formatDuration(durationMs)}`);
    current = {
      ...current,
      lastRun: { startedAt, durationMs, pulled, pushed, ...(error !== undefined && { error }) },
    };
  }

  function fail(
    startedAt: number,
    error: unknown,
    pulled: number,
    pushed: number,
    alreadyLogged = false,
  ): SyncResult {
    if (!alreadyLogged) log("error", `Error: ${errorText(error)}`);
    finishRun(startedAt, pulled, pushed, error);
    setStatus({ ...current, state: "error", lastError: error, activity: undefined });
    return { status: "error", pulled, pushed, error };
  }

  async function runChain(): Promise<SyncResult> {
    let result = await runOnce();
    while (followUp) {
      followUp = false;
      result = await runOnce();
    }
    return result;
  }

  return {
    syncNow() {
      if (inFlight) {
        followUp = true;
        return inFlight;
      }
      inFlight = runChain().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    getStatus: () => published,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
