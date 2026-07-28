// Vitest stub for `lib/db/src/migrations/sqlite/migrations.js`.
//
// The real bundle imports `.sql` files via `babel-plugin-inline-import`
// (configured in `artifacts/ironlog/babel.config.js`), inlining them as
// strings at build time. Vitest doesn't run that plugin, so the .sql
// files would be fed to rollup as JS and crash. Tests never need this
// bundle — `tests/helpers/db.ts` reads the raw .sql files at runtime
// instead.

export default {
  journal: { entries: [] },
  migrations: {},
};
