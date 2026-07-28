// Vitest stub for `*.sql` imports. Same rationale as
// `migrations-bundle.ts`: in prod, `babel-plugin-inline-import` inlines
// SQL file contents as default-string exports. Vitest doesn't run that
// plugin. We never need the SQL contents through this path in tests
// (the test helper reads them off disk directly), so empty string is
// fine.
export default "";
