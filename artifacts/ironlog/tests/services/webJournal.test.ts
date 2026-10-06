// Web: with the default DELETE journal, the OPFS pool truncates the journal
// file after every commit, so the next transaction's first write regrows it.
// On iOS that growing write stalls while the main thread blocks on the worker.
// `enablePersistentJournal` keeps the journal file allocated between transactions.
import Database from "better-sqlite3";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { enablePersistentJournal } from "@/services/webJournal";

let dir: string;
let file: string;
let sqlite: Database.Database;

// Same surface expo-sqlite's connection exposes (`$client` on the drizzle db).
const client = () => ({ execAsync: async (sql: string) => void sqlite.exec(sql) });

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "ironlog-journal-"));
  file = path.join(dir, "test.db");
  sqlite = new Database(file);
  sqlite.exec("CREATE TABLE t (v TEXT)");
});

afterEach(() => {
  sqlite.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("enablePersistentJournal", () => {
  it("switches the connection to the PERSIST journal mode", async () => {
    await enablePersistentJournal(client());
    expect(sqlite.pragma("journal_mode", { simple: true })).toBe("persist");
  });

  it("keeps the journal file allocated after a commit", async () => {
    await enablePersistentJournal(client());

    sqlite.transaction(() => sqlite.prepare("INSERT INTO t VALUES (?)").run("x"))();

    const journal = `${file}-journal`;
    expect(existsSync(journal)).toBe(true);
    expect(statSync(journal).size).toBeGreaterThan(0);
  });
});
