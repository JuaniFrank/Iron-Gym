// Babel plugin: bump expo-sqlite's `invokeWorkerSync` busy-loop limit.
//
// `expo-sqlite/web/WorkerChannel.ts` spins on `Atomics.pause()` while waiting
// for the SQLite worker to write the result back via SharedArrayBuffer, and
// gives up after 1_000_000 iterations (~10 ms on a modern CPU). Under a
// sustained workload — e.g. the seed pipeline doing ~150 inserts in one
// transaction — a single round-trip occasionally exceeds that and throws
// "Sync operation timeout". Multiplying the cap by 100x gives the worker
// up to ~1s, which is still bounded but covers realistic bursts.
function bumpExpoSqliteSyncTimeoutPlugin() {
  return {
    name: "ironlog-bump-expo-sqlite-sync-timeout",
    visitor: {
      NumericLiteral(path, state) {
        const file = state.filename || "";
        if (!file.includes("expo-sqlite/web/WorkerChannel")) return;
        if (path.node.value === 1_000_000) {
          path.replaceWith({ type: "NumericLiteral", value: 100_000_000 });
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          unstable_transformImportMeta: true,
          // `expo-sqlite` web spawns a separate Worker bundle. Metro emits
          // each bundle independently, so when `@babel/plugin-transform-runtime`
          // extracts helpers into a shared `@babel/runtime` module they only
          // land in the entry bundle and the worker fails with
          // `Requiring unknown module "<id>"`. Disabling the runtime extraction
          // inlines helpers per-bundle so the worker can boot.
          enableBabelRuntime: false,
        },
      ],
    ],
    plugins: [
      // Required by `drizzle-orm/expo-sqlite/migrator`: inlines the contents
      // of `*.sql` files imported from `lib/db/src/migrations/sqlite/migrations.js`
      // so the bundler can ship them as string literals at runtime.
      ["babel-plugin-inline-import", { extensions: [".sql"] }],
      bumpExpoSqliteSyncTimeoutPlugin,
    ],
  };
};
