import { sql } from "drizzle-orm";

import type { DB } from "@workspace/db";

/**
 * Column names of a local table, in `SELECT *` order.
 *
 * The async driver returns raw `db.all(sql`...`)` rows as positional arrays
 * (there is no column metadata to build objects from), so callers that read
 * `SELECT *` use these names to rebuild row objects.
 */
export async function tableColumns(db: Pick<DB, "all">, table: string): Promise<string[]> {
  const rows = await db.all<[string]>(sql`SELECT name FROM pragma_table_info(${table})`);
  return rows.map((r) => r[0]);
}
