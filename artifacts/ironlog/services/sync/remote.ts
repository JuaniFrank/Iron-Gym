// `SyncRemote` port: the sync engine's only view of the remote store.
// No SDK imports here; adapters (Firestore) and test fakes implement it.

/**
 * One row-level change. `data` is the raw SQLite row keyed by SQL column
 * names with raw stored values (ms integers, 0/1 booleans, JSON text), so a
 * pull can write it back verbatim. `null` for a tombstone.
 */
export type RemoteChange = {
  table: string;
  rowId: string;
  /** Client-assigned last-write time (epoch ms); the LWW key. */
  updatedAt: number;
  deleted: boolean;
  data: Record<string, unknown> | null;
};

export type PulledChange = RemoteChange & {
  /** Server-assigned commit time (epoch ms); drives the pull cursor. */
  serverUpdatedAt: number;
};

export interface SyncRemote {
  /** Write all changes or none; rejects on any failure. */
  push(uid: string, changes: RemoteChange[]): Promise<void>;

  /** Changes to `table` with `serverUpdatedAt > cursor` (pull side, T3). */
  pullSince(
    uid: string,
    table: string,
    cursor: number,
  ): Promise<{ changes: PulledChange[] }>;
}
