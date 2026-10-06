import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";

/**
 * Minimal, driver-agnostic async SQLite client. Backed by expo-sqlite's async
 * API in the app (`runAsync`, `prepareAsync` + `executeForRawResultAsync`) and
 * by better-sqlite3 in tests. Rows MUST be positional arrays (column order of
 * the statement), which is what drizzle's sqlite-proxy maps from.
 */
export interface AsyncSqlClient {
  /** Execute a statement, discarding any result rows. */
  run(sql: string, params: unknown[]): Promise<void>;
  /** Execute a statement and return all rows as positional arrays. */
  all(sql: string, params: unknown[]): Promise<unknown[][]>;
}

export type AsyncDB<TSchema extends Record<string, unknown> = Record<string, never>> =
  SqliteRemoteDatabase<TSchema>;

type ProxyMethod = "run" | "all" | "get" | "values";
type ProxyResult = { rows: any };

function proxyCallback(client: AsyncSqlClient) {
  return async (sql: string, params: unknown[], method: ProxyMethod): Promise<ProxyResult> => {
    if (method === "run") {
      await client.run(sql, params);
      return { rows: [] };
    }
    const rows = await client.all(sql, params);
    // drizzle expects a single positional row (or undefined) for `get`.
    return { rows: method === "get" ? rows[0] : rows };
  };
}

/** FIFO async mutex: callers run strictly one at a time, in arrival order. */
function createLock() {
  let tail: Promise<void> = Promise.resolve();
  return async function acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = tail;
    tail = previous.then(() => next);
    await previous;
    return release;
  };
}

/**
 * Build a drizzle sqlite-proxy db over a single async connection.
 *
 * The connection is not serialized by the driver, so concurrent async calls
 * would interleave (e.g. a standalone write landing inside another caller's
 * open transaction). Therefore:
 * - every standalone statement takes a FIFO lock;
 * - `db.transaction(cb)` takes the lock once for the whole transaction
 *   (BEGIN ... COMMIT/ROLLBACK) and runs `cb` against an inner db that talks to
 *   the client directly, so statements inside never wait on the lock.
 * Nested `tx.transaction` is not supported and throws.
 */
export function createAsyncDb<TSchema extends Record<string, unknown>>(
  client: AsyncSqlClient,
  config: { schema: TSchema },
): AsyncDB<TSchema> {
  const acquire = createLock();
  const unlocked = proxyCallback(client);

  const inner = drizzle(unlocked, undefined, config) as AsyncDB<TSchema>;
  (inner as { transaction: unknown }).transaction = () => {
    throw new Error("Nested transactions are not supported by createAsyncDb");
  };

  const db = drizzle(
    async (sql, params, method) => {
      const release = await acquire();
      try {
        return await unlocked(sql, params, method);
      } finally {
        release();
      }
    },
    undefined,
    config,
  ) as AsyncDB<TSchema>;

  (db as { transaction: unknown }).transaction = async <T>(
    callback: (tx: AsyncDB<TSchema>) => Promise<T>,
  ): Promise<T> => {
    const release = await acquire();
    try {
      await client.run("begin", []);
      try {
        const result = await callback(inner);
        await client.run("commit", []);
        return result;
      } catch (err) {
        try {
          await client.run("rollback", []);
        } catch {
          // SQLite already rolled back on its own (lock / I/O error). Keep the
          // original error as cause; the message matches drizzle's so the boot
          // pipeline still classifies it as an aborted transaction (dbBoot.ts).
          throw Object.assign(new Error("Failed to run the query 'ROLLBACK'"), { cause: err });
        }
        throw err;
      }
    } finally {
      release();
    }
  };

  return db;
}
