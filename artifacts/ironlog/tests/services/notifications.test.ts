// Rest-notification stub (ironlog-port-minor-issues T7, decision D4): push is
// disabled, so the service must stay inert and must never pull in
// `expo-notifications` (its native module crashes the app on free Apple ID
// sideloads).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  cancelRestNotification,
  REST_NOTIFICATIONS_AVAILABLE,
  ensureNotificationPermissions,
  getNotificationPermissionStatus,
  scheduleRestNotification,
} from "@/services/notifications";

const config = { enabled: true, type: "rich", sound: "default" } as const;

describe("notifications stub", () => {
  it("is flagged unavailable so the settings section stays hidden", () => {
    expect(REST_NOTIFICATIONS_AVAILABLE).toBe(false);
  });

  it("settings gates the whole rest-notification section on the flag", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const settings = readFileSync(
      path.resolve(here, "../../app/settings.tsx"),
      "utf8",
    );
    const gate = settings.indexOf("REST_NOTIFICATIONS_AVAILABLE ?");
    expect(gate).toBeGreaterThan(-1);
    expect(settings.indexOf("NOTIFICACIÓN AL TERMINAR")).toBeGreaterThan(gate);
  });

  it("does not schedule anything", async () => {
    await expect(
      scheduleRestNotification(Date.now() + 60_000, config),
    ).resolves.toBeNull();
  });

  it("cancelling is a harmless no-op", async () => {
    await expect(cancelRestNotification(null)).resolves.toBeUndefined();
    await expect(cancelRestNotification(undefined)).resolves.toBeUndefined();
    await expect(cancelRestNotification("some-id")).resolves.toBeUndefined();
  });

  it("reports permissions as not granted / undetermined", async () => {
    await expect(ensureNotificationPermissions()).resolves.toBe(false);
    await expect(getNotificationPermissionStatus()).resolves.toBe("undetermined");
  });

  it("never imports expo-notifications (not even dynamically)", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.resolve(here, "../../services/notifications.ts"),
      "utf8",
    );
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/expo-notifications/);
  });

  it("the app does not depend on expo-notifications", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(
      readFileSync(path.resolve(here, "../../package.json"), "utf8"),
    );
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty(
      "expo-notifications",
    );
    const appJson = readFileSync(path.resolve(here, "../../app.json"), "utf8");
    expect(appJson).not.toMatch(/expo-notifications/);
  });
});
