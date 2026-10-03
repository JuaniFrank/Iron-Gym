// In-memory `SyncRemote` fake shared by the push and pull engine tests.
// Documents live in a Map keyed `uid/table/rowId`; no LWW (the engines own it).

import type { RemoteChange, SyncRemote } from "@/services/sync/remote";

export type StoredChange = RemoteChange & { serverUpdatedAt: number };

export class FakeRemote implements SyncRemote {
  readonly docs = new Map<string, StoredChange>();
  /** Every `push` call, in order (recorded even when it fails). */
  readonly pushCalls: { uid: string; changes: RemoteChange[] }[] = [];
  /** When set, `push` rejects with it (all-or-nothing: nothing is stored). */
  failWith: unknown = null;
  /** Runs inside `push`, before it resolves (simulates concurrent local writes). */
  onPush: ((changes: RemoteChange[]) => void) | null = null;
  private clock = 0;

  private key(uid: string, table: string, rowId: string) {
    return `${uid}/${table}/${rowId}`;
  }

  get(uid: string, table: string, rowId: string): StoredChange | undefined {
    return this.docs.get(this.key(uid, table, rowId));
  }

  async push(uid: string, changes: RemoteChange[]): Promise<void> {
    this.pushCalls.push({ uid, changes });
    this.onPush?.(changes);
    if (this.failWith !== null) throw this.failWith;
    for (const c of changes) {
      this.docs.set(this.key(uid, c.table, c.rowId), {
        ...c,
        serverUpdatedAt: ++this.clock,
      });
    }
  }

  async pullSince(
    uid: string,
    table: string,
    cursor: number,
  ): Promise<{ changes: StoredChange[] }> {
    const prefix = `${uid}/${table}/`;
    const changes = [...this.docs.entries()]
      .filter(([k, v]) => k.startsWith(prefix) && v.serverUpdatedAt > cursor)
      .map(([, v]) => v)
      .sort((a, b) => a.serverUpdatedAt - b.serverUpdatedAt);
    return { changes };
  }
}
