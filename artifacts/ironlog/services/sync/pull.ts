// Pull engine: fetches remote changes per table and applies them locally.
//
// All tables are fetched first (async), then applied per table in registry
// (parent-first) order, in batches. Each batch is ONE short synchronous
// transaction (see tests/atomicity.test.ts: drizzle's expo session commits when
// the callback returns, so it must not be async) that also advances that
// table's cursor, and the UI gets a turn between batches. A failing batch (e.g.
// a deferred foreign-key violation at commit: a child whose parent has not
// arrived yet) rolls back alone; earlier batches and cursors stay, applying
// stops, and the next cycle resumes from the last committed cursor.
//
// Conflict rule: last-write-wins on `updated_at`; remote wins ties. Capture
// triggers are suppressed while `_sync_state.applying = '1'`.

import { sql } from "drizzle-orm";

import type { DB } from "@workspace/db";

import type { SyncProgressListener } from "./progress";
import type { PulledChange, SyncRemote } from "./remote";
import { SYNC_TABLES, type SyncTable } from "./tables";

export type PullResult = { applied: number; error?: unknown };

const DEFAULT_OVERLAP_MS = 5000;
const DEFAULT_BATCH_SIZE = 25;

/** Let the event loop (taps, paint) run between batches. */
const defaultYieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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

/** Max bound params per statement (SQLite's default limit is 999 on older builds). */
const CHUNK = 500;

function chunks<T>(items: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const inList = (values: readonly string[]) =>
  sql.join(values.map((v) => sql`${v}`), sql`, `);

/** Local `updated_at` (0 when NULL) for the rows that exist, keyed by text pk. */
function localUpdatedAtMap(db: DB, t: SyncTable, rowIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const ids of chunks(rowIds)) {
    const rows = db.all<{ id: string; updated_at: number | null }>(
      sql`SELECT CAST(${ident(t.pk)} AS TEXT) AS id, updated_at FROM ${ident(t.name)}
          WHERE CAST(${ident(t.pk)} AS TEXT) IN (${inList(ids)})`,
    );
    for (const r of rows) out.set(r.id, Number(r.updated_at ?? 0));
  }
  return out;
}

/** `queued_at` of each pending local delete among the rows, keyed by row id. */
function pendingDeleteMap(db: DB, table: string, rowIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const ids of chunks(rowIds, CHUNK - 2)) {
    const rows = db.all<{ row_id: string; queued_at: number }>(
      sql`SELECT row_id, queued_at FROM _outbox
          WHERE table_name = ${table} AND op = 'delete' AND row_id IN (${inList(ids)})`,
    );
    for (const r of rows) out.set(r.row_id, Number(r.queued_at));
  }
  return out;
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
  local: number | undefined,
  pendingDeleteAt: number,
): boolean {
  if (local !== undefined && local > change.updatedAt) return false;
  // A pending local delete is a tombstone stamped with its `queued_at`; if it
  // is newer than the remote doc, applying the doc would resurrect the row.
  if (local === undefined && pendingDeleteAt > change.updatedAt) return false;

  if (change.deleted || change.data === null) {
    if (local === undefined) return false;
    db.run(
      sql`DELETE FROM ${ident(t.name)} WHERE CAST(${ident(t.pk)} AS TEXT) = ${change.rowId}`,
    );
  } else if (!upsertRow(db, t, columns, change.data)) {
    return false;
  }
  return true;
}

/**
 * Apply one batch (inside the caller's transaction): LWW per row with the
 * local state read up front in O(1) queries, then ONE statement clearing the
 * stale outbox entries of every row where remote won.
 * @returns the number of rows applied.
 */
function applyBatch(
  db: DB,
  t: SyncTable,
  columns: string[],
  batch: PulledChange[],
): number {
  const rowIds = [...new Set(batch.map((c) => c.rowId))];
  const locals = localUpdatedAtMap(db, t, rowIds);
  const pendingDeletes = pendingDeleteMap(db, t.name, rowIds);

  const won: string[] = [];
  for (const change of batch) {
    const local = locals.get(change.rowId);
    if (applyChange(db, t, columns, change, local, pendingDeletes.get(change.rowId) ?? -1)) {
      won.push(change.rowId);
    }
  }

  // Remote won: a pending local entry would echo the stale value back.
  for (const ids of chunks(won, CHUNK - 1)) {
    db.run(
      sql`DELETE FROM _outbox WHERE table_name = ${t.name} AND row_id IN (${inList(ids)})`,
    );
  }
  return won.length;
}

export async function pullChanges(
  db: DB,
  remote: SyncRemote,
  uid: string,
  {
    overlapMs = DEFAULT_OVERLAP_MS,
    batchSize = DEFAULT_BATCH_SIZE,
    yieldToUi = defaultYieldToUi,
    onProgress,
  }: {
    overlapMs?: number;
    batchSize?: number;
    yieldToUi?: () => Promise<void>;
    onProgress?: SyncProgressListener;
  } = {},
): Promise<PullResult> {
  let applied = 0;
  try {
    const fetched: { table: SyncTable; changes: PulledChange[] }[] = [];
    for (const table of SYNC_TABLES) {
      const since = Math.max(0, readCursor(db, table.name) - overlapMs);
      const { changes } = await remote.pullSince(uid, table.name, since);
      fetched.push({ table, changes });
      onProgress?.({ phase: "pull-fetch", table: table.name, fetched: changes.length });
    }

    // Per table (parent-first), per batch: one short synchronous transaction.
    const batches: { table: SyncTable; changes: PulledChange[]; total: number }[] = [];
    for (const { table, changes } of fetched) {
      const sorted = [...changes].sort((a, b) => a.serverUpdatedAt - b.serverUpdatedAt);
      for (const part of chunks(sorted, batchSize)) {
        batches.push({ table, changes: part, total: changes.length });
      }
    }

    // Running per-table progress, reported after each committed batch.
    let tableName = "";
    let tableDone = 0;
    let tableApplied = 0;

    let columns: string[] = [];
    let columnsFor = "";
    for (let i = 0; i < batches.length; i++) {
      const { table, changes, total } = batches[i];
      if (columnsFor !== table.name) {
        columns = localColumns(db, table.name);
        columnsFor = table.name;
      }

      // Synchronous callback on purpose: see tests/atomicity.test.ts.
      let batchApplied = 0;
      db.transaction((tx) => {
        tx.run(sql`PRAGMA defer_foreign_keys = ON`);
        setApplying(tx, true);
        batchApplied = applyBatch(tx, table, columns, changes);
        const before = readCursor(tx, table.name);
        const max = Math.max(before, ...changes.map((c) => c.serverUpdatedAt));
        if (max > before) writeCursor(tx, table.name, max);
        setApplying(tx, false);
      });
      applied += batchApplied;

      if (tableName !== table.name) {
        tableName = table.name;
        tableDone = 0;
        tableApplied = 0;
      }
      tableDone += changes.length;
      tableApplied += batchApplied;
      onProgress?.({
        phase: "pull-apply",
        table: table.name,
        done: tableDone,
        total,
        applied: tableApplied,
      });

      if (i < batches.length - 1) await yieldToUi();
    }
    return { applied };
  } catch (error) {
    // Batches that already committed (and their cursors) stay; the failing
    // batch rolled back alone and is retried on the next cycle.
    return { applied, error };
  }
}
