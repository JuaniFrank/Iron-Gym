import { defineConfig } from "drizzle-kit";

// Drizzle config for the IronLog local SQLite database (expo-sqlite driver).
// Migrations are generated as a bundle that `drizzle-orm/expo-sqlite/migrator`
// applies at app boot via `runMigrations()` (cf. §3 in db-integration.md).
//
// Paths are RELATIVE to this config file's directory (`packages/db/`). drizzle-kit
// 0.31 prepends `./` to the configured `out` when looking up snapshots, so an
// absolute `path.join(__dirname, ...)` yields a malformed `.//Users/...` path
// and ENOENT-fails on the snapshot read.

export default defineConfig({
  schema: "./src/schema/sqlite/index.ts",
  out: "./src/migrations/sqlite",
  dialect: "sqlite",
  driver: "expo",
});
