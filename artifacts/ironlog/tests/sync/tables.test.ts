// The registry must list exactly the tables that carry capture triggers.

import { describe, expect, it } from "vitest";

import { LOCAL_ONLY_TABLES, SYNC_TABLES } from "@/services/sync/tables";

import { createTestDb } from "../helpers/db";

describe("sync table registry", () => {
  it("matches exactly the tables with capture triggers", () => {
    const { sqlite } = createTestDb();
    const names = (
      sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
        .all() as { name: string }[]
    ).map((r) => r.name);
    const triggered = new Set(
      names
        .map((n) => /^(.+)_sync_(insert|update|delete)$/.exec(n)?.[1])
        .filter((t): t is string => !!t),
    );
    expect(new Set(SYNC_TABLES.map((t) => t.name))).toEqual(triggered);
    expect(SYNC_TABLES).toHaveLength(triggered.size);
  });

  it("names a real single-column primary key for every table", () => {
    const { sqlite } = createTestDb();
    for (const t of SYNC_TABLES) {
      const pks = (
        sqlite.prepare(`PRAGMA table_info(${t.name})`).all() as {
          name: string;
          pk: number;
        }[]
      ).filter((c) => c.pk > 0);
      expect(pks.map((c) => c.name), t.name).toEqual([t.pk]);
    }
  });

  it("lists parents before children", () => {
    const { sqlite } = createTestDb();
    const index = new Map(SYNC_TABLES.map((t, i) => [t.name, i]));
    for (const t of SYNC_TABLES) {
      const fks = sqlite
        .prepare(`PRAGMA foreign_key_list(${t.name})`)
        .all() as { table: string }[];
      for (const fk of fks) {
        expect(index.get(fk.table), `${fk.table} before ${t.name}`).toBeLessThan(
          index.get(t.name)!,
        );
      }
    }
  });

  it("classifies every table of a migrated database as sync or local-only, never both", () => {
    const { sqlite } = createTestDb();
    const tables = (
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '__drizzle_migrations'",
        )
        .all() as { name: string }[]
    ).map((r) => r.name);
    const sync = new Set(SYNC_TABLES.map((t) => t.name));
    const local = new Set(LOCAL_ONLY_TABLES);

    for (const name of tables) {
      const classes = Number(sync.has(name)) + Number(local.has(name));
      expect(classes, `${name} must be in exactly one of SYNC_TABLES / LOCAL_ONLY_TABLES`).toBe(1);
    }
    // No stale entries either: every classified name is a real table.
    for (const name of [...sync, ...local]) {
      expect(tables, `${name} is classified but missing from the schema`).toContain(name);
    }
  });
});
