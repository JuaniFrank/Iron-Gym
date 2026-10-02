import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require("../../server/serve-web.js") as {
  createServer: (opts: { root: string }) => Server;
};

let server: Server;
let base: string;

beforeAll(async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "ironlog-dist-"));
  mkdirSync(path.join(root, "_expo/static/js/web"), { recursive: true });
  mkdirSync(path.join(root, "assets"), { recursive: true });
  writeFileSync(path.join(root, "index.html"), "<html>shell</html>");
  writeFileSync(path.join(root, "sw.js"), "// sw");
  writeFileSync(path.join(root, "manifest.webmanifest"), "{}");
  writeFileSync(path.join(root, "favicon.ico"), "ico");
  writeFileSync(path.join(root, "assets/sql.wasm"), "\0asm");
  writeFileSync(path.join(root, "_expo/static/js/web/entry-abc.js"), "1");
  writeFileSync(path.join(path.dirname(root), "secret.txt"), "secret");
  server = createServer({ root });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("serve-web", () => {
  it("sends COOP/COEP on every response, including 404s", async () => {
    for (const p of ["/", "/sw.js", "/missing.png", "/workout/1"]) {
      const res = await fetch(base + p);
      expect(res.headers.get("cross-origin-opener-policy")).toBe(
        "same-origin",
      );
      expect(res.headers.get("cross-origin-embedder-policy")).toBe(
        "require-corp",
      );
    }
  });

  it("falls back to index.html for extensionless deep routes", async () => {
    const res = await fetch(base + "/workout/123");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<html>shell</html>");
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("404s missing files that have an extension", async () => {
    expect((await fetch(base + "/nope.js")).status).toBe(404);
  });

  it("serves correct MIME types", async () => {
    const type = async (p: string) =>
      (await fetch(base + p)).headers.get("content-type");
    expect(await type("/assets/sql.wasm")).toBe("application/wasm");
    expect(await type("/manifest.webmanifest")).toBe(
      "application/manifest+json",
    );
    expect(await type("/favicon.ico")).toBe("image/x-icon");
    expect(await type("/sw.js")).toContain("javascript");
  });

  it("sets cache headers per asset class", async () => {
    const cc = async (p: string) =>
      (await fetch(base + p)).headers.get("cache-control");
    expect(await cc("/")).toBe("no-cache");
    expect(await cc("/sw.js")).toBe("no-cache");
    expect(await cc("/_expo/static/js/web/entry-abc.js")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("blocks path traversal", async () => {
    const net = await import("node:net");
    const port = Number(new URL(base).port);
    const raw = await new Promise<string>((resolve) => {
      const s = net.connect(port, "127.0.0.1", () =>
        s.write(
          "GET /../secret.txt HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n",
        ),
      );
      let data = "";
      s.on("data", (d) => (data += d));
      s.on("close", () => resolve(data));
    });
    expect(raw).not.toContain("secret");
    expect(raw).not.toMatch(/^HTTP\/1.1 200/);
    const enc = await fetch(base + "/%2e%2e/secret.txt");
    expect(await enc.text()).not.toBe("secret");
  });

  it("rejects non-GET/HEAD methods", async () => {
    expect((await fetch(base + "/", { method: "POST" })).status).toBe(405);
  });

  it("answers 400 to an invalid request target and stays alive", async () => {
    const net = await import("node:net");
    const port = Number(new URL(base).port);
    const raw = await new Promise<string>((resolve) => {
      const s = net.connect(port, "127.0.0.1", () =>
        s.write("GET http://[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n"),
      );
      let data = "";
      s.on("data", (d) => (data += d));
      s.on("close", () => resolve(data));
      s.on("error", () => resolve(data));
    });
    expect(raw).toMatch(/^HTTP\/1.1 400/);
    expect(raw.toLowerCase()).toContain("cross-origin-opener-policy: same-origin");
    expect((await fetch(base + "/")).status).toBe(200);
  });
});
