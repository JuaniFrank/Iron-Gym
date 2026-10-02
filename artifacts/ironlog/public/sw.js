/* IronLog service worker: offline app shell + immutable asset caching.
 * Bump VERSION to invalidate old caches on the next activation. */
const VERSION = "v2";
const CACHE = `ironlog-${VERSION}`;
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

// expo-sqlite on web needs SharedArrayBuffer, so cross-origin isolation must
// survive responses served from the cache.
function withIsolation(response) {
  if (!response || response.type === "opaque" || response.status === 0) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          SHELL.map((url) =>
            fetch(url, { cache: "reload" }).then((res) => {
              if (!res.ok) throw new Error(`precache ${url}: ${res.status}`);
              return cache.put(url, res);
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("ironlog-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Cache writes are best-effort: a failed put must never fail the request.
async function safePut(cache, key, response) {
  try {
    await cache.put(key, response);
  } catch (err) {
    // ignore (quota, partial content, etc.)
  }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    const type = res.headers.get("content-type") || "";
    if (res.ok && type.includes("text/html")) {
      await safePut(cache, "/index.html", res.clone());
    }
    return withIsolation(res);
  } catch (err) {
    const cached = await cache.match("/index.html");
    if (cached) return withIsolation(cached);
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return withIsolation(cached);
  const res = await fetch(request);
  // An SPA rewrite answers missing assets with index.html (200). Never cache
  // HTML under an asset URL, or the broken response sticks offline.
  const isHtml = (res.headers.get("content-type") || "").includes("text/html");
  if (res.status === 200 && !isHtml) await safePut(cache, request, res.clone());
  return withIsolation(res);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (
    url.pathname.startsWith("/_expo/static/") ||
    url.pathname.startsWith("/assets/")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      caches
        .match(request)
        .then((cached) => withIsolation(cached) || fetch(request).then(withIsolation)),
    );
  }
});
