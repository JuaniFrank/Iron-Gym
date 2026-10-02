import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../firebase.json"), "utf8"),
);
const hosting = config.hosting;

type Header = { key: string; value: string };
function headersFor(source: string): Record<string, string> {
  const rule = (hosting.headers as { source: string; headers: Header[] }[]).find(
    (h) => h.source === source,
  );
  expect(rule, `header rule for ${source}`).toBeDefined();
  return Object.fromEntries(rule!.headers.map((h) => [h.key, h.value]));
}

describe("firebase.json hosting", () => {
  it("serves the dist directory", () => {
    expect(hosting.public).toBe("dist");
  });

  it("rewrites everything to the SPA index", () => {
    expect(hosting.rewrites).toContainEqual({
      source: "**",
      destination: "/index.html",
    });
  });

  it("sets cross-origin isolation headers on every response", () => {
    const h = headersFor("**");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Cross-Origin-Embedder-Policy"]).toBe("require-corp");
  });

  it("never caches the entry points", () => {
    expect(headersFor("/index.html")["Cache-Control"]).toBe("no-cache");
    expect(headersFor("/sw.js")["Cache-Control"]).toBe("no-cache");
  });

  it("caches hashed static assets as immutable", () => {
    expect(headersFor("/_expo/static/**")["Cache-Control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });
});

describe("firebase.json hosting ignore", () => {
  // Expo exports pnpm-resolved assets (wasm, fonts) under paths containing
  // `.pnpm` and `node_modules`. If an ignore glob matches the file or any of
  // its parent directories, Firebase skips the upload and the SPA rewrite
  // serves index.html instead (breaks expo-sqlite's wasm and the fonts).
  const exportedAssets = [
    "assets/__node_modules/.pnpm/expo-sqlite@16.0.10/node_modules/expo-sqlite/web/wa-sqlite/wa-sqlite.wasm",
    "assets/__node_modules/.pnpm/@expo-google-fonts+inter@0.4.2/node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf",
  ];

  function pathAndParents(file: string): string[] {
    const parts = file.split("/");
    return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
  }

  it.each(exportedAssets)("does not ignore %s", (asset) => {
    const ignore: string[] = hosting.ignore ?? [];
    for (const pattern of ignore) {
      for (const candidate of pathAndParents(asset)) {
        expect(
          path.matchesGlob(candidate, pattern),
          `"${pattern}" matches "${candidate}"`,
        ).toBe(false);
      }
    }
  });
});
