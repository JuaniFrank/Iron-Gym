// Profile · rest-notification preferences (3 columns on the synced
// `user_profile` singleton). Covers defaults, the mutator, the loading-aware
// resolver behind `useRestNotificationConfig`, and the sync contract (outbox
// capture, push payload, pull LWW, pull from clients without the columns).

import type Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { userProfile } from "@workspace/db/schema";
import { beforeEach, describe, expect, it } from "vitest";

import { updateRestNotificationConfig } from "@/domains/profile/mutators";
import { resolveRestNotificationConfig } from "@/domains/profile/queries";
import { pullChanges } from "@/services/sync/pull";
import { pushPending } from "@/services/sync/push";
import type { PulledChange } from "@/services/sync/remote";

import { createTestDb, type TestDb } from "../helpers/db";
import { FakeRemote } from "../sync/fakeRemote";

const UID = "user-1";

let db: TestDb;
let sqlite: Database.Database;
let remote: FakeRemote;

type Row = Record<string, unknown>;
const profileRow = () =>
  sqlite.prepare("SELECT * FROM user_profile WHERE id = 'singleton'").get() as Row;
const outbox = () =>
  sqlite.prepare("SELECT table_name, row_id, op FROM _outbox").all() as Row[];

/** Insert the singleton the way a pre-existing install has it (no new columns named). */
function insertProfile(updatedAt = 1000) {
  sqlite
    .prepare(
      `INSERT INTO user_profile
         (id, name, age, weight_kg, height_cm, sex, activity_level, goal, units, theme, updated_at)
       VALUES ('singleton', 'Juan', 30, 80, 180, 'male', 'moderate', 'muscle', 'metric', 'dark', ?)`,
    )
    .run(updatedAt);
}

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  remote = new FakeRemote();
  insertProfile();
  sqlite.exec("DELETE FROM _outbox");
});

describe("schema defaults", () => {
  it("gives existing rows sane defaults (enabled, rich, default sound)", () => {
    expect(profileRow()).toMatchObject({
      rest_notification_enabled: 1,
      rest_notification_type: "rich",
      rest_notification_sound: "default",
    });
  });

  it("exposes the columns through drizzle with the right types", async () => {
    const row = await db.select().from(userProfile).where(eq(userProfile.id, "singleton")).get();
    expect(row).toMatchObject({
      restNotificationEnabled: true,
      restNotificationType: "rich",
      restNotificationSound: "default",
    });
  });
});

describe("updateRestNotificationConfig", () => {
  it("patches only the given fields and bumps updatedAt", async () => {
    await updateRestNotificationConfig({ enabled: false, sound: "silent" });
    const row = profileRow();
    expect(row).toMatchObject({
      rest_notification_enabled: 0,
      rest_notification_type: "rich",
      rest_notification_sound: "silent",
    });
    expect(Number(row.updated_at)).toBeGreaterThan(1000);
  });

  it("applies a single-field patch", async () => {
    await updateRestNotificationConfig({ type: "sound_only" });
    expect(profileRow()).toMatchObject({
      rest_notification_enabled: 1,
      rest_notification_type: "sound_only",
      rest_notification_sound: "default",
    });
  });

  it("is a no-op for an empty patch (no write, no updatedAt bump, no outbox)", async () => {
    await updateRestNotificationConfig({});
    expect(Number(profileRow().updated_at)).toBe(1000);
    expect(outbox()).toEqual([]);
  });

  it("rejects invalid enum values and unknown keys without writing", async () => {
    await expect(
      updateRestNotificationConfig({ type: "loud" as never }),
    ).rejects.toThrow();
    await expect(
      updateRestNotificationConfig({ sound: "beep" as never }),
    ).rejects.toThrow();
    await expect(
      updateRestNotificationConfig({ enabled: "yes" as never }),
    ).rejects.toThrow();
    await expect(
      updateRestNotificationConfig({ bogus: 1 } as never),
    ).rejects.toThrow();
    expect(profileRow()).toMatchObject({
      rest_notification_enabled: 1,
      rest_notification_type: "rich",
      rest_notification_sound: "default",
    });
    expect(Number(profileRow().updated_at)).toBe(1000);
  });
});

describe("resolveRestNotificationConfig", () => {
  it("is undefined while the query is loading", () => {
    expect(resolveRestNotificationConfig(undefined)).toBeUndefined();
  });

  it("falls back to defaults only once loaded with no row", () => {
    expect(resolveRestNotificationConfig([])).toEqual({
      enabled: true,
      type: "rich",
      sound: "default",
    });
  });

  it("maps the stored row", async () => {
    await updateRestNotificationConfig({ enabled: false, type: "sound_only", sound: "silent" });
    const rows = await db.select().from(userProfile).all();
    expect(resolveRestNotificationConfig(rows)).toEqual({
      enabled: false,
      type: "sound_only",
      sound: "silent",
    });
  });
});

describe("sync", () => {
  it("a config update enqueues a user_profile upsert", async () => {
    await updateRestNotificationConfig({ enabled: false });
    expect(outbox()).toEqual([
      { table_name: "user_profile", row_id: "singleton", op: "upsert" },
    ]);
  });

  it("pushes the new fields in the payload", async () => {
    await updateRestNotificationConfig({ type: "sound_only", sound: "silent", enabled: false });
    await pushPending(db, remote, UID);

    const doc = remote.get(UID, "user_profile", "singleton");
    expect(doc?.data).toMatchObject({
      rest_notification_enabled: 0,
      rest_notification_type: "sound_only",
      rest_notification_sound: "silent",
    });
    expect(outbox()).toEqual([]);
  });

  const remoteDoc = (data: Row, updatedAt: number, serverUpdatedAt = 1) => {
    const doc: PulledChange = {
      table: "user_profile",
      rowId: "singleton",
      updatedAt,
      deleted: false,
      data,
      serverUpdatedAt,
    };
    remote.docs.set(`${UID}/user_profile/singleton`, doc);
  };

  const baseData = (over: Row = {}): Row => ({
    id: "singleton",
    name: "Remote",
    age: 31,
    weight_kg: 81,
    height_cm: 180,
    sex: "male",
    activity_level: "moderate",
    goal: "muscle",
    units: "metric",
    theme: "dark",
    updated_at: 5000,
    ...over,
  });

  it("pulling a doc from a client without the columns keeps the local values", async () => {
    await updateRestNotificationConfig({ enabled: false, type: "sound_only", sound: "silent" });
    sqlite.exec("UPDATE user_profile SET updated_at = 1000");
    remoteDoc(baseData(), 5000);

    await pullChanges(db, remote, UID);

    expect(profileRow()).toMatchObject({
      name: "Remote",
      rest_notification_enabled: 0,
      rest_notification_type: "sound_only",
      rest_notification_sound: "silent",
    });
  });

  it("pulling a doc with the columns applies them when the remote is newer", async () => {
    remoteDoc(
      baseData({
        rest_notification_enabled: 0,
        rest_notification_type: "sound_only",
        rest_notification_sound: "silent",
      }),
      5000,
    );

    await pullChanges(db, remote, UID);

    expect(profileRow()).toMatchObject({
      name: "Remote",
      rest_notification_enabled: 0,
      rest_notification_type: "sound_only",
      rest_notification_sound: "silent",
    });
  });

  it("a newer local row wins over an older remote doc (LWW)", async () => {
    await updateRestNotificationConfig({ sound: "silent" }); // updatedAt = now
    remoteDoc(baseData({ rest_notification_sound: "default" }), 5000);

    await pullChanges(db, remote, UID);

    expect(profileRow()).toMatchObject({ name: "Juan", rest_notification_sound: "silent" });
  });
});
