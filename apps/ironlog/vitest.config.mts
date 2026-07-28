import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest setup for IronLog. Tests run in node against a real `better-sqlite3`
 * in-memory DB (NOT a mock — convention from db-integration.md §7 and the
 * "mocks pass / prod migration fails" lesson).
 *
 * Key bits:
 *
 * - `tests/setup.ts` runs BEFORE each test file. It rewires the singleton
 *   `services/db.ts` and `services/photoStorage.ts` so the prod code paths
 *   exercised by mutators land on the test DB and an isolated FS sandbox
 *   instead of the expo-sqlite handle / `documentDirectory`.
 * - `expo-file-system` and `expo-sqlite` are aliased to thin stubs because
 *   the prod modules import them eagerly at module-eval time. Tests that
 *   exercise the photo path use `vi.mock` with a counter-based stub
 *   instead of the bare alias.
 *
 * Config file is `.mts` because vitest 4 + vite 7 ship as ESM-only and
 * loading a `.ts` config triggers `ERR_REQUIRE_ESM` from `std-env`.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", ".expo/**"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: [
      // Order matters — first match wins.
      // `react-native-get-random-values` is the runtime polyfill for
      // `crypto.getRandomValues` in RN (used by `uuid`). Node has it natively
      // since 19+, so the polyfill is a no-op in tests. Aliased to a stub
      // because the real package contains RN-only syntax that vitest can't
      // parse.
      {
        find: /^react-native-get-random-values$/,
        replacement: path.resolve(
          __dirname,
          "tests/stubs/react-native-get-random-values.ts",
        ),
      },
      {
        find: /^expo-sqlite$/,
        replacement: path.resolve(__dirname, "tests/stubs/expo-sqlite.ts"),
      },
      {
        find: /^expo-sqlite\/.*/,
        replacement: path.resolve(__dirname, "tests/stubs/expo-sqlite.ts"),
      },
      {
        find: /^expo-file-system$/,
        replacement: path.resolve(__dirname, "tests/stubs/expo-file-system.ts"),
      },
      // Replace drizzle-orm/expo-sqlite (which imports expo-sqlite for
      // useLiveQuery + change listeners) with a no-op stub. We never use
      // the live-query side of drizzle in tests; mutators only call
      // db.select / db.insert / db.transaction, which we get from the
      // better-sqlite3 driver via the test helper.
      {
        find: /^drizzle-orm\/expo-sqlite$/,
        replacement: path.resolve(
          __dirname,
          "tests/stubs/drizzle-expo-sqlite.ts",
        ),
      },
      {
        find: /^drizzle-orm\/expo-sqlite\/.*/,
        replacement: path.resolve(
          __dirname,
          "tests/stubs/drizzle-expo-sqlite.ts",
        ),
      },
      // The expo migrations bundle (`lib/db/src/migrations/sqlite/migrations.js`)
      // imports `.sql` files via `babel-plugin-inline-import`. Vitest doesn't
      // run that babel plugin, so the .sql files get fed to rollup as JS and
      // crash. We never use this bundle in tests anyway — `tests/helpers/db.ts`
      // reads the raw .sql files directly. Alias to a no-op stub so the
      // import resolves without parsing the SQL.
      //
      // Have to swap-replace the bare specifier (`./migrations/sqlite/migrations`)
      // BEFORE vitest's resolver attempts the relative-path lookup.
      {
        find: "./migrations/sqlite/migrations",
        replacement: path.resolve(
          __dirname,
          "tests/stubs/migrations-bundle.ts",
        ),
      },
      {
        find: /\.sql$/,
        replacement: path.resolve(__dirname, "tests/stubs/empty-sql.ts"),
      },
      // The `@workspace/db` barrel re-exports the postgres client via
      // `export * as postgres from "./client/postgres"`. That module
      // requires DATABASE_URL at module-eval time. Stub it so tests
      // running without postgres don't crash on import.
      {
        find: "./client/postgres",
        replacement: path.resolve(__dirname, "tests/stubs/postgres-client.ts"),
      },
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, "$1") },
    ],
  },
});
