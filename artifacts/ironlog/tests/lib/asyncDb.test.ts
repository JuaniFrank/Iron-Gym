// Async drizzle core (sqlite-proxy over `AsyncSqlClient`): result mapping, a
// FIFO lock for standalone statements, and `transaction` that holds the lock
// for the whole callback and runs it on an unlocked inner db.
import { createAsyncDb, type AsyncDB } from "@workspace/db";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it } from "vitest";

import { classifyBootError, describeBootError } from "@/services/dbBoot";

import {
  createBetterSqliteAsyncClient,
  type BetterSqliteAsyncClient,
} from "../helpers/betterSqliteAsyncClient";

const items = sqliteTable("items", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
});
const schema = { items };

let sqlite: Database.Database;
let client: BetterSqliteAsyncClient;
let db: AsyncDB<typeof schema>;

const count = () => (sqlite.prepare("select count(*) as n from items").get() as { n: number }).n;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.exec("create table items (id integer primary key, name text not null)");
  client = createBetterSqliteAsyncClient(sqlite);
  db = createAsyncDb(client, { schema });
});

describe("result mapping", () => {
  it("insert/select/update/delete return typed results", async () => {
    await db.insert(items).values([{ id: 1, name: "a" }, { id: 2, name: "b" }]).run();
    expect(await db.select().from(items).all()).toEqual([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ]);
    await db.update(items).set({ name: "z" }).where(eq(items.id, 1)).run();
    expect(await db.select().from(items).where(eq(items.id, 1)).get()).toEqual({ id: 1, name: "z" });
    await db.delete(items).where(eq(items.id, 2)).run();
    expect(await db.select().from(items).all()).toEqual([{ id: 1, name: "z" }]);
  });

  it("get returns undefined for no row and values returns positional rows", async () => {
    expect(await db.select().from(items).where(eq(items.id, 99)).get()).toBeUndefined();
    await db.insert(items).values({ id: 1, name: "a" }).run();
    expect(await db.select({ n: items.name }).from(items).values()).toEqual([["a"]]);
  });

  it("supports returning() on writes", async () => {
    const rows = await db.insert(items).values({ id: 5, name: "r" }).returning().all();
    expect(rows).toEqual([{ id: 5, name: "r" }]);
  });
});

describe("transaction", () => {
  it("commits all writes and returns the callback result", async () => {
    const result = await db.transaction(async (tx) => {
      await tx.insert(items).values({ id: 1, name: "a" }).run();
      await tx.insert(items).values({ id: 2, name: "b" }).run();
      return "ok";
    });
    expect(result).toBe("ok");
    expect(count()).toBe(2);
  });

  it("rolls back every write and rethrows when the callback throws", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(items).values({ id: 1, name: "a" }).run();
        await tx.insert(items).values({ id: 2, name: "b" }).run();
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(count()).toBe(0);
    expect(sqlite.inTransaction).toBe(false);
  });

  it("reads inside the transaction see its own writes", async () => {
    await db.transaction(async (tx) => {
      await tx.insert(items).values({ id: 1, name: "a" }).run();
      expect(await tx.select().from(items).all()).toEqual([{ id: 1, name: "a" }]);
    });
  });

  it("statements inside a transaction do not deadlock on the lock", async () => {
    const done = db.transaction(async (tx) => {
      for (let i = 1; i <= 5; i++) await tx.insert(items).values({ id: i, name: `n${i}` }).run();
    });
    await expect(Promise.race([done, sleep(2000).then(() => "timeout")])).resolves.toBeUndefined();
    expect(count()).toBe(5);
  });

  it("two concurrent transactions do not interleave", async () => {
    const order: string[] = [];
    const t1 = db.transaction(async (tx) => {
      order.push("t1:start");
      await tx.insert(items).values({ id: 1, name: "a" }).run();
      await sleep(10);
      await tx.insert(items).values({ id: 2, name: "b" }).run();
      order.push("t1:end");
    });
    const t2 = db.transaction(async (tx) => {
      order.push("t2:start");
      await tx.insert(items).values({ id: 3, name: "c" }).run();
      order.push("t2:end");
    });
    await Promise.all([t1, t2]);
    expect(order).toEqual(["t1:start", "t1:end", "t2:start", "t2:end"]);
    expect(count()).toBe(3);
    const begins = client.log.filter((s) => /^begin/i.test(s)).length;
    const commits = client.log.filter((s) => /^commit/i.test(s)).length;
    expect([begins, commits]).toEqual([2, 2]);
  });

  it("a failed transaction does not poison the next one", async () => {
    const t1 = db
      .transaction(async (tx) => {
        await tx.insert(items).values({ id: 1, name: "a" }).run();
        throw new Error("boom");
      })
      .catch(() => "failed");
    const t2 = db.transaction(async (tx) => {
      await tx.insert(items).values({ id: 2, name: "b" }).run();
    });
    await Promise.all([t1, t2]);
    expect(await db.select().from(items).all()).toEqual([{ id: 2, name: "b" }]);
  });

  it("a standalone write issued during a transaction waits and is not rolled back", async () => {
    let standaloneDone = false;
    const tx = db.transaction(async (t) => {
      await t.insert(items).values({ id: 1, name: "in-tx" }).run();
      const standalone = db
        .insert(items)
        .values({ id: 2, name: "standalone" })
        .run()
        .then(() => {
          standaloneDone = true;
        });
      await sleep(20);
      expect(standaloneDone).toBe(false);
      throw Object.assign(new Error("rollback"), { standalone });
    });
    const err = (await tx.catch((e) => e)) as Error & { standalone: Promise<void> };
    expect(err.message).toBe("rollback");
    await err.standalone;
    expect(await db.select().from(items).all()).toEqual([{ id: 2, name: "standalone" }]);
  });

  it("a failed ROLLBACK keeps the original error as cause and is classified as aborted", async () => {
    const original = new Error("disk I/O error");
    const err = (await db
      .transaction(async (t) => {
        await t.insert(items).values({ id: 1, name: "a" }).run();
        sqlite.exec("ROLLBACK"); // SQLite rolled back on its own (lock / I/O error)
        throw original;
      })
      .catch((e) => e)) as Error;

    expect(err.message).toBe("Failed to run the query 'ROLLBACK'");
    expect(err.cause).toBe(original);
    expect(classifyBootError(err)).toBe("aborted");
    expect(describeBootError(err)).toMatch(/ROLLBACK' ← disk I\/O error/);
    expect(await db.select().from(items).all()).toEqual([]);
  });

  it("nested tx.transaction throws a clear error", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.transaction(async () => {});
      }),
    ).rejects.toThrow(/nested/i);
    expect(sqlite.inTransaction).toBe(false);
  });
});
