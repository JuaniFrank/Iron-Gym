import { createSqliteDb, type DB } from "@workspace/db";
import { Platform } from "react-native";

import { enablePersistentJournal } from "./webJournal";

/**
 * Process-wide IronLog SQLite handle, exposed as a Proxy.
 *
 * `createSqliteDb()` is async (async open + async queries on every platform,
 * see `lib/db/src/client/sqlite.ts`). All existing call sites import `db`
 * eagerly, so the Proxy delegates every operation to the real handle once
 * `initDb()` resolves — and throws a clear error if anyone touches it
 * before that.
 *
 * The schema migrations and seed bootstrap run AFTER `initDb()` resolves,
 * from `bootDatabase()` in `app/_layout.tsx`. Never query `db` outside the
 * boot pipeline before the gate flips.
 */

let _instance: DB | null = null;

export async function initDb(): Promise<void> {
  if (_instance) return;
  _instance = await createSqliteDb("ironlog.db", {
    // Async, so it runs while the main thread is free (see webJournal.ts).
    onOpen: async (sqlite) => {
      if (Platform.OS === "web") await enablePersistentJournal(sqlite);
    },
  });
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    if (_instance === null) {
      throw new Error(
        "DB accessed before initDb() completed. Call initDb() during boot before any queries/mutators run.",
      );
    }
    return Reflect.get(_instance as object, prop, receiver);
  },
}) as DB;
