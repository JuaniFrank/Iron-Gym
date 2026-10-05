// Push engine: drains `_outbox` into the remote in batches.
//
// Entries are removed only after the remote acknowledges the batch, and only
// if `queued_at` is unchanged since it was read (compare-and-delete): a local
// write that lands during the push re-queues the row with a newer `queued_at`
// and so survives to the next round.

import { sql } from "drizzle-orm";

import type { DB } from "@workspace/db";

import type { RemoteChange, SyncRemote } from "./remote";
import { getSyncTable } from "./tables";

export type PushResult = { pushed: number; error?: unknown };

type OutboxRow = {
  table_name: string;
  row_id: string;
  op: "upsert" | "delete";
  queued_at: number;
};

const DEFAULT_BATCH_SIZE = 400;
const MAX_PARAMS = 500;

/** Let the event loop (taps, paint) run between rounds. */
const defaultYieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Quote a registry-vetted identifier (never call with outbox-supplied text). */
const ident = (name: string) => sql.raw(`"${name}"`);

/** Read the rows of one table for a round with a single query, keyed by text pk. */
function readRows(
  db: DB,
  table: string,
  pk: string,
  rowIds: string[],
): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < rowIds.length; i += MAX_PARAMS) {
    const ids = sql.join(
      rowIds.slice(i, i + MAX_PARAMS).map((id) => sql`${id}`),
      sql`, `,
    );
    const rows = db.all<Record<string, unknown>>(
      sql`SELECT * FROM ${ident(table)} WHERE CAST(${ident(pk)} AS TEXT) IN (${ids})`,
    );
    for (const row of rows) out.set(String(row[pk]), row);
  }
  return out;
}

function toChange(
  entry: OutboxRow,
  rows: Map<string, Map<string, Record<string, unknown>>>,
): RemoteChange | null {
  const table = getSyncTable(entry.table_name);
  if (!table) return null;
  const tombstone: RemoteChange = {
    table: table.name,
    rowId: entry.row_id,
    updatedAt: entry.queued_at,
    deleted: true,
    data: null,
  };
  if (entry.op === "delete") return tombstone;
  const row = rows.get(table.name)?.get(entry.row_id);
  if (!row) return tombstone;
  return {
    table: table.name,
    rowId: entry.row_id,
    updatedAt: Number(row.updated_at),
    deleted: false,
    data: row,
  };
}

/** Synchronous callback on purpose: see tests/atomicity.test.ts. */
function clearEntries(db: DB, entries: OutboxRow[]): void {
  db.transaction((tx) => {
    for (const e of entries) {
      tx.run(
        sql`DELETE FROM _outbox
            WHERE table_name = ${e.table_name}
              AND row_id = ${e.row_id}
              AND queued_at = ${e.queued_at}`,
      );
    }
  });
}

export async function pushPending(
  db: DB,
  remote: SyncRemote,
  uid: string,
  {
    batchSize = DEFAULT_BATCH_SIZE,
    yieldToUi = defaultYieldToUi,
  }: { batchSize?: number; yieldToUi?: () => Promise<void> } = {},
): Promise<PushResult> {
  let pushed = 0;
  try {
    for (;;) {
      const entries = db.all<OutboxRow>(
        sql`SELECT table_name, row_id, op, queued_at FROM _outbox
            ORDER BY queued_at, table_name, row_id LIMIT ${batchSize}`,
      );
      if (entries.length === 0) return { pushed };

      // Entries naming a table outside the registry can never be pushed;
      // drop them so they cannot wedge the queue.
      const known = entries.filter((e) => getSyncTable(e.table_name));
      const unknown = entries.filter((e) => !getSyncTable(e.table_name));

      // One read per table for the whole round (not one per entry).
      const rows = new Map<string, Map<string, Record<string, unknown>>>();
      for (const e of known) {
        if (e.op !== "upsert") continue;
        const t = getSyncTable(e.table_name)!;
        const ids = rows.get(t.name) ?? new Map();
        rows.set(t.name, ids);
        ids.set(e.row_id, undefined);
      }
      for (const [name, wanted] of rows) {
        const t = getSyncTable(name)!;
        rows.set(name, readRows(db, t.name, t.pk, [...wanted.keys()]));
      }

      const changes = known.map((e) => toChange(e, rows) as RemoteChange);
      if (changes.length > 0) await remote.push(uid, changes);

      clearEntries(db, [...known, ...unknown]);
      pushed += known.length;

      // A short round was the last one; otherwise let the UI run first.
      if (entries.length >= batchSize) await yieldToUi();
    }
  } catch (error) {
    return { pushed, error };
  }
}
