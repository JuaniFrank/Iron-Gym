// First-sync backfill: rows that existed before sync was introduced were never
// captured by the triggers, so enqueue them once per account.
//
// `_sync_state.backfilled_uid` records which account the local data was
// uploaded for. A different uid means the device was used by another account;
// switching accounts is out of scope, and uploading one account's data into
// another must never happen, so that case refuses.

import { sql } from "drizzle-orm";

import type { DB } from "@workspace/db";

import { SYNC_TABLES } from "./tables";

export type BackfillResult = {
  status: "backfilled" | "already_done" | "account_mismatch";
  enqueued: number;
};

const KEY = "backfilled_uid";

const ident = (name: string) => sql.raw(`"${name}"`);

// Rows seeded as presets are never synced (same rule as the capture triggers),
// and neither are the children of preset routines.
const PRESET_ROUTINE_IDS = `SELECT id FROM routines WHERE is_preset = 1`;
const PRESET_DAY_IDS = `SELECT id FROM routine_days WHERE routine_id IN (${PRESET_ROUTINE_IDS})`;
const EXCLUDE: Readonly<Record<string, string>> = {
  exercises: "is_preset = 0",
  food_items: "is_preset = 0",
  routines: "is_preset = 0",
  routine_days: `routine_id NOT IN (${PRESET_ROUTINE_IDS})`,
  routine_exercises: `routine_day_id NOT IN (${PRESET_DAY_IDS})`,
};

/** Synchronous callback on purpose: see tests/atomicity.test.ts. */
export function backfillIfNeeded(db: DB, uid: string): BackfillResult {
  return db.transaction((tx) => {
    const rows = tx.all<{ value: string }>(
      sql`SELECT value FROM _sync_state WHERE key = ${KEY}`,
    );
    if (rows.length > 0) {
      return {
        status: rows[0].value === uid ? "already_done" : "account_mismatch",
        enqueued: 0,
      } as const;
    }

    const now = Date.now();
    let enqueued = 0;
    for (const t of SYNC_TABLES) {
      // `WHERE` is always present: SQLite cannot parse `SELECT ... ON CONFLICT`
      // without it.
      const where = sql.raw(` WHERE ${EXCLUDE[t.name] ?? "1"}`);
      const res = tx.run(
        sql`INSERT INTO _outbox (table_name, row_id, op, queued_at)
            SELECT ${t.name}, CAST(${ident(t.pk)} AS TEXT), 'upsert', ${now}
            FROM ${ident(t.name)}${where}
            ON CONFLICT (table_name, row_id) DO NOTHING`,
      ) as unknown as { changes?: number };
      enqueued += res.changes ?? 0;
    }
    tx.run(sql`INSERT INTO _sync_state (key, value) VALUES (${KEY}, ${uid})`);
    return { status: "backfilled", enqueued } as const;
  });
}
