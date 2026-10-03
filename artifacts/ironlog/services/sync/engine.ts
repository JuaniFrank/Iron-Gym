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
import type { SyncRemote } from "./remote";

export type SyncState = "idle" | "syncing" | "error" | "account_mismatch";

export type SyncStatus = {
  state: SyncState;
  /** Epoch ms of the last run that pulled and pushed without error. */
  lastSyncedAt?: number;
  lastError?: unknown;
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
};

export function createSyncEngine({
  db,
  remote,
  getUid,
  now = Date.now,
}: SyncEngineDeps): SyncEngine {
  let status: SyncStatus = { state: "idle" };
  const listeners = new Set<(s: SyncStatus) => void>();
  let inFlight: Promise<SyncResult> | null = null;
  let followUp = false;

  function setStatus(next: SyncStatus) {
    status = next;
    for (const l of [...listeners]) {
      try {
        l(status);
      } catch {
        // A faulty subscriber must not break sync.
      }
    }
  }

  async function runOnce(): Promise<SyncResult> {
    try {
      const uid = getUid();
      if (!uid) return { status: "skipped", pulled: 0, pushed: 0 };

      setStatus({ ...status, state: "syncing" });

      const backfill = backfillIfNeeded(db, uid);
      if (backfill.status === "account_mismatch") {
        const result: SyncResult = { status: "account_mismatch", pulled: 0, pushed: 0 };
        setStatus({ ...status, state: "account_mismatch" });
        return result;
      }

      // Push is attempted even if pull failed: local edits should not wait
      // on a transient read failure.
      const pull = await pullChanges(db, remote, uid);
      const push = await pushPending(db, remote, uid);
      const error = pull.error ?? push.error;
      if (error !== undefined) {
        setStatus({ ...status, state: "error", lastError: error });
        return { status: "error", pulled: pull.applied, pushed: push.pushed, error };
      }
      setStatus({ state: "idle", lastSyncedAt: now() });
      return { status: "synced", pulled: pull.applied, pushed: push.pushed };
    } catch (error) {
      setStatus({ ...status, state: "error", lastError: error });
      return { status: "error", pulled: 0, pushed: 0, error };
    }
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
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
