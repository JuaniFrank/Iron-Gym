/**
 * Zero-dependency static server for the PWA build (`pnpm build:web` -> dist/).
 *
 * - Cross-origin isolation (COOP/COEP) on every response; expo-sqlite on web
 *   needs SharedArrayBuffer.
 * - SPA fallback to index.html for extensionless paths.
 * - Path traversal safe, GET/HEAD only.
 *
 * Separate from server/serve.js, which serves the Expo Go native bundles.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

const IMMUTABLE = "public, max-age=31536000, immutable";

function createServer({ root }) {
  const rootDir = path.resolve(root);

  function send(res, status, headers, body) {
    res.writeHead(status, { ...ISOLATION_HEADERS, ...headers });
    res.end(body);
  }

  /** Map a URL pathname to a file inside rootDir, or null if unsafe. */
  function resolveFile(pathname) {
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    if (decoded.includes("\0")) return null;
    const file = path.resolve(rootDir, "." + path.posix.normalize("/" + decoded));
    if (file !== rootDir && !file.startsWith(rootDir + path.sep)) return null;
    return file;
  }

  return http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return send(res, 405, { Allow: "GET, HEAD" }, "Method Not Allowed");
    }

    let pathname;
    try {
      pathname = new URL(req.url, "http://localhost").pathname;
    } catch {
      return send(res, 400, { "Content-Type": "text/plain" }, "Bad Request");
    }
    let file = resolveFile(pathname);
    if (!file) return send(res, 400, {}, "Bad Request");

    let stat = null;
    try {
      stat = fs.statSync(file);
      if (stat.isDirectory()) {
        file = path.join(file, "index.html");
        stat = fs.statSync(file);
      }
    } catch {
      stat = null;
    }

    if (!stat) {
      // SPA fallback only for extensionless paths; missing assets stay 404.
      if (path.extname(pathname) !== "") {
        return send(res, 404, { "Content-Type": "text/plain" }, "Not Found");
      }
      file = path.join(rootDir, "index.html");
      try {
        stat = fs.statSync(file);
      } catch {
        return send(res, 404, { "Content-Type": "text/plain" }, "Not Found");
      }
    }

    const rel = path.relative(rootDir, file).split(path.sep).join("/");
    const noCache = rel === "index.html" || rel === "sw.js";
    const headers = {
      "Content-Type":
        MIME_TYPES[path.extname(file).toLowerCase()] ||
        "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": noCache
        ? "no-cache"
        : rel.startsWith("_expo/static/")
          ? IMMUTABLE
          : "public, max-age=3600",
    };

    if (req.method === "HEAD") return send(res, 200, headers);
    res.writeHead(200, { ...ISOLATION_HEADERS, ...headers });
    fs.createReadStream(file)
      .on("error", () => res.destroy())
      .pipe(res);
  });
}

module.exports = { createServer };

if (require.main === module) {
  const root = path.resolve(__dirname, "..", "dist");
  const port = Number(process.env.PORT) || 8080;
  if (!fs.existsSync(path.join(root, "index.html"))) {
    console.error(`dist/index.html not found. Run "pnpm build:web" first.`);
    process.exit(1);
  }
  createServer({ root }).listen(port, "0.0.0.0", () => {
    console.log(`IronLog PWA serving ${root} on http://localhost:${port}`);
  });
}
