// Guard rails for the drizzle migration bundle. The journal, the `.sql` files,
// the generated `migrations.js` imports and the meta snapshots must stay in
// lockstep, and journal `when` values must strictly increase: the migrator
// skips every entry whose `when` is <= the last recorded `created_at`, so a
// non-monotonic entry is silently never applied on upgraded installs.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const DIR = path.resolve(
  __dirname,
  "../../../../lib/db/src/migrations/sqlite",
);

type Entry = { idx: number; tag: string; when: number };

const journal = JSON.parse(
  readFileSync(path.join(DIR, "meta/_journal.json"), "utf8"),
) as { entries: Entry[] };

const pad = (n: number) => n.toString().padStart(4, "0");

describe("migrations journal", () => {
  it("has contiguous idx values starting at 0", () => {
    expect(journal.entries.map((e) => e.idx)).toEqual(
      journal.entries.map((_, i) => i),
    );
  });

  it("has strictly increasing `when` values", () => {
    for (let i = 1; i < journal.entries.length; i++) {
      const prev = journal.entries[i - 1]!;
      const cur = journal.entries[i]!;
      expect(cur.when, `${cur.tag} must be newer than ${prev.tag}`).toBeGreaterThan(
        prev.when,
      );
    }
  });

  it("prefixes every tag with its zero-padded idx", () => {
    for (const e of journal.entries) {
      expect(e.tag.startsWith(`${pad(e.idx)}_`), e.tag).toBe(true);
    }
  });

  it("matches the .sql files on disk one to one", () => {
    const onDisk = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, ""))
      .sort();
    expect(onDisk).toEqual(journal.entries.map((e) => e.tag).sort());
  });

  it("matches the imports of the generated migrations.js", () => {
    const js = readFileSync(path.join(DIR, "migrations.js"), "utf8");
    const imports = [...js.matchAll(/import\s+m(\d{4})\s+from\s+'\.\/(.+)\.sql'/g)].map(
      (m) => ({ key: m[1]!, tag: m[2]! }),
    );
    expect(imports).toEqual(
      journal.entries.map((e) => ({ key: pad(e.idx), tag: e.tag })),
    );
    // Every import must also be registered in the exported `migrations` map.
    const registered = [...js.matchAll(/\bm(\d{4})\b(?!\s+from)/g)].map((m) => m[1]);
    for (const e of journal.entries) {
      expect(registered, `m${pad(e.idx)} registered`).toContain(pad(e.idx));
    }
  });

  it("has a meta snapshot for every entry", () => {
    const snapshots = readdirSync(path.join(DIR, "meta"))
      .filter((f) => f.endsWith("_snapshot.json"))
      .sort();
    expect(snapshots).toEqual(
      journal.entries.map((e) => `${pad(e.idx)}_snapshot.json`),
    );
  });
});
