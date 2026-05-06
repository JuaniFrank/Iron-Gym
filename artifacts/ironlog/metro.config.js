const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

// Monorepo: watch the repo root so edits under other workspace packages (e.g.
// `lib/*`) trigger rebuilds. Do not add resolver.nodeModulesPaths here unless
// you follow Expo’s pnpm monorepo guide — a sparse root `node_modules` can
// confuse resolution.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];

module.exports = config;
