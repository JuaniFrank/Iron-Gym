// Pull engine: fetches remote changes per table and applies them locally.
//
// All tables are fetched first (async), then every change is applied inside
// ONE synchronous transaction (see tests/atomicity.test.ts: drizzle's expo
// session commits when the callback returns, so it must not be async). Any
// failure, including a deferred foreign-key violation at commit (a child whose
// parent has not been pushed yet), rolls back rows AND cursors, so the next
// cycle retries from the same cursors.
//
// Conflict rule: last-write-wins on `updated_at`; remote wins ties. Capture
// triggers are suppressed while `_sync_state.applying = '1'`.

import { sql } from "drizzle-orm";

import type { DB } from "@workspace/db";

import type { PulledChange, SyncRemote } from "./remote";
import { SYNC_TABLES, type SyncTable } from "./tables";

export type PullResult = { applied: number; error?: unknown };

const DEFAULT_OVERLAP_MS = 5000;

/** Quote a registry-vetted identifier (never call with remote-supplied text). */
const ident = (name: string) => sql.raw(`"${name}"`);

const cursorKey = (table: string) => `pull_cursor:${table}`;

function readCursor(db: DB, table: string): number {
  const rows = db.all<{ value: string }>(
    sql`SELECT value FROM _sync_state WHERE key = ${cursorKey(table)}`,
  );
  return rows.length > 0 ? Number(rows[0].value) || 0 : 0;
}

function writeCursor(db: DB, table: string, value: number): void {
  db.run(
    sql`INSERT INTO _sync_state (key, value) VALUES (${cursorKey(table)}, ${String(value)})
        ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  );
}

function setApplying(db: DB, on: boolean): void {
  db.run(sql`UPDATE _sync_state SET value = ${on ? "1" : "0"} WHERE key = 'applying'`);
}

function localColumns(db: DB, table: string): string[] {
  return db
    .all<{ name: string }>(sql`SELECT name FROM pragma_table_info(${table})`)
    .map((c) => c.name);
}

function localUpdatedAt(db: DB, t: SyncTable, rowId: string): number | undefined {
  const rows = db.all<{ updated_at: number | null }>(
    sql`SELECT updated_at FROM ${ident(t.name)}
        WHERE CAST(${ident(t.pk)} AS TEXT) = ${rowId} LIMIT 1`,
  );
  return rows.length > 0 ? Number(rows[0].updated_at ?? 0) : undefined;
}

/** `queued_at` of a pending local delete for the row, or -1 if none. */
function pendingDeleteAt(db: DB, table: string, rowId: string): number {
  const rows = db.all<{ queued_at: number }>(
    sql`SELECT queued_at FROM _outbox
        WHERE table_name = ${table} AND row_id = ${rowId} AND op = 'delete'`,
  );
  return rows.length > 0 ? Number(rows[0].queued_at) : -1;
}

/** Upsert in place: REPLACE would delete the row and cascade-delete children. */
function upsertRow(
  db: DB,
  t: SyncTable,
  columns: string[],
  data: Record<string, unknown>,
): boolean {
  const cols = columns.filter((c) => c in data);
  if (!cols.includes(t.pk)) return false;
  const colList = sql.join(cols.map(ident), sql`, `);
  const values = sql.join(cols.map((c) => sql`${data[c] ?? null}`), sql`, `);
  const sets = sql.join(
    cols.filter((c) => c !== t.pk).map((c) => sql`${ident(c)} = excluded.${ident(c)}`),
    sql`, `,
  );
  const onConflict = cols.length > 1
    ? sql`DO UPDATE SET ${sets}`
    : sql`DO NOTHING`;
  db.run(
    sql`INSERT INTO ${ident(t.name)} (${colList}) VALUES (${values})
        ON CONFLICT (${ident(t.pk)}) ${onConflict}`,
  );
  return true;
}

/** @returns whether the change was applied (remote won). */
function applyChange(
  db: DB,
  t: SyncTable,
  columns: string[],
  change: PulledChange,
): boolean {
  const local = localUpdatedAt(db, t, change.rowId);
  if (local !== undefined && local > change.updatedAt) return false;
  // A pending local delete is a tombstone stamped with its `queued_at`; if it
  // is newer than the remote doc, applying the doc would resurrect the row.
  if (local === undefined && pendingDeleteAt(db, t.name, change.rowId) > change.updatedAt) {
    return false;
  }

  if (change.deleted || change.data === null) {
    if (local === undefined) return false;
    db.run(
      sql`DELETE FROM ${ident(t.name)} WHERE CAST(${ident(t.pk)} AS TEXT) = ${change.rowId}`,
    );
  } else if (!upsertRow(db, t, columns, change.data)) {
    return false;
  }

  // Remote won: a pending local entry would echo the stale value back.
  db.run(
    sql`DELETE FROM _outbox WHERE table_name = ${t.name} AND row_id = ${change.rowId}`,
  );
  return true;
}

export async function pullChanges(
  db: DB,
  remote: SyncRemote,
  uid: string,
  { overlapMs = DEFAULT_OVERLAP_MS }: { overlapMs?: number } = {},
): Promise<PullResult> {
  try {
    const fetched: { table: SyncTable; changes: PulledChange[] }[] = [];
    for (const table of SYNC_TABLES) {
      const since = Math.max(0, readCursor(db, table.name) - overlapMs);
      const { changes } = await remote.pullSince(uid, table.name, since);
      fetched.push({ table, changes });
    }

    // Synchronous callback on purpose: see tests/atomicity.test.ts.
    let applied = 0;
    db.transaction((tx) => {
      tx.run(sql`PRAGMA defer_foreign_keys = ON`);
      setApplying(tx, true);
      applied = 0;
      for (const { table, changes } of fetched) {
        if (changes.length === 0) continue;
        const columns = localColumns(tx, table.name);
        let maxServer = readCursor(tx, table.name);
        const before = maxServer;
        for (const change of changes) {
          if (applyChange(tx, table, columns, change)) applied++;
          maxServer = Math.max(maxServer, change.serverUpdatedAt);
        }
        if (maxServer > before) writeCursor(tx, table.name, maxServer);
      }
      setApplying(tx, false);
    });
    return { applied };
  } catch (error) {
    return { applied: 0, error };
  }
}
