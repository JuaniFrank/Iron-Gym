// Custom async migrator: same `__drizzle_migrations` bookkeeping as drizzle's
// expo migrator (skip by `created_at`), but applied inside our locked
// `db.transaction`.
import { createAsyncDb, migrateAsync } from "@workspace/db";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { createBetterSqliteAsyncClient } from "../helpers/betterSqliteAsyncClient";

const bundle = {
  journal: {
    entries: [
      { idx: 0, tag: "0000_a", when: 1000, breakpoints: true },
      { idx: 1, tag: "0001_b", when: 2000, breakpoints: true },
    ],
  },
  migrations: {
    m0000: "create table a (id integer);--> statement-breakpoint\ninsert into a values (1);",
    m0001: "create table b (id integer);",
  },
};

let sqlite: Database.Database;
let client: ReturnType<typeof createBetterSqliteAsyncClient>;

beforeEach(() => {
  sqlite = new Database(":memory:");
  client = createBetterSqliteAsyncClient(sqlite);
});

const applied = () =>
  sqlite.prepare('select hash, created_at from "__drizzle_migrations" order by created_at').all();

describe("migrateAsync", () => {
  it("applies every migration and records them", async () => {
    await migrateAsync(createAsyncDb(client, { schema: {} }), bundle);
    expect(sqlite.prepare("select id from a").all()).toEqual([{ id: 1 }]);
    expect(sqlite.prepare("select * from b").all()).toEqual([]);
    expect(applied().map((r: any) => Number(r.created_at))).toEqual([1000, 2000]);
  });

  it("is idempotent", async () => {
    const db = createAsyncDb(client, { schema: {} });
    await migrateAsync(db, bundle);
    await migrateAsync(db, bundle);
    expect(sqlite.prepare("select id from a").all()).toEqual([{ id: 1 }]);
    expect(applied()).toHaveLength(2);
  });

  it("treats rows written by drizzle's expo migrator as applied", async () => {
    // Exactly what drizzle's sync migrator leaves behind: same table, hash "".
    sqlite.exec(
      'create table "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
    );
    sqlite.exec(`insert into "__drizzle_migrations" ("hash","created_at") values ('', 1000)`);
    sqlite.exec("create table a (id integer)");
    await migrateAsync(createAsyncDb(client, { schema: {} }), bundle);
    // 0000 was NOT re-run (table `a` stays empty, no "already exists" error); 0001 ran.
    expect(sqlite.prepare("select id from a").all()).toEqual([]);
    expect(sqlite.prepare("select * from b").all()).toEqual([]);
    expect(applied().map((r: any) => Number(r.created_at))).toEqual([1000, 2000]);
  });

  it("rolls back every migration when one fails", async () => {
    const broken = {
      ...bundle,
      migrations: { ...bundle.migrations, m0001: "create table b (id integer); bogus sql;" },
    };
    await expect(migrateAsync(createAsyncDb(client, { schema: {} }), broken)).rejects.toThrow();
    expect(sqlite.prepare("select name from sqlite_master where name in ('a','b')").all()).toEqual([]);
    expect(applied()).toEqual([]);
  });

  it("throws on a journal entry with no bundled SQL", async () => {
    const missing = { ...bundle, migrations: { m0000: bundle.migrations.m0000 } };
    await expect(migrateAsync(createAsyncDb(client, { schema: {} }), missing)).rejects.toThrow(
      /Missing migration: 0001_b/,
    );
  });

  describe("duplicate column tolerance", () => {
    const withMigration = (query: string) => ({
      journal: { entries: [{ idx: 0, tag: "0000_a", when: 1000, breakpoints: true }] },
      migrations: { m0000: query },
    });

    it("treats a duplicate ADD COLUMN as already applied and keeps going", async () => {
      sqlite.exec("create table t (id integer, extra integer default 7)");
      sqlite.exec("insert into t (id) values (1)");
      await migrateAsync(
        createAsyncDb(client, { schema: {} }),
        withMigration(
          "ALTER TABLE `t` ADD `extra` integer DEFAULT 0 NOT NULL;--> statement-breakpoint\n" +
            "ALTER TABLE `t` ADD `other` text DEFAULT 'x' NOT NULL;--> statement-breakpoint\n" +
            "create table later (id integer);",
        ),
      );
      // The existing column is untouched (not redefined), the missing one is added,
      // the statement after it still ran and the migration is recorded.
      expect(sqlite.prepare("select id, extra, other from t").all()).toEqual([
        { id: 1, extra: 7, other: "x" },
      ]);
      expect(sqlite.prepare("select * from later").all()).toEqual([]);
      expect(applied().map((r: any) => Number(r.created_at))).toEqual([1000]);
    });

    it("tolerates leading SQL comments before the ALTER", async () => {
      sqlite.exec("create table t (id integer, extra integer)");
      await migrateAsync(
        createAsyncDb(client, { schema: {} }),
        withMigration("-- already there on branch devices\n-- keep me\nALTER TABLE `t` ADD `extra` integer;"),
      );
      expect(applied()).toHaveLength(1);
    });

    it("also tolerates the `ADD COLUMN` spelling", async () => {
      sqlite.exec("create table t (id integer, extra integer)");
      await migrateAsync(
        createAsyncDb(client, { schema: {} }),
        withMigration("ALTER TABLE t ADD COLUMN extra integer;"),
      );
      expect(applied()).toHaveLength(1);
    });

    it("does not swallow a duplicate column error from other statements", async () => {
      await expect(
        migrateAsync(
          createAsyncDb(client, { schema: {} }),
          withMigration("create table t (a integer, a integer);"),
        ),
      ).rejects.toThrow();
      expect(applied()).toEqual([]);
    });

    it("does not swallow other ADD COLUMN failures and rolls back", async () => {
      await expect(
        migrateAsync(
          createAsyncDb(client, { schema: {} }),
          withMigration(
            "create table made (id integer);--> statement-breakpoint\nALTER TABLE `missing` ADD `x` integer;",
          ),
        ),
      ).rejects.toThrow();
      expect(sqlite.prepare("select name from sqlite_master where name = 'made'").all()).toEqual([]);
      expect(applied()).toEqual([]);
    });
  });
});
