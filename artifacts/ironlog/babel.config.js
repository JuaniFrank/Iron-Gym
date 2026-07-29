module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      // Required by `drizzle-orm/expo-sqlite/migrator`: inlines the contents
      // of `*.sql` files imported from `lib/db/src/migrations/sqlite/migrations.js`
      // so the bundler can ship them as string literals at runtime.
      ["babel-plugin-inline-import", { extensions: [".sql"] }],
    ],
  };
};
