// Structural checks on `firestore.rules` and `firebase.json`. Behavioral rules
// tests need the Firestore emulator (Java) and `@firebase/rules-unit-testing`;
// that gap is tracked in the ironlog-db-sync task document.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SYNC_TABLES } from "@/services/sync/tables";

const root = path.resolve(__dirname, "../..");
const rules = readFileSync(path.join(root, "firestore.rules"), "utf8");
const firebaseJson = JSON.parse(
  readFileSync(path.join(root, "firebase.json"), "utf8"),
);

/** Rules text with `//` comments stripped, whitespace collapsed. */
const code = rules
  .split("\n")
  .map((l) => l.replace(/\/\/.*$/, ""))
  .join(" ")
  .replace(/\s+/g, " ");

describe("firestore.rules", () => {
  it("uses rules_version 2", () => {
    expect(rules).toMatch(/rules_version\s*=\s*'2'\s*;/);
  });

  it("denies everything by default", () => {
    expect(code).toMatch(
      /match \/\{document=\*\*\} \{ allow read, write: if false; \}/,
    );
  });

  it("allows exactly the SYNC_TABLES names", () => {
    const m = code.match(/table in \[([^\]]*)\]/);
    expect(m, "table allowlist").not.toBeNull();
    const listed = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(listed).toEqual(SYNC_TABLES.map((t) => t.name));
  });

  it("scopes users/{uid}/{table}/{rowId} to the owner", () => {
    expect(code).toContain("match /users/{uid}/{table}/{rowId}");
    expect(code).toContain("request.auth != null && request.auth.uid == uid");
    expect(code).toMatch(/allow read: if isOwner\(uid\)/);
  });

  it("pins the document shape", () => {
    expect(code).toMatch(
      /hasOnly\(\['data', 'updatedAt', 'deleted', 'serverUpdatedAt'\]\)/,
    );
    expect(code).toMatch(
      /hasAll\(\['data', 'updatedAt', 'deleted', 'serverUpdatedAt'\]\)/,
    );
    expect(code).toContain("updatedAt is int");
    expect(code).toContain("deleted is bool");
    expect(code).toContain("serverUpdatedAt == request.time");
    expect(code).toContain("data is map");
    expect(code).toContain("data == null");
  });

  it("enforces last-write-wins on update", () => {
    expect(code).toContain(
      "request.resource.data.updatedAt >= resource.data.updatedAt",
    );
  });

  it("denies delete (tombstones only)", () => {
    expect(code).toMatch(/allow delete: if false;/);
  });
});

describe("firebase.json firestore", () => {
  it("points at firestore.rules", () => {
    expect(firebaseJson.firestore).toEqual({ rules: "firestore.rules" });
  });

  it("keeps the hosting config", () => {
    expect(firebaseJson.hosting.public).toBe("dist");
  });
});
