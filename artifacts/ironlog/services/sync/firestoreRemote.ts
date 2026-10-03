// Firestore adapter for the `SyncRemote` port.
// Documents live at `users/{uid}/{table}/{rowId}` as
// `{ data, updatedAt, deleted, serverUpdatedAt }`; `firestore.rules` enforces
// the same shape, ownership and last-write-wins server-side.

import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  type Firestore,
  type QueryConstraint,
  type QuerySnapshot,
} from "firebase/firestore";
import type { PulledChange, RemoteChange, SyncRemote } from "./remote";
import { getSyncTable } from "./tables";

/** Firestore's hard cap on writes per batch. */
const MAX_BATCH_OPS = 500;
const PAGE_SIZE = 500;

function assertTable(table: string): void {
  if (!getSyncTable(table)) {
    throw new Error(`Firestore sync: unknown table "${table}"`);
  }
}

function assertChange(c: RemoteChange): void {
  assertTable(c.table);
  if (c.rowId === "" || c.rowId.includes("/")) {
    throw new Error(
      `Firestore sync: invalid row id "${c.rowId}" for table "${c.table}"`,
    );
  }
}

export function createFirestoreRemote(firestore: Firestore): SyncRemote {
  return {
    async push(uid, changes) {
      // Validate everything first so a bad entry never leaves a partial push.
      changes.forEach(assertChange);
      for (let i = 0; i < changes.length; i += MAX_BATCH_OPS) {
        const batch = writeBatch(firestore);
        for (const c of changes.slice(i, i + MAX_BATCH_OPS)) {
          batch.set(doc(firestore, "users", uid, c.table, c.rowId), {
            data: c.data,
            updatedAt: c.updatedAt,
            deleted: c.deleted,
            serverUpdatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    },

    async pullSince(uid, table, cursorMs) {
      assertTable(table);
      const col = collection(firestore, "users", uid, table);
      const base: QueryConstraint[] = [
        where("serverUpdatedAt", ">", Timestamp.fromMillis(cursorMs)),
        orderBy("serverUpdatedAt"),
        limit(PAGE_SIZE),
      ];
      const changes: PulledChange[] = [];
      let after: QueryConstraint | null = null;
      for (;;) {
        const snap: QuerySnapshot = await getDocs(
          query(col, ...base, ...(after ? [after] : [])),
        );
        for (const d of snap.docs) {
          const raw = d.data();
          const ts = raw.serverUpdatedAt;
          // A just-written doc may still carry a pending server timestamp.
          if (!(ts instanceof Timestamp)) continue;
          changes.push({
            table,
            rowId: d.id,
            updatedAt: raw.updatedAt,
            deleted: raw.deleted,
            data: raw.data ?? null,
            serverUpdatedAt: ts.toMillis(),
          });
        }
        if (snap.docs.length < PAGE_SIZE) break;
        after = startAfter(snap.docs[snap.docs.length - 1]);
      }
      return { changes };
    },
  };
}
