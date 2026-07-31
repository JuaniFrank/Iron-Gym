const http = require("http");
const { getDefaultConfig } = require("expo/metro-config");

// `expo start --web` HMR client registers itself using the HTML page URL
// (`http://host:port/?platform=web`). Metro's HmrServer then chokes when
// `jsc-safe-url@0.2.4`'s `toJscSafeUrl` rejects URLs with empty paths plus
// a query string — a sanity guard that's correct for iOS JSC stack traces
// but kills the whole dev server here. Treat empty-path URLs as already
// safe so the registration falls through (the deeper resolution would fail
// too, so we also wrap HmrServer.onClientMessage below if we can find it).
//
// pnpm hides nested dependencies from arbitrary callers, so we resolve via
// the workspace root where `node_modules/.pnpm/jsc-safe-url@*/...` lives.
const path = require("path");
const workspaceRoot = path.resolve(__dirname, "..", "..");
function tryPatch(modulePath, patcher) {
  try {
    const mod = require(modulePath);
    patcher(mod);
  } catch (e) {
    console.warn(
      "[ironlog/metro] patch skipped (" + modulePath + "):",
      e && e.message,
    );
  }
}
tryPatch(
  path.join(
    workspaceRoot,
    "node_modules/.pnpm/jsc-safe-url@0.2.4/node_modules/jsc-safe-url",
  ),
  (jsc) => {
    if (jsc.__ironlogPatched) return;
    const orig = jsc.toJscSafeUrl;
    jsc.toJscSafeUrl = function (url) {
      try {
        return orig(url);
      } catch (e) {
        if (/empty path/.test(String(e && e.message))) return url;
        throw e;
      }
    };
    jsc.__ironlogPatched = true;
  },
);
// `onClientMessage` is an arrow-function class field, not a prototype
// method, so it's bound per-instance. Wrap the constructor and replace the
// field on each instance after `new HmrServer()` runs.
tryPatch(
  path.join(
    workspaceRoot,
    "node_modules/.pnpm/metro@0.83.3/node_modules/metro/src/HmrServer.js",
  ),
  (mod) => {
    const HmrServer = mod.default || mod;
    if (!HmrServer || HmrServer.__ironlogWrapped) return;
    const Wrapped = function (...ctorArgs) {
      const instance = new HmrServer(...ctorArgs);
      const origOnClientMessage = instance.onClientMessage;
      instance.onClientMessage = async (...args) => {
        try {
          return await origOnClientMessage(...args);
        } catch (e) {
          console.warn(
            "[ironlog/metro] HmrServer.onClientMessage swallowed:",
            e && e.message,
          );
        }
      };
      return instance;
    };
    Wrapped.prototype = HmrServer.prototype;
    Wrapped.__ironlogWrapped = true;
    mod.default = Wrapped;
  },
);

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];

// expo-sqlite on web requires SharedArrayBuffer (used by `openDatabaseSync`).
// The browser only exposes SharedArrayBuffer when the document is
// cross-origin isolated, which requires both headers below on EVERY response
// — including the HTML document served by Expo Router.
//
// Expo CLI's `enhanceMiddleware` only wraps Metro's bundler endpoints, and
// the second arg there is the Metro Server (not the http.Server), so we
// can't attach a `request` listener through that hook. Patching
// `http.createServer` once at config-load time covers every response with
// the headers — Metro/Expo create the server later via this same call.
if (!http.createServer.__ironlogCoopCoepPatched) {
  const originalCreateServer = http.createServer.bind(http);
  const patched = (...args) => {
    let handler;
    let opts;
    if (typeof args[0] === "function") {
      handler = args[0];
    } else if (typeof args[1] === "function") {
      opts = args[0];
      handler = args[1];
    }
    if (!handler) return originalCreateServer(...args);
    const wrapped = (req, res) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      return handler(req, res);
    };
    return opts ? originalCreateServer(opts, wrapped) : originalCreateServer(wrapped);
  };
  patched.__ironlogCoopCoepPatched = true;
  http.createServer = patched;
}

module.exports = config;
