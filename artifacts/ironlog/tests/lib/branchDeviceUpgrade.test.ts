// Upgrade safety for devices that already ran the (never merged)
// `fix/minor-issues` branch build.
//
// That build created `session_set_drafts` and added three `user_profile`
// columns with ITS OWN migrations, recorded in `__drizzle_migrations` with
// older `when` values than main's 0002/0003. Main's migrations then run on top,
// followed by ours. None of them may crash boot with "already exists" /
// "duplicate column name".

import { createAsyncDb, migrateAsync } from "@workspace/db";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { createBetterSqliteAsyncClient } from "../helpers/betterSqliteAsyncClient";
import { bundleUpTo, loadRealBundle } from "../helpers/migrationBundle";

// Verbatim from the branch (commit 4268c73, 0002_dapper_frank_castle) and its
// journal entry.
const BRANCH_DRAFTS_SQL = `CREATE TABLE \`session_set_drafts\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`session_id\` text NOT NULL,
	\`exercise_id\` text NOT NULL,
	\`set_index\` integer NOT NULL,
	\`is_warmup\` integer NOT NULL,
	\`weight\` real,
	\`reps\` integer,
	\`rpe\` real,
	\`updated_at\` integer NOT NULL,
	FOREIGN KEY (\`session_id\`) REFERENCES \`workout_sessions\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX \`drafts_by_session\` ON \`session_set_drafts\` (\`session_id\`);--> statement-breakpoint
CREATE UNIQUE INDEX \`drafts_slot_uq\` ON \`session_set_drafts\` (\`session_id\`,\`exercise_id\`,\`set_index\`,\`is_warmup\`);`;
const BRANCH_DRAFTS_WHEN = 1779242242000;

// Verbatim from the branch (commit 9bba052, 0003_tricky_hulk).
const BRANCH_REST_NOTIFICATION_SQL = `ALTER TABLE \`user_profile\` ADD \`rest_notification_enabled\` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE \`user_profile\` ADD \`rest_notification_type\` text DEFAULT 'rich' NOT NULL;--> statement-breakpoint
ALTER TABLE \`user_profile\` ADD \`rest_notification_sound\` text DEFAULT 'default' NOT NULL;`;
const BRANCH_REST_NOTIFICATION_WHEN = 1779244131119;

let sqlite: Database.Database;
let db: ReturnType<typeof createAsyncDb>;

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = createAsyncDb(createBetterSqliteAsyncClient(sqlite), { schema: {} });
});

/** Recreate a branch device: main's 0000/0001, then the branch's own migrations. */
async function buildBranchDevice(): Promise<void> {
  await migrateAsync(db, bundleUpTo(2));
  sqlite.exec(BRANCH_DRAFTS_SQL.replaceAll("--> statement-breakpoint", ""));
  sqlite
    .prepare('INSERT INTO "__drizzle_migrations" ("hash","created_at") VALUES (\'\', ?)')
    .run(BRANCH_DRAFTS_WHEN);
  for (const stmt of BRANCH_REST_NOTIFICATION_SQL.split("--> statement-breakpoint")) {
    sqlite.exec(stmt);
  }
  sqlite
    .prepare('INSERT INTO "__drizzle_migrations" ("hash","created_at") VALUES (\'\', ?)')
    .run(BRANCH_REST_NOTIFICATION_WHEN);
}

const tableNames = () =>
  (
    sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[]
  ).map((r) => r.name);

describe("upgrading a device that ran the branch build", () => {
  it("migrates past an already existing session_set_drafts table", async () => {
    await buildBranchDevice();
    sqlite
      .prepare(
        `INSERT INTO workout_sessions (id, routine_name, day_name, started_at, exercise_order, updated_at)
         VALUES ('s1', 'R', 'D', 1, '[]', 1)`,
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO session_set_drafts (id, session_id, exercise_id, set_index, is_warmup, weight, updated_at)
         VALUES ('d1', 's1', 'e1', 1, 0, 50, 1)`,
      )
      .run();

    await migrateAsync(db, loadRealBundle());

    expect(tableNames()).toContain("session_set_drafts");
    // Existing drafts survive the upgrade.
    expect(sqlite.prepare("SELECT weight FROM session_set_drafts WHERE id = 'd1'").get()).toEqual({
      weight: 50,
    });
    // Indexes are intact (exactly one of each, none dropped or duplicated).
    const indexes = (
      sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'session_set_drafts' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[]
    )
      .map((r) => r.name)
      .sort();
    expect(indexes).toEqual(["drafts_by_session", "drafts_slot_uq"]);
  });

  it("migrates past already existing user_profile rest-notification columns and keeps their values", async () => {
    await buildBranchDevice();
    sqlite
      .prepare(
        `INSERT INTO user_profile
           (id, name, age, weight_kg, height_cm, sex, activity_level, goal, units, theme, updated_at,
            rest_notification_enabled, rest_notification_type, rest_notification_sound)
         VALUES ('singleton', 'Juan', 30, 80, 180, 'male', 'moderate', 'muscle', 'metric', 'dark', 1,
                 0, 'sound_only', 'silent')`,
      )
      .run();

    await migrateAsync(db, loadRealBundle());

    expect(
      sqlite
        .prepare(
          "SELECT rest_notification_enabled AS e, rest_notification_type AS t, rest_notification_sound AS s FROM user_profile",
        )
        .get(),
    ).toEqual({ e: 0, t: "sound_only", s: "silent" });
    const cols = (
      sqlite.prepare("PRAGMA table_info(user_profile)").all() as { name: string }[]
    ).filter((c) => c.name.startsWith("rest_notification_"));
    expect(cols).toHaveLength(3);
  });

  it("adds the rest-notification columns on a current-main database with defaults", async () => {
    await migrateAsync(db, bundleUpTo(4));
    sqlite
      .prepare(
        `INSERT INTO user_profile
           (id, name, age, weight_kg, height_cm, sex, activity_level, goal, units, theme, updated_at)
         VALUES ('singleton', 'Juan', 30, 80, 180, 'male', 'moderate', 'muscle', 'metric', 'dark', 1)`,
      )
      .run();
    await migrateAsync(db, loadRealBundle());
    expect(
      sqlite
        .prepare(
          "SELECT rest_notification_enabled AS e, rest_notification_type AS t, rest_notification_sound AS s FROM user_profile",
        )
        .get(),
    ).toEqual({ e: 1, t: "rich", s: "default" });
  });

  it("defines the same table as the branch did (columns, FK, indexes)", async () => {
    const shape = (conn: Database.Database) => ({
      columns: conn.prepare("PRAGMA table_info(session_set_drafts)").all(),
      fks: conn.prepare("PRAGMA foreign_key_list(session_set_drafts)").all(),
      indexes: conn
        .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'session_set_drafts' AND sql IS NOT NULL ORDER BY name")
        .all()
        .map((r: any) => ({ name: r.name, sql: r.sql.replace(/IF NOT EXISTS /i, "") })),
    });
    const branch = new Database(":memory:");
    branch.exec("CREATE TABLE workout_sessions (id text PRIMARY KEY)");
    branch.exec(BRANCH_DRAFTS_SQL.replaceAll("--> statement-breakpoint", ""));

    await migrateAsync(db, loadRealBundle());

    expect(shape(sqlite)).toEqual(shape(branch));
    expect(shape(sqlite).fks).toHaveLength(1);
  });

  it("is a no-op to re-run the bundle on a fully migrated device", async () => {
    await migrateAsync(db, loadRealBundle());
    await migrateAsync(db, loadRealBundle());
    expect(tableNames()).toContain("session_set_drafts");
  });
});

describe("fresh and current-main installs", () => {
  it("creates session_set_drafts on a fresh database", async () => {
    await migrateAsync(db, loadRealBundle());
    expect(tableNames()).toContain("session_set_drafts");
  });

  it("creates session_set_drafts on a current-main database (0000-0003 only)", async () => {
    await migrateAsync(db, bundleUpTo(4));
    expect(tableNames()).not.toContain("session_set_drafts");
    await migrateAsync(db, loadRealBundle());
    expect(tableNames()).toContain("session_set_drafts");
  });
});
